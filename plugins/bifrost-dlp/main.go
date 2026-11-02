// Package main implements bifrost-dlp, the Gidorah policy and DLP plugin for
// the Bifrost open-source LLM gateway.
//
// It has two jobs, both performed before a request can leave the machine:
//
//  1. Confidential guard: a request carrying x-gidorah-confidential: true may
//     only be served by a local provider (Ollama). Anything else is rejected
//     with a structured PolicyError.
//  2. DLP scan: the serialized request body is scanned for high-confidence
//     secret patterns. The default action is block; redact is optional and is
//     applied only to non-confidential sessions. A scanner error fails closed.
//
// The plugin also adds policy headers to the response and emits one structured
// policy decision event per request for flight-recorder export. It never logs
// or returns the secret value, only the pattern class, a truncated SHA-256
// hash, the action, the provider, and the model.
//
// PENDING: Bifrost's plugin packages are not available in this offline build.
// The hook interfaces and LLMRequest below are minimal local stand-ins that
// keep this package dependency-free and testable. At integration time they
// must be replaced with the real Bifrost plugin types; see README.md
// ("Hook contract"). The detection logic, decision event, and response headers
// are transport-agnostic and carry over unchanged.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	// PluginName is the plugin id reported to Bifrost.
	PluginName = "gidorah-dlp"

	// PolicyVersionDefault matches policy.yml version: 1.
	PolicyVersionDefault = "1"

	// PolicyHeader values for x-gidorah-policy.
	PolicyConfidentialLocalOnly = "confidential-local-only"
	PolicyStandard              = "standard"

	// Request and response header names.
	HeaderConfidential  = "x-gidorah-confidential"
	HeaderPolicy        = "x-gidorah-policy"
	HeaderPolicyVersion = "x-gidorah-policy-version"
	HeaderDLP           = "x-gidorah-dlp"

	// Rule ids are stable and appear in decision events and errors.
	RuleRequest           = "gidorah.policy.request"
	RuleConfidentialGuard = "gidorah.policy.confidential-local-only"
	RuleSecretScan        = "gidorah.dlp.secret-scan"
	RuleScannerError      = "gidorah.dlp.scanner-error"
	RuleAuditSinkError    = "gidorah.dlp.audit-sink-error"

	// EventPolicyDecision is the decision event type for the flight recorder.
	EventPolicyDecision = "policy_decision"

	redactionMarker = "[REDACTED]"

	// defaultMaxScanBytes bounds work per request; larger bodies fail closed.
	defaultMaxScanBytes = 8 << 20
)

// Action is the outcome of a policy decision.
type Action string

const (
	// ActionAllow means the request may proceed.
	ActionAllow Action = "allow"
	// ActionBlock means the request must not proceed.
	ActionBlock Action = "blocked"
	// ActionRedact means the body was rewritten and may proceed.
	ActionRedact Action = "redacted"
)

// PolicyError is the structured rejection returned by the pre-request hook.
// It carries no prompt content and no secret value.
type PolicyError struct {
	Code         string `json:"code"`
	RuleID       string `json:"rule_id"`
	Message      string `json:"message"`
	Provider     string `json:"provider,omitempty"`
	Model        string `json:"model,omitempty"`
	PatternClass string `json:"pattern_class,omitempty"`
	SecretHash   string `json:"secret_hash,omitempty"`
}

// Error renders the rejection as compact JSON so Bifrost logs and the agent
// receive a machine-readable policy error rather than a prose string.
func (e *PolicyError) Error() string {
	payload, err := json.Marshal(e)
	if err != nil {
		return e.Code + ": " + e.Message
	}
	return string(payload)
}

// LLMRequest is the subset of a Bifrost request the plane needs.
//
// PENDING: replace this with the Bifrost request schema at integration time.
// The adapter must copy Provider, Model, Body, and Headers, and must keep
// Decision attached to the request (or in adapter state keyed by request id)
// so the response header hook can add the policy headers.
type LLMRequest struct {
	Provider string
	Model    string
	Body     []byte
	Headers  http.Header
	Decision *Decision
}

