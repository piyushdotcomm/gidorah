// Gidorah Bifrost DLP/policy plugin, bound to the real Bifrost plugin SDK.
//
// Implements schemas.LLMPlugin and schemas.HTTPTransportPlugin from
// github.com/maximhq/bifrost/core/schemas. Two independent controls sit at the
// last point before egress:
//
//  1. Confidential guard: a request marked x-gidorah-confidential may only use a
//     local (ollama) model. A cloud model short-circuits with 403 before the
//     provider call, even if the virtual key were misconfigured.
//  2. DLP: the serialized request body is scanned for secret patterns. Default
//     action is block with 451; only the pattern class and a truncated SHA-256
//     hash are logged, never the value.
//
// No stream-sized state is stored on the BifrostContext; the response-header
// hook re-derives its verdict from the small request body it already receives.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"

	"github.com/maximhq/bifrost/core/schemas"
)

const (
	pluginName   = "gidorah-dlp"
	headerConfid = "x-gidorah-confidential"
)

type secretPattern struct {
	class string
	re    *regexp.Regexp
}

var secretPatterns = []secretPattern{
	{"aws-access-key", regexp.MustCompile(`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`)},
	{"openai-style-key", regexp.MustCompile(`\bsk-[A-Za-z0-9_-]{16,}\b`)},
	{"github-token", regexp.MustCompile(`\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b`)},
	{"google-api-key", regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)},
	{"slack-token", regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`)},
	{"tavily-key", regexp.MustCompile(`\btvly-[A-Za-z0-9-]{16,}\b`)},
	{"jwt", regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b`)},
	{"bearer-token", regexp.MustCompile(`(?i)\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*`)},
	{"private-key", regexp.MustCompile(`(?s)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----.*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----`)},
	{"env-assignment", regexp.MustCompile(`\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)=["']?[A-Za-z0-9._~+/-]{20,}["']?`)},
}

var cloudProvider = regexp.MustCompile(`(?i)\b(fireworks|openai|anthropic|deepseek|gemini|groq|azure|bedrock|vertex|mistral|cohere|perplexity|openrouter|xai)\b`)

// Decision is the audit event: pattern class and hash only, no content.
type Decision struct {
	Action string `json:"action"`
	Class  string `json:"class,omitempty"`
	Hash   string `json:"hash,omitempty"`
}

type Plugin struct {
	name      string
	mu        sync.Mutex
	decisions []Decision
	sink      *os.File
}

func New() *Plugin { return &Plugin{name: pluginName, sink: os.Stderr} }

func (p *Plugin) GetName() string { return p.name }
func (p *Plugin) Cleanup() error  { return nil }

func shortHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:12]
}

func scanSecrets(body []byte) (class, hash string) {
	text := string(body)
	for _, pattern := range secretPatterns {
		if match := pattern.re.FindString(text); match != "" {
			return pattern.class, shortHash(match)
		}
	}
	return "", ""
}

func modelFromBody(body []byte) string {
	var parsed map[string]json.RawMessage
	if err := json.Unmarshal(body, &parsed); err != nil {
		return ""
	}
	raw, ok := parsed["model"]
	if !ok {
		return ""
	}
	var model string
	if err := json.Unmarshal(raw, &model); err != nil {
		return ""
	}
	return model
}

// A model is local when it is ollama-qualified or carries no cloud prefix.
func isLocalModel(model string) bool {
	if model == "" {
		return false
	}
	if strings.HasPrefix(strings.ToLower(model), "ollama/") {
		return true
	}
	return !cloudProvider.MatchString(model)
}

func (p *Plugin) record(decision Decision) {
	p.mu.Lock()
	p.decisions = append(p.decisions, decision)
	sink := p.sink
	p.mu.Unlock()
	if sink == nil {
		return
	}
	if encoded, err := json.Marshal(decision); err == nil {
		fmt.Fprintln(sink, string(encoded))
	}
}

func policyHeaders(policy, dlp string) map[string]string {
	return map[string]string{
		"x-gidorah-policy":         policy,
		"x-gidorah-policy-version": "1",
		"x-gidorah-dlp":            dlp,
	}
}

