package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/maximhq/bifrost/core/schemas"
)

const fakeAWS = "AKIA" + "ABCDEFGHIJKLMNOP"

func newTestContext() *schemas.BifrostContext {
	return schemas.NewBifrostContext(context.Background(), time.Time{})
}

func TestGetNameAndCleanup(t *testing.T) {
	plugin := New()
	if plugin.GetName() != pluginName {
		t.Fatalf("unexpected name %q", plugin.GetName())
	}
	if err := plugin.Cleanup(); err != nil {
		t.Fatalf("cleanup: %v", err)
	}
}

func TestHTTPPreHookBlocksSecret(t *testing.T) {
	plugin := New()
	req := &schemas.HTTPRequest{
		Method:  "POST",
		Path:    "/v1/chat/completions",
		Headers: map[string]string{"content-type": "application/json"},
		Body:    []byte(`{"model":"fireworks/x","messages":[{"content":"deploy ` + fakeAWS + `"}]}`),
	}
	resp, err := plugin.HTTPTransportPreHook(newTestContext(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected a short-circuit response for a secret")
	}
	if resp.StatusCode != 451 {
		t.Fatalf("expected 451, got %d", resp.StatusCode)
	}
	if !strings.Contains(resp.Headers["x-gidorah-dlp"], "blocked:aws-access-key") {
		t.Fatalf("unexpected dlp header %q", resp.Headers["x-gidorah-dlp"])
	}
	if strings.Contains(string(resp.Body), fakeAWS) {
		t.Fatal("secret value leaked into the response body")
	}
}

func TestHTTPPreHookAllowsCleanRequest(t *testing.T) {
	plugin := New()
	req := &schemas.HTTPRequest{Method: "POST", Path: "/v1/chat/completions", Headers: map[string]string{}, Body: []byte(`{"model":"ollama/qwen2.5-coder:3b","messages":[{"content":"fix the test"}]}`)}
	resp, err := plugin.HTTPTransportPreHook(newTestContext(), req)
	if err != nil || resp != nil {
		t.Fatalf("expected passthrough, got resp=%v err=%v", resp, err)
	}
}

func TestHTTPPreHookConfidentialGuard(t *testing.T) {
	plugin := New()
	cloud := &schemas.HTTPRequest{
		Method:  "POST",
		Headers: map[string]string{headerConfid: "true"},
		Body:    []byte(`{"model":"fireworks/accounts/fireworks/models/deepseek-v4p1-flash","messages":[]}`),
	}
	resp, err := plugin.HTTPTransportPreHook(newTestContext(), cloud)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil || resp.StatusCode != 403 {
		t.Fatalf("expected 403 short-circuit, got %+v", resp)
	}

	local := &schemas.HTTPRequest{
		Method:  "POST",
		Headers: map[string]string{headerConfid: "true"},
		Body:    []byte(`{"model":"ollama/qwen2.5-coder:3b","messages":[]}`),
	}
	resp, err = plugin.HTTPTransportPreHook(newTestContext(), local)
	if err != nil || resp != nil {
		t.Fatalf("local confidential request must pass, got resp=%+v err=%v", resp, err)
	}
}

func TestResponseHeadersHookAddsPolicyHeaders(t *testing.T) {
	plugin := New()
	req := &schemas.HTTPRequest{Headers: map[string]string{headerConfid: "true"}, Body: []byte(`{"model":"ollama/qwen"}`)}
	meta := &schemas.HTTPResponseMetadata{StatusCode: 200, Headers: map[string]string{}}
	if err := plugin.HTTPTransportResponseHeadersHook(newTestContext(), req, meta); err != nil {
		t.Fatalf("hook error: %v", err)
	}
	if meta.Headers["x-gidorah-policy"] != "confidential-local-only" {
		t.Fatalf("policy header = %q", meta.Headers["x-gidorah-policy"])
	}
	if meta.Headers["x-gidorah-dlp"] != "clean" {
		t.Fatalf("dlp header = %q", meta.Headers["x-gidorah-dlp"])
	}
	if meta.Headers["x-gidorah-policy-version"] != "1" {
		t.Fatalf("policy version = %q", meta.Headers["x-gidorah-policy-version"])
	}
}

func TestLLMHooksAreSafeOnCleanRequest(t *testing.T) {
	plugin := New()
	req := &schemas.BifrostRequest{}
	if err := plugin.PreRequestHook(newTestContext(), req); err != nil {
		t.Fatalf("pre-request hook error: %v", err)
	}
	updated, shortCircuit, err := plugin.PreLLMHook(newTestContext(), req)
	if err != nil {
		t.Fatalf("pre-llm hook error: %v", err)
	}
	if updated != req {
		t.Fatal("pre-llm hook should return the request unchanged")
	}
	if shortCircuit != nil {
		t.Fatalf("clean request short-circuited: %+v", shortCircuit)
	}
	_, _, err = plugin.PostLLMHook(newTestContext(), nil, nil)
	if err != nil {
		t.Fatalf("post-llm hook error: %v", err)
	}
}