// PreLLMHook is the local stand-in for Bifrost's pre-request plugin hook.
//
// PENDING: bind this to the real Bifrost hook signature and error type at
// integration time. The body shape and semantics stay the same.
type PreLLMHook interface {
	PreLLMHook(ctx context.Context, req *LLMRequest) (*LLMRequest, error)
}

// HTTPTransportResponseHeadersHook is the local stand-in for Bifrost's
// response header hook.
//
// PENDING: bind this to the real Bifrost hook signature at integration time.
type HTTPTransportResponseHeadersHook interface {
	HTTPTransportResponseHeadersHook(ctx context.Context, req *LLMRequest, headers http.Header) error
}

// Decision records what the policy plane decided for one request. It is safe
// to serialize: it never contains prompt content or a secret value.
type Decision struct {
	Action             Action
	RuleID             string
	Reason             string
	Provider           string
	Model              string
	Confidential       bool
	RequestID          string
	PatternClasses     []string
	AllowlistedClasses []string
	SecretHashes       []string
	At                 time.Time
}

// PolicyValue returns the x-gidorah-policy header value.
func (d Decision) PolicyValue() string {
	if d.Confidential {
		return PolicyConfidentialLocalOnly
	}
	return PolicyStandard
}

// DLPValue returns the x-gidorah-dlp header value.
//
// The documented values are clean and blocked:<class>. Redact mode reports
// redacted:<class>, and a block that is not a pattern match (for example the
// confidential guard) reports blocked:policy. Both extensions are explicit so
// the header never claims a scan result that did not happen.
func (d Decision) DLPValue() string {
	switch d.Action {
	case ActionBlock:
		if len(d.PatternClasses) > 0 {
			return "blocked:" + d.PatternClasses[0]
		}
		return "blocked:policy"
	case ActionRedact:
		if len(d.PatternClasses) > 0 {
			return "redacted:" + d.PatternClasses[0]
		}
		return "redacted"
	default:
		return "clean"
	}
}

// Config configures a PolicyPlane. The zero value is usable: block mode, one
// stderr event per decision, Ollama and "local" treated as local providers,
// and policy version 1.
type Config struct {
	// DefaultAction is ActionBlock (default) or ActionRedact.
	DefaultAction Action
	// Allowlist holds pattern class names whose matches are reported in the
	// decision event but are not blocked. Entries are class names, never
	// secret values, so an entry is visible and reviewable.
	Allowlist []string
	// LocalProviders lists provider ids allowed under confidential mode.
	// Defaults to "ollama" and "local". The value "ollama" also matches
	// "ollama/<model>".
	LocalProviders []string
	// PolicyVersion is emitted in headers and decision events. Defaults to
	// PolicyVersionDefault.
	PolicyVersion string
	// Sink receives one JSON decision event per request. Defaults to stderr.
	Sink io.Writer
	// MaxScanBytes bounds the body scan. Larger bodies fail closed.
	MaxScanBytes int
	// Now is injectable for tests. Defaults to time.Now.
	Now func() time.Time
}

// PolicyPlane is the concurrent-safe implementation of both hooks.
type PolicyPlane struct {
	version        string
	action         Action
	allowlist      map[string]struct{}
	localProviders map[string]struct{}
	sink           io.Writer
	maxScanBytes   int
	now            func() time.Time
	writeMu        sync.Mutex
}

// NewPolicyPlane validates the configuration and returns a ready plane.
func NewPolicyPlane(cfg Config) (*PolicyPlane, error) {
	action := cfg.DefaultAction
	if action == "" {
		action = ActionBlock
	}
	if action != ActionBlock && action != ActionRedact {
		return nil, fmt.Errorf("%s: unsupported default action %q", PluginName, action)
	}

	version := cfg.PolicyVersion
	if version == "" {
		version = PolicyVersionDefault
	}

	sink := cfg.Sink
	if sink == nil {
		sink = os.Stderr
	}

	maxScan := cfg.MaxScanBytes
	if maxScan <= 0 {
		maxScan = defaultMaxScanBytes
	}

	now := cfg.Now
	if now == nil {
		now = time.Now
	}

	locals := cfg.LocalProviders
	if len(locals) == 0 {
		locals = []string{"ollama", "local"}
	}

	plane := &PolicyPlane{
		version:        version,
		action:         action,
		allowlist:      make(map[string]struct{}, len(cfg.Allowlist)),
		localProviders: make(map[string]struct{}, len(locals)),
		sink:           sink,
		maxScanBytes:   maxScan,
		now:            now,
	}
	for _, class := range cfg.Allowlist {
		if class = strings.ToLower(strings.TrimSpace(class)); class != "" {
			plane.allowlist[class] = struct{}{}
		}
	}
	for _, provider := range locals {
		if provider = strings.ToLower(strings.TrimSpace(provider)); provider != "" {
			plane.localProviders[provider] = struct{}{}
		}
	}
	return plane, nil
}

