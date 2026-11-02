# Pre-Mortem

**Status:** Draft · **Owner:** Delivery · **Last updated:** 2026-11-03

It is three months after the hackathon. Gidorah failed to win. Why? This pre-mortem lists the most likely failure modes, the early warning signs, and the mitigations already in the plan.

---

## 1. Failure: it was a wrapper, not a control plane

**Story:** The demo showed a chat UI and a budget banner, but judges saw an OpenCode-style agent with Bifrost as a proxy and Tavily as a search tool. There was no unique mechanism.

**Early signs**
- The pitch starts with “an AI coding agent” instead of “a control plane for coding agents.”
- Bifrost is described as a provider, not as the budget/confidentiality/failover enforcement plane.
- Tavily is a `web_search` tool, not a budgeted, cited correctness layer.
- No DLP plugin, no Docs Guard, no flight recorder.

**Mitigations**
- Lead with the dual-plane thesis and the two enforcement layers.
- Demo the gateway DLP block and the Tavily side-by-side.
- Show the flight recorder, not just the chat.
- Contribute the Bifrost plugin and benchmark.

---

## 2. Failure: the benchmark showed no savings

**Story:** The full agent cost the same as always-Pro, or cost more because compaction invalidated the cache. The headline number was missing, so the token-efficiency claim collapsed.

**Early signs**
- No pilot before the full run.
- Cost reported per run, not per successful task.
- Cache read/write ignored.
- Compaction enabled by default.
- Tavily called on repo-local tasks.

**Mitigations**
- Run the 3-task pilot first.
- Cap tool output before compacting; measure cache impact.
- Report cost per successful task and price-per-task variance.
- Make Class A zero-Tavily a gate.
- Publish negative results and cut losing levers.

---

## 2a. Failure: Code Mode bypassed the approval gate

**Story:** The team enabled Bifrost Code Mode for all tools to chase a token number. A write or shell command ran without the approval modal, and the security story collapsed.

**Early signs**
- MCP auto-execute enabled for mutating tools.
- Approval tests only cover native tools.
- No read-only allowlist.
- Code Mode adopted before the benchmark.

**Mitigations**
- Read-only tools only; writes/shell/git stay native.
- No MCP auto-execute for mutations.
- Add a conformance test for the Code Mode boundary.
- Cut the arm if it does not improve cost per solved task.

---

## 2b. Failure: the audit chain was overclaimed

**Story:** The team said the audit log was “tamper-proof.” A judge pointed out that a hash chain inside the same process can be rewritten, and the evidence claim collapsed.

**Early signs**
- “Tamper-proof” in the pitch.
- No external anchor.
- No key separation.
- No tamper test.

**Mitigations**
- Say “tamper-evident,” not “tamper-proof.”
- Anchor the chain head at turn boundaries and in CI artifacts.
- Document the limitation: an operator with write access can rewrite the chain.
- Show `audit verify` failing on a tampered fixture.

---

## 2c. Failure: the red-team corpus was too weak

**Story:** The suite passed 20/20, but a judge tried one injection the corpus missed and the policy failed.

**Early signs**
- Only direct prompt injections.
- No file/tool/web indirect injections.
- No canary egress scan.
- No negative controls.

**Mitigations**
- Cover direct, indirect, tool-output, web-result, budget, approval, path, and provider attacks.
- Include a canary and scan every outgoing byte.
- Add a bypass to the corpus immediately.
- Say “regression evidence,” not “unhackable.”

---

## 3. Failure: the TUI ate the schedule

**Story:** The team spent two weeks adapting the DSH TUI, then the agent core was unfinished. The demo looked good but could not complete a task.

**Early signs**
- TUI work starts before the agent spine.
- No plain renderer.
- DSH service coupling is deeper than expected.
- Windows terminal issues appear late.

**Mitigations**
- Agent spine first; TUI after task 8.
- `--plain` renderer is mandatory.
- Timebox the TUI; fall back to a line-based CLI.
- Test Windows Terminal early.

---

## 4. Failure: the DLP plugin did not work

**Story:** The Bifrost hook could not access the serialized body or broke streaming. The team claimed “gateway DLP” but only added headers. A judge found the gap.

