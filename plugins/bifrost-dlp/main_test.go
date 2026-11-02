package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

// Synthetic fixtures are assembled at run time so repository secret scanners
// and scripts/lint.ts do not flag this file. None of these values is real, and
// none grants access to any service.
func fakeAWSKey() string {
	return "AKIA" + "IOSFODNN7EXAMPLE"
}

func fakePrivateKey() string {
	return "-----BEGIN " + "RSA PRIVATE KEY-----\n" +
		"MIIBOgIBAAJBAKfakefakefakefakefakefakefakefakefakefakefakefake\n" +
		"-----END " + "RSA PRIVATE KEY-----\n"
}

func fakeEnvAssignment() string {
	return "SOME_FAKE_TOKEN=" + "Zx9Qm2Lp7Rt4Vb8Nc3Wd6Ks1"
}

func testPlane(t *testing.T, mutate func(*Config)) (*PolicyPlane, *bytes.Buffer) {
	t.Helper()
	buffer := &bytes.Buffer{}
	cfg := Config{
		Sink: buffer,
		Now: func() time.Time {
			return time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
		},
	}
	if mutate != nil {
		mutate(&cfg)
	}
	plane, err := NewPolicyPlane(cfg)
	if err != nil {
		t.Fatalf("NewPolicyPlane: %v", err)
	}
	return plane, buffer
}

func newRequest(provider, model, body string, confidential bool) *LLMRequest {
	headers := http.Header{}
	if confidential {
		headers.Set(HeaderConfidential, "true")
	}
	return &LLMRequest{Provider: provider, Model: model, Body: []byte(body), Headers: headers}
}