// GetName reports the plugin name to Bifrost.
func (p *PolicyPlane) GetName() string {
	return PluginName
}

var (
	_ PreLLMHook                       = (*PolicyPlane)(nil)
	_ HTTPTransportResponseHeadersHook = (*PolicyPlane)(nil)
)

// PreLLMHook enforces the confidential guard and scans the serialized body.
// It emits exactly one decision event per request and fails closed.
func (p *PolicyPlane) PreLLMHook(_ context.Context, req *LLMRequest) (*LLMRequest, error) {
	if req == nil {
		return nil, &PolicyError{Code: "invalid_request", RuleID: RuleRequest, Message: "nil request"}
	}

	decision := p.baseDecision(req)

	if decision.Confidential && !p.isLocalProvider(req.Provider) {
		decision.Action = ActionBlock
		decision.RuleID = RuleConfidentialGuard
		decision.Reason = "confidential request may only use a local provider"
		return req, p.finalize(req, decision)
	}

	matches, err := p.scan(req.Body)
	if err != nil {
		decision.Action = ActionBlock
		decision.RuleID = RuleScannerError
		decision.Reason = "scanner error: " + err.Error()
		decision.PatternClasses = []string{"scanner-error"}
		return req, p.finalize(req, decision)
	}

	blocked := make([]secretMatch, 0, len(matches))
	allowed := make([]string, 0, len(matches))
	seenAllowed := make(map[string]struct{}, len(matches))
	for _, match := range matches {
		if p.isAllowlisted(match.class) {
			if _, ok := seenAllowed[match.class]; !ok {
				seenAllowed[match.class] = struct{}{}
				allowed = append(allowed, match.class)
			}
			continue
		}
		blocked = append(blocked, match)
	}
	decision.AllowlistedClasses = allowed

	if len(blocked) == 0 {
		decision.Action = ActionAllow
		decision.RuleID = RuleSecretScan
		decision.Reason = "no secret patterns"
		if len(allowed) > 0 {
			decision.Reason = "matched classes are allowlisted"
		}
		return req, p.finalize(req, decision)
	}

	classes, hashes := summarize(blocked)
	decision.PatternClasses = classes
	decision.SecretHashes = hashes

	if p.action == ActionRedact && !decision.Confidential {
		req.Body = redactMatches(req.Body, blocked)
		decision.Action = ActionRedact
		decision.RuleID = RuleSecretScan
		decision.Reason = "redacted secret patterns before forwarding"
		return req, p.finalize(req, decision)
	}

	decision.Action = ActionBlock
	decision.RuleID = RuleSecretScan
	decision.Reason = "secret pattern matched before egress"
	return req, p.finalize(req, decision)
}

// HTTPTransportResponseHeadersHook adds the policy headers to the response.
// It refuses to add a "clean" header when no decision exists, because an
// unscanned request must not look scanned.
func (p *PolicyPlane) HTTPTransportResponseHeadersHook(_ context.Context, req *LLMRequest, headers http.Header) error {
	if headers == nil {
		return &PolicyError{Code: "invalid_response", RuleID: RuleRequest, Message: "nil response headers"}
	}
	if req == nil || req.Decision == nil {
		return &PolicyError{
			Code:    "missing_decision",
			RuleID:  RuleRequest,
			Message: "request did not pass the policy pre-hook, refusing to emit a clean DLP header",
		}
	}
	headers.Set(HeaderPolicyVersion, p.version)
	headers.Set(HeaderPolicy, req.Decision.PolicyValue())
	headers.Set(HeaderDLP, req.Decision.DLPValue())
	return nil
}