func shortCircuitResponse(status int, errorType, class, hash, message string) *schemas.HTTPResponse {
	body, _ := json.Marshal(map[string]any{
		"error": map[string]string{"type": errorType, "message": message, "class": class},
	})
	headers := policyHeaders("standard", "blocked:"+class)
	headers["content-type"] = "application/json"
	headers["x-gidorah-dlp-hash"] = hash
	return &schemas.HTTPResponse{StatusCode: status, Headers: headers, Body: body}
}

// --- HTTPTransportPlugin -------------------------------------------------

func (p *Plugin) HTTPTransportPreAuthHook(_ *schemas.BifrostContext, _ *schemas.HTTPRequest) (*schemas.HTTPResponse, error) {
	return nil, nil
}

func (p *Plugin) HTTPTransportPreHook(_ *schemas.BifrostContext, req *schemas.HTTPRequest) (*schemas.HTTPResponse, error) {
	if class, hash := scanSecrets(req.Body); class != "" {
		p.record(Decision{Action: "blocked", Class: class, Hash: hash})
		return shortCircuitResponse(451, "dlp_blocked", class, hash, "request blocked by DLP before egress"), nil
	}
	if strings.EqualFold(req.CaseInsensitiveHeaderLookup(headerConfid), "true") {
		model := modelFromBody(req.Body)
		if !isLocalModel(model) {
			p.record(Decision{Action: "blocked", Class: "confidential"})
			return shortCircuitResponse(403, "confidential_violation", "confidential", "", "confidential request may not reach a cloud model"), nil
		}
	}
	return nil, nil
}

func (p *Plugin) HTTPTransportPostHook(_ *schemas.BifrostContext, _ *schemas.HTTPRequest, _ *schemas.HTTPResponse) error {
	return nil
}

func (p *Plugin) HTTPTransportResponseHeadersHook(_ *schemas.BifrostContext, req *schemas.HTTPRequest, resp *schemas.HTTPResponseMetadata) error {
	if resp == nil {
		return nil
	}
	if resp.Headers == nil {
		resp.Headers = map[string]string{}
	}
	policy := "standard"
	if strings.EqualFold(req.CaseInsensitiveHeaderLookup(headerConfid), "true") {
		policy = "confidential-local-only"
	}
	dlp := "clean"
	if class, _ := scanSecrets(req.Body); class != "" {
		dlp = "blocked:" + class
	}
	for key, value := range policyHeaders(policy, dlp) {
		resp.Headers[key] = value
	}
	return nil
}

func (p *Plugin) HTTPTransportStreamChunkHook(_ *schemas.BifrostContext, _ *schemas.HTTPRequest, chunk *schemas.BifrostStreamChunk) (*schemas.BifrostStreamChunk, error) {
	return chunk, nil
}

// --- LLMPlugin -----------------------------------------------------------

func (p *Plugin) PreRequestHook(_ *schemas.BifrostContext, _ *schemas.BifrostRequest) error { return nil }

func (p *Plugin) PreLLMHook(_ *schemas.BifrostContext, req *schemas.BifrostRequest) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error) {
	serialized, err := json.Marshal(req)
	if err != nil {
		return req, nil, nil
	}
	if class, hash := scanSecrets(serialized); class != "" {
		p.record(Decision{Action: "blocked", Class: class, Hash: hash})
		return req, &schemas.LLMPluginShortCircuit{Error: &schemas.BifrostError{
			IsBifrostError: true,
			StatusCode:     intPointer(451),
			Error:          &schemas.ErrorField{Type: stringPointer("dlp_blocked"), Message: "request blocked by DLP before egress"},
		}}, nil
	}
	return req, nil, nil
}

func (p *Plugin) PostLLMHook(_ *schemas.BifrostContext, resp *schemas.BifrostResponse, bifrostErr *schemas.BifrostError) (*schemas.BifrostResponse, *schemas.BifrostError, error) {
	return resp, bifrostErr, nil
}

func intPointer(value int) *int          { return &value }
func stringPointer(value string) *string { return &value }

var _ schemas.LLMPlugin = (*Plugin)(nil)
var _ schemas.HTTPTransportPlugin = (*Plugin)(nil)

// main exists so go build/vet validate the package. Bifrost loads the plugin as
// a shared object (see README for build flags).
func main() { _ = New() }