func countLines(text string) int {
	trimmed := strings.TrimSuffix(text, "\n")
	if trimmed == "" {
		return 0
	}
	return len(strings.Split(trimmed, "\n"))
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

type hookCase struct {
	name             string
	provider         string
	confidential     bool
	body             string
	configure        func(*Config)
	wantErr          bool
	wantCode         string
	wantAction       Action
	wantClass        string
	wantAllowlisted  string
	wantRedacted     bool
	wantPolicyHeader string
	wantDLPHeader    string
}

func TestPreLLMHook(t *testing.T) {
	cases := []hookCase{
		{
			name:             "fake aws access key is blocked",
			provider:         "deepseek",
			body:             "please deploy with " + fakeAWSKey() + " attached",
			wantErr:          true,
			wantCode:         "dlp_blocked",
			wantAction:       ActionBlock,
			wantClass:        "aws-access-key",
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "blocked:aws-access-key",
		},
		{
			name:             "private key block is blocked",
			provider:         "deepseek",
			body:             "config:\n" + fakePrivateKey() + "done",
			wantErr:          true,
			wantCode:         "dlp_blocked",
			wantAction:       ActionBlock,
			wantClass:        "private-key",
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "blocked:private-key",
		},
		{
			name:             "clean prompt passes",
			provider:         "deepseek",
			body:             "refactor the parser and run the tests",
			wantAction:       ActionAllow,
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "clean",
		},
		{
			name:     "false positive allowlist suppresses a class",
			provider: "deepseek",
			body:     fakeEnvAssignment(),
			configure: func(cfg *Config) {
				cfg.Allowlist = []string{"env-assignment"}
			},
			wantAction:       ActionAllow,
			wantAllowlisted:  "env-assignment",
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "clean",
		},
		{
			name:     "allowlist is scoped to its class",
			provider: "deepseek",
			body:     "leak " + fakeAWSKey(),
			configure: func(cfg *Config) {
				cfg.Allowlist = []string{"env-assignment"}
			},
			wantErr:          true,
			wantCode:         "dlp_blocked",
			wantAction:       ActionBlock,
			wantClass:        "aws-access-key",
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "blocked:aws-access-key",
		},
		{
			name:             "confidential header with cloud provider is rejected",
			provider:         "deepseek",
			confidential:     true,
			body:             "summarize the internal design",
			wantErr:          true,
			wantCode:         "confidential_violation",
			wantAction:       ActionBlock,
			wantPolicyHeader: PolicyConfidentialLocalOnly,
			wantDLPHeader:    "blocked:policy",
		},
		{
			name:             "confidential header with ollama is allowed",
			provider:         "ollama/qwen2.5-coder:3b",
			confidential:     true,
			body:             "summarize the internal design",
			wantAction:       ActionAllow,
			wantPolicyHeader: PolicyConfidentialLocalOnly,
			wantDLPHeader:    "clean",
		},
		{
			name:         "confidential mode blocks even when redact is configured",
			provider:     "ollama/qwen2.5-coder:3b",
			confidential: true,
			body:         fakeEnvAssignment(),
			configure: func(cfg *Config) {
				cfg.DefaultAction = ActionRedact
			},
			wantErr:          true,
			wantCode:         "dlp_blocked",
			wantAction:       ActionBlock,
			wantClass:        "env-assignment",
			wantPolicyHeader: PolicyConfidentialLocalOnly,
			wantDLPHeader:    "blocked:env-assignment",
		},
		{
			name:             "redact mode rewrites a non-confidential body",
			provider:         "deepseek",
			body:             "key " + fakeAWSKey(),
			configure:        func(cfg *Config) { cfg.DefaultAction = ActionRedact },
			wantAction:       ActionRedact,
			wantClass:        "aws-access-key",
			wantRedacted:     true,
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "redacted:aws-access-key",
		},
		{
			name:             "invalid utf8 fails closed",
			provider:         "deepseek",
			body:             string([]byte{0xff, 0xfe, 0xfd}),
			wantErr:          true,
			wantCode:         "dlp_scanner_error",
			wantAction:       ActionBlock,
			wantClass:        "scanner-error",
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "blocked:scanner-error",
		},
		{
			name:     "oversized body fails closed",
			provider: "deepseek",
			body:     strings.Repeat("a", 64),
			configure: func(cfg *Config) {
				cfg.MaxScanBytes = 16
			},
			wantErr:          true,
			wantCode:         "dlp_scanner_error",
			wantAction:       ActionBlock,
			wantClass:        "scanner-error",
			wantPolicyHeader: PolicyStandard,
			wantDLPHeader:    "blocked:scanner-error",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			plane, buffer := testPlane(t, tc.configure)
			req := newRequest(tc.provider, "deepseek-flash", tc.body, tc.confidential)

			_, err := plane.PreLLMHook(context.Background(), req)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected a policy error, got nil")
				}
				var policyErr *PolicyError
				if !errors.As(err, &policyErr) {
					t.Fatalf("expected *PolicyError, got %T: %v", err, err)
				}
				if policyErr.Code != tc.wantCode {
					t.Fatalf("code = %q, want %q", policyErr.Code, tc.wantCode)
				}
				if policyErr.PatternClass != tc.wantClass {
					t.Fatalf("pattern class = %q, want %q", policyErr.PatternClass, tc.wantClass)
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if req.Decision == nil {
				t.Fatalf("decision was not recorded on the request")
			}
			if req.Decision.Action != tc.wantAction {
				t.Fatalf("action = %q, want %q", req.Decision.Action, tc.wantAction)
			}
			if tc.wantClass != "" && !containsString(req.Decision.PatternClasses, tc.wantClass) {
				t.Fatalf("pattern classes = %v, want %q", req.Decision.PatternClasses, tc.wantClass)
			}
			if tc.wantAllowlisted != "" && !containsString(req.Decision.AllowlistedClasses, tc.wantAllowlisted) {
				t.Fatalf("allowlisted classes = %v, want %q", req.Decision.AllowlistedClasses, tc.wantAllowlisted)
			}
			if tc.wantRedacted {
				body := string(req.Body)
				if strings.Contains(body, fakeAWSKey()) {
					t.Fatalf("redacted body still contains the secret: %q", body)
				}
				if !strings.Contains(body, redactionMarker) {
					t.Fatalf("redacted body is missing the marker: %q", body)
				}
			}

			headers := http.Header{}
			if err := plane.HTTPTransportResponseHeadersHook(context.Background(), req, headers); err != nil {
				t.Fatalf("response header hook: %v", err)
			}
			if got := headers.Get(HeaderPolicyVersion); got != PolicyVersionDefault {
				t.Fatalf("policy version header = %q, want %q", got, PolicyVersionDefault)
			}
			if got := headers.Get(HeaderPolicy); got != tc.wantPolicyHeader {
				t.Fatalf("policy header = %q, want %q", got, tc.wantPolicyHeader)
			}
			if got := headers.Get(HeaderDLP); got != tc.wantDLPHeader {
				t.Fatalf("dlp header = %q, want %q", got, tc.wantDLPHeader)
			}
			if got := countLines(buffer.String()); got != 1 {
				t.Fatalf("decision events = %d, want exactly 1", got)
			}
		})
	}
}