// finalize records the decision on the request, emits the audit event, and
// turns a block into a structured error. If the audit event cannot be written,
// the request is blocked: a decision that cannot be recorded must not egress.
func (p *PolicyPlane) finalize(req *LLMRequest, decision Decision) error {
	req.Decision = &decision
	if err := p.emit(decision); err != nil {
		blocked := decision
		blocked.Action = ActionBlock
		blocked.RuleID = RuleAuditSinkError
		blocked.Reason = "policy decision sink unavailable, failing closed"
		blocked.PatternClasses = []string{"audit-sink-error"}
		blocked.SecretHashes = nil
		req.Decision = &blocked
		return blockedError(blocked)
	}
	if decision.Action == ActionBlock {
		return blockedError(decision)
	}
	return nil
}

// decisionEvent is the JSON shape written to the sink. It has no prompt or
// body field by construction.
type decisionEvent struct {
	Event              string   `json:"event"`
	Timestamp          string   `json:"timestamp"`
	PolicyVersion      string   `json:"policy_version"`
	RuleID             string   `json:"rule_id"`
	Action             Action   `json:"action"`
	Reason             string   `json:"reason"`
	Provider           string   `json:"provider"`
	Model              string   `json:"model"`
	Confidential       bool     `json:"confidential"`
	PatternClasses     []string `json:"pattern_classes,omitempty"`
	AllowlistedClasses []string `json:"allowlisted_classes,omitempty"`
	SecretHashes       []string `json:"secret_hashes,omitempty"`
	RequestID          string   `json:"request_id,omitempty"`
}

// emit writes exactly one newline-delimited JSON event. The mutex serializes
// concurrent requests that share one sink.
func (p *PolicyPlane) emit(decision Decision) error {
	event := decisionEvent{
		Event:              EventPolicyDecision,
		Timestamp:          decision.At.Format(time.RFC3339Nano),
		PolicyVersion:      p.version,
		RuleID:             decision.RuleID,
		Action:             decision.Action,
		Reason:             decision.Reason,
		Provider:           decision.Provider,
		Model:              decision.Model,
		Confidential:       decision.Confidential,
		PatternClasses:     decision.PatternClasses,
		AllowlistedClasses: decision.AllowlistedClasses,
		SecretHashes:       decision.SecretHashes,
		RequestID:          decision.RequestID,
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	payload = append(payload, '\n')

	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	written, err := p.sink.Write(payload)
	if err != nil {
		return err
	}
	if written != len(payload) {
		return io.ErrShortWrite
	}
	return nil
}

// blockedError builds the structured rejection for a blocked decision.
func blockedError(decision Decision) error {
	code := "dlp_blocked"
	switch decision.RuleID {
	case RuleConfidentialGuard:
		code = "confidential_violation"
	case RuleScannerError:
		code = "dlp_scanner_error"
	case RuleAuditSinkError:
		code = "dlp_audit_sink_error"
	}
	policyErr := &PolicyError{
		Code:     code,
		RuleID:   decision.RuleID,
		Message:  decision.Reason,
		Provider: decision.Provider,
		Model:    decision.Model,
	}
	if len(decision.PatternClasses) > 0 {
		policyErr.PatternClass = decision.PatternClasses[0]
	}
	if len(decision.SecretHashes) > 0 {
		policyErr.SecretHash = decision.SecretHashes[0]
	}
	return policyErr
}

func (p *PolicyPlane) baseDecision(req *LLMRequest) Decision {
	return Decision{
		Provider:     req.Provider,
		Model:        req.Model,
		Confidential: headerIsTrue(req.Headers, HeaderConfidential),
		RequestID:    requestID(req.Headers),
		At:           p.now().UTC(),
	}
}

func (p *PolicyPlane) isLocalProvider(provider string) bool {
	name := strings.ToLower(strings.TrimSpace(provider))
	if name == "" {
		return false
	}
	if _, ok := p.localProviders[name]; ok {
		return true
	}
	if index := strings.IndexByte(name, '/'); index > 0 {
		_, ok := p.localProviders[name[:index]]
		return ok
	}
	return false
}

func (p *PolicyPlane) isAllowlisted(class string) bool {
	_, ok := p.allowlist[strings.ToLower(class)]
	return ok
}

func headerIsTrue(headers http.Header, name string) bool {
	if headers == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(headers.Get(name)), "true")
}