**Early signs**
- No spike on body access.
- Plugin tests only check headers.
- False positives block normal prompts.
- Secrets appear in plugin logs.

**Mitigations**
- Spike body access in M0.
- Fall back to agent-side DLP plus the confidential header guard; do not claim gateway DLP if unavailable.
- Test fake keys, private keys, clean prompts, and a false-positive corpus.
- Log class/hash only.

---

## 5. Failure: confidential mode had a bypass

**Story:** A prompt injection, plugin, or environment key sent code to the cloud. The audit showed a cloud call, and the trust story collapsed.

**Early signs**
- Any direct provider SDK or key in the agent.
- A tool can construct its own HTTP client.
- Tavily still callable in confidential mode.
- Shell network commands only “ask,” not deny.
- No network capture test.

**Mitigations**
- Single egress path; dependency/network tests.
- Local-only virtual key plus plugin guard.
- Tavily hard-disabled; cached cards not read.
- Network shell denied; `--no-network` panic flag.
- Zero-egress conformance test with a network capture.

---

## 6. Failure: Tavily was decorative

**Story:** The agent called Tavily on every task, added context, and did not improve pass rate. Judges saw a search tool, not a knowledge plane.

**Early signs**
- Research calls on repo-local tasks.
- No citations.
- Raw page dumps in context.
- No credit budget or cache.
- Docs Guard never tested.

**Mitigations**
- Local-first trigger; zero calls on Class A.
- Compact cited cards; no raw content.
- Credit budget and cache hit metrics.
- Class B side-by-side ablation.
- Docs Guard as a stretch with a clear metric.

---

## 7. Failure: the demo failed live

**Story:** The provider outage did not happen, Tavily rate-limited, or the local model was slow. The 3-minute demo collapsed.

**Early signs**
- Demo depends on live provider behavior.
- No mock provider.
- No replay.
- No backup recording.
- Secrets on screen.

**Mitigations**
- Mock provider for 429/503/402.
- `gidorah demo --replay` offline.
- Backup recording.
- Pre-flight checklist.
- Redacted fixtures.

---

## 8. Failure: the team could not explain the architecture

**Story:** Judges asked “what did you build?” and the answer was a feature list. They asked “how is Bifrost used?” and the answer was “for routing.” They asked “how is Tavily used?” and the answer was “for search.”

**Early signs**
- No one-sentence claim.
- No competitive matrix.
- No built-vs-borrowed table.
- No measured number.

**Mitigations**
- Rehearse the one-sentence claim.
- Use the competitive matrix and 10/10 checklist.
- Keep a “what we built / what we reused” table.
- Put the measured number on the first slide.

---

## 9. Failure: scope creep

**Story:** The team added a web UI, a plugin marketplace, and a second language, and finished none of the required behaviors.

**Early signs**
- Roadmap grows while the core gate slips.
- New features have no demo scene or metric.
- The cut list is ignored.

**Mitigations**
- M4.5 only after M4 gate.
- Every feature maps to a demo scene or metric.
- Cut list is explicit.
- Freeze scope two weeks before submission.

---

## 10. Failure: legal or attribution problem

**Story:** The TUI was copied without the full license, or the product used the DeepSeek name. The submission was rejected or penalized.

**Early signs**
- No `LICENSE`/`NOTICE`.
- No third-party register.
- Product name uses a vendor mark.
- Replay traces contain secrets.

**Mitigations**
- Copy the DSH TUI license and NOTICE exactly.
- Keep the third-party register.
- Use a distinct product name.
- Redact replay traces and benchmark artifacts.

---

## Go/no-go criteria

Before submission:

- [ ] All four hackathon gates pass conformance.
- [ ] A measured cost-per-successful-task result exists, even if it is not a win.
- [ ] Demo runs 3× and replays offline.
- [ ] Zero cloud/Tavily calls in confidential mode.
- [ ] DLP works or the claim is removed.
- [ ] Audit chain verifies; red-team canary egress is 0.
- [ ] Patch-first/repo-map arms have a measured result.
- [ ] Licenses and notices complete.
- [ ] The pitch is one sentence and the numbers are on one slide.

If any of the first four is false, do not submit until it is fixed.