func TestPatternClasses(t *testing.T) {
	cases := []struct {
		name  string
		body  string
		class string
	}{
		{
			name:  "aws access key",
			body:  fakeAWSKey(),
			class: "aws-access-key",
		},
		{
			name:  "private key",
			body:  fakePrivateKey(),
			class: "private-key",
		},
		{
			name:  "openai style key",
			body:  "sk-" + "live_" + strings.Repeat("a", 24),
			class: "openai-style-key",
		},
		{
			name:  "github token",
			body:  "ghp_" + strings.Repeat("a", 36),
			class: "github-token",
		},
		{
			name:  "google api key",
			body:  "AIza" + strings.Repeat("b", 35),
			class: "google-api-key",
		},
		{
			name:  "slack token",
			body:  "xoxb-" + strings.Repeat("c", 12),
			class: "slack-token",
		},
		{
			name:  "tavily key",
			body:  "tvly-" + strings.Repeat("d", 20),
			class: "tavily-key",
		},
		{
			name:  "jwt",
			body:  "eyJ" + strings.Repeat("e", 12) + "." + strings.Repeat("f", 12) + "." + strings.Repeat("g", 12),
			class: "jwt",
		},
		{
			name:  "bearer token",
			body:  "Bearer " + strings.Repeat("h", 24),
			class: "bearer-token",
		},
		{
			name:  "env assignment",
			body:  "API_TOKEN=" + strings.Repeat("i", 24),
			class: "env-assignment",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			plane, _ := testPlane(t, nil)
			req := newRequest("deepseek", "deepseek-flash", tc.body, false)
			if _, err := plane.PreLLMHook(context.Background(), req); err == nil {
				t.Fatalf("expected %q to be blocked", tc.class)
			}
			if req.Decision == nil || !containsString(req.Decision.PatternClasses, tc.class) {
				t.Fatalf("pattern classes = %v, want %q", req.Decision.PatternClasses, tc.class)
			}
		})
	}
}