func requestID(headers http.Header) string {
	if headers == nil {
		return ""
	}
	for _, name := range []string{"x-bf-req-id", "x-bifrost-request-id", "x-request-id"} {
		if value := strings.TrimSpace(headers.Get(name)); value != "" {
			return value
		}
	}
	return ""
}

// secretPattern pairs a stable pattern class with a compiled expression.
type secretPattern struct {
	class string
	re    *regexp.Regexp
}

// secretPatterns is the high-confidence detection set. Order is stable so the
// first reported class is deterministic. It mirrors the TypeScript twin in
// packages/shared/src/redaction.ts.
var secretPatterns = []secretPattern{
	{class: "private-key", re: regexp.MustCompile(`-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----`)},
	{class: "aws-access-key", re: regexp.MustCompile(`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`)},
	{class: "openai-style-key", re: regexp.MustCompile(`\bsk-[A-Za-z0-9_-]{16,}\b`)},
	{class: "github-token", re: regexp.MustCompile(`\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b`)},
	{class: "google-api-key", re: regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)},
	{class: "slack-token", re: regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`)},
	{class: "tavily-key", re: regexp.MustCompile(`\btvly-[A-Za-z0-9]{16,}\b`)},
	{class: "jwt", re: regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b`)},
	{class: "bearer-token", re: regexp.MustCompile(`\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*`)},
	{class: "env-assignment", re: regexp.MustCompile(`\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)=["']?[A-Za-z0-9._~+/-]{20,}["']?`)},
}

// secretMatch is an internal match record. The matched value is not retained
// beyond hashing, so it cannot leak through the decision event.
type secretMatch struct {
	class string
	hash  string
	start int
	end   int
}

// scan returns all matches or an error. Callers must fail closed on error.
func (p *PolicyPlane) scan(body []byte) ([]secretMatch, error) {
	if len(body) == 0 {
		return nil, nil
	}
	if len(body) > p.maxScanBytes {
		return nil, fmt.Errorf("body is %d bytes, scan limit is %d", len(body), p.maxScanBytes)
	}
	if !utf8.Valid(body) {
		return nil, errors.New("body is not valid UTF-8")
	}

	text := string(body)
	matches := make([]secretMatch, 0, 4)
	for _, pattern := range secretPatterns {
		for _, location := range pattern.re.FindAllStringIndex(text, -1) {
			value := text[location[0]:location[1]]
			matches = append(matches, secretMatch{
				class: pattern.class,
				hash:  hashSecret(value),
				start: location[0],
				end:   location[1],
			})
		}
	}
	sort.SliceStable(matches, func(i, j int) bool { return matches[i].start < matches[j].start })
	return matches, nil
}

// hashSecret returns a truncated SHA-256 digest. The prefix makes the value
// self-describing in logs without revealing the secret.
func hashSecret(value string) string {
	sum := sha256.Sum256([]byte(value))
	return "sha256:" + hex.EncodeToString(sum[:])[:16]
}

// redactMatches rewrites the body, replacing each match with a marker that
// names no class and contains no secret.
func redactMatches(body []byte, matches []secretMatch) []byte {
	out := make([]byte, 0, len(body))
	cursor := 0
	for _, match := range matches {
		if match.start < cursor || match.start < 0 || match.end > len(body) || match.end <= match.start {
			continue
		}
		out = append(out, body[cursor:match.start]...)
		out = append(out, redactionMarker...)
		cursor = match.end
	}
	out = append(out, body[cursor:]...)
	return out
}

// summarize returns distinct classes and one truncated hash per match.
func summarize(matches []secretMatch) (classes []string, hashes []string) {
	seen := make(map[string]struct{}, len(matches))
	for _, match := range matches {
		hashes = append(hashes, match.hash)
		if _, ok := seen[match.class]; ok {
			continue
		}
		seen[match.class] = struct{}{}
		classes = append(classes, match.class)
	}
	return classes, hashes
}

func main() {
	fmt.Fprintf(os.Stderr, "%s: Bifrost plugin sources. The build and load mechanism is PENDING; see README.md.\n", PluginName)
}