func TestDecisionJSONNeverContainsSecret(t *testing.T) {
	plane, buffer := testPlane(t, nil)
	prompt := "please deploy the key " + fakeAWSKey() + " and this block\n" + fakePrivateKey() + "\nSENTINEL_PROMPT_TEXT"
	req := newRequest("deepseek", "deepseek-pro", prompt, false)
	req.Headers.Set("x-bf-req-id", "req-test-1")

	if _, err := plane.PreLLMHook(context.Background(), req); err == nil {
		t.Fatalf("expected the request to be blocked")
	}

	emitted := buffer.String()
	for _, secret := range []string{fakeAWSKey(), fakePrivateKey(), "MIIBOgIBAAJBAK", "SENTINEL_PROMPT_TEXT"} {
		if strings.Contains(emitted, secret) {
			t.Fatalf("decision JSON leaked %q: %s", secret, emitted)
		}
	}

	lines := strings.Split(strings.TrimSuffix(emitted, "\n"), "\n")
	if len(lines) != 1 {
		t.Fatalf("decision events = %d, want 1", len(lines))
	}

	var event map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &event); err != nil {
		t.Fatalf("decision event is not valid JSON: %v", err)
	}
	if event["event"] != EventPolicyDecision {
		t.Fatalf("event = %v, want %q", event["event"], EventPolicyDecision)
	}
	if event["policy_version"] != PolicyVersionDefault {
		t.Fatalf("policy version = %v, want %q", event["policy_version"], PolicyVersionDefault)
	}
	if event["action"] != string(ActionBlock) {
		t.Fatalf("action = %v, want %q", event["action"], ActionBlock)
	}
	if event["provider"] != "deepseek" {
		t.Fatalf("provider = %v, want deepseek", event["provider"])
	}
	if event["model"] != "deepseek-pro" {
		t.Fatalf("model = %v, want deepseek-pro", event["model"])
	}
	if event["request_id"] != "req-test-1" {
		t.Fatalf("request id = %v, want req-test-1", event["request_id"])
	}
	if _, ok := event["body"]; ok {
		t.Fatalf("decision event must not contain a body field")
	}
	if _, ok := event["prompt"]; ok {
		t.Fatalf("decision event must not contain a prompt field")
	}
	if _, err := time.Parse(time.RFC3339Nano, event["timestamp"].(string)); err != nil {
		t.Fatalf("timestamp is not RFC3339Nano: %v", err)
	}

	classes, ok := event["pattern_classes"].([]any)
	if !ok {
		t.Fatalf("pattern_classes is not a list: %v", event["pattern_classes"])
	}
	for _, want := range []string{"aws-access-key", "private-key"} {
		found := false
		for _, value := range classes {
			if value == want {
				found = true
			}
		}
		if !found {
			t.Fatalf("pattern_classes = %v, want to include %q", classes, want)
		}
	}

	hashes, ok := event["secret_hashes"].([]any)
	if !ok || len(hashes) == 0 {
		t.Fatalf("secret_hashes is missing or empty: %v", event["secret_hashes"])
	}
	for _, value := range hashes {
		hash, ok := value.(string)
		if !ok {
			t.Fatalf("hash is not a string: %v", value)
		}
		if !strings.HasPrefix(hash, "sha256:") {
			t.Fatalf("hash = %q, want sha256 prefix", hash)
		}
		if len(hash) != len("sha256:")+16 {
			t.Fatalf("hash = %q, want a truncated 16 hex character digest", hash)
		}
	}
}

func TestResponseHeaderHookRequiresDecision(t *testing.T) {
	plane, _ := testPlane(t, nil)
	req := newRequest("deepseek", "deepseek-flash", "clean", false)

	err := plane.HTTPTransportResponseHeadersHook(context.Background(), req, http.Header{})
	if err == nil {
		t.Fatalf("expected an error when the request has no policy decision")
	}
	var policyErr *PolicyError
	if !errors.As(err, &policyErr) || policyErr.Code != "missing_decision" {
		t.Fatalf("expected missing_decision, got %v", err)
	}
}

func TestPreLLMHookNilRequest(t *testing.T) {
	plane, _ := testPlane(t, nil)
	if _, err := plane.PreLLMHook(context.Background(), nil); err == nil {
		t.Fatalf("expected an error for a nil request")
	}
}

func TestPolicyPlaneConcurrentUse(t *testing.T) {
	plane, buffer := testPlane(t, nil)
	const workers = 16
	const perWorker = 4

	var wait sync.WaitGroup
	wait.Add(workers)
	for worker := 0; worker < workers; worker++ {
		go func(index int) {
			defer wait.Done()
			for iteration := 0; iteration < perWorker; iteration++ {
				body := "clean prompt"
				if (index+iteration)%2 == 0 {
					body = "leak " + fakeAWSKey()
				}
				req := newRequest("deepseek", "deepseek-flash", body, false)
				_, _ = plane.PreLLMHook(context.Background(), req)
			}
		}(worker)
	}
	wait.Wait()

	if got := countLines(buffer.String()); got != workers*perWorker {
		t.Fatalf("decision events = %d, want %d", got, workers*perWorker)
	}
	for _, line := range strings.Split(strings.TrimSuffix(buffer.String(), "\n"), "\n") {
		var event map[string]any
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			t.Fatalf("concurrent decision event is not valid JSON: %v", err)
		}
	}
}

func TestGetName(t *testing.T) {
	plane, _ := testPlane(t, nil)
	if got := plane.GetName(); got != PluginName {
		t.Fatalf("GetName() = %q, want %q", got, PluginName)
	}
}

func TestNewPolicyPlaneRejectsUnknownAction(t *testing.T) {
	if _, err := NewPolicyPlane(Config{DefaultAction: Action("drop")}); err == nil {
		t.Fatalf("expected an error for an unknown default action")
	}
}
