# Productization

**Status:** Draft · **Owner:** Product · **Last updated:** 2026-11-03

Gidorah is a hackathon project with a credible product path. This document defines the buyer, the wedge, the business model, and what would be built after the event. It is not a commitment to pricing; it is a direction.

---

## 1. Product category

**The control plane for coding agents.**

Not another coding agent. The agent is the reference client. The durable value is the policy, cost, confidentiality, research, and audit layer that any team deploying coding agents needs.

---

## 2. Buyer and user

| Role | Pain | What they buy |
|---|---|---|
| **Platform engineering** | Many agents, many providers, no per-developer budget or failover | A gateway + agent control plane with cost and reliability |
| **Security / compliance** | Code cannot leave the network; "trust us" is not enough | Local-only enforcement, zero-egress mode, audit export |
| **Engineering finance** | AI spend is unpredictable | Per-user/team budgets, cost per solved task, reports |
| **Developer** | Agents guess at APIs and ask for approval on every read | Local-first research, diff approvals, fewer interruptions |
| **OSS maintainer / CI** | CI agent costs and stale docs | Headless mode, caps, cited research |

Primary wedge: **regulated teams that want coding agents but cannot send code to the cloud.** Secondary wedge: **platform teams managing cost and reliability across many developers.**

---

## 3. Why now

- Coding agents are moving from demos to team deployments.
- Model choice is fragmenting; provider outages and rate limits are normal.
- Enterprises need budget, confidentiality, and audit before broad rollout.
- Gateways (Bifrost) and research APIs (Tavily) are mature enough to build a control plane on.
- No neutral control plane owns the agent layer yet.

---

## 4. Product tiers (open-core)

| Tier | Contents | Price hypothesis |
|---|---|---|
| **Community** | CLI, Bifrost plugin, benchmark, local policy, single user | Free, Apache-2.0 |
| **Team** | Server mode, multi-user budgets, shared research cache, dashboard, audit export, SSO | Per seat + usage |
| **Enterprise** | On-prem/air-gapped, policy packs, team/customer budget hierarchy, SIEM export, support | Annual contract |

The open-source core must be genuinely useful, not crippleware. The paid layer is organizational: identity, shared policy, reporting, support.

---

## 5. Go-to-market

1. **Bifrost ecosystem:** publish the plugin, document the integration, propose a `bifrost gidorah` launcher/profile, contribute benchmark tasks.
2. **Tavily ecosystem:** publish the evidence-card and Docs Guard patterns; show token/credit savings.
3. **GitHub:** open-source CLI + benchmark; a reproducible `gidorah demo`.
4. **Design partners:** 3–5 regulated/platform teams; run their repos in confidential mode; measure cost per solved task.
5. **Content:** “The missing control plane for coding agents” technical post with the ablation.

---

## 6. Moat

| Asset | Why it compounds |
|---|---|
| Policy engine + conformance suite | Hard to replicate safely; trust is earned |
| Benchmark data | Cost/quality evidence across models and tasks |
| Bifrost/Tavily integration depth | Ecosystem position; upstream contribution |
| Audit/export format | Becomes the compliance artifact |
| Research cache/Docs Guard | Improves with use; reduces cost |

The agent loop is not the moat. Anyone can build a loop. The moat is **enforced policy + evidence + integrations**.

---

## 7. Post-hackathon roadmap

| Version | Scope |
|---|---|
| **0.2** | Hardened CLI, replay mode, conformance suite, Bifrost plugin |
| **0.3** | Server mode, multi-user budgets, shared research cache |
| **0.4** | Web dashboard: spend, routes, fallbacks, approvals, audit |
| **0.5** | SSO, team/customer budget hierarchy, SIEM export |
| **1.0** | Enterprise policy packs, on-prem/air-gapped deployment, support |

Do not build these during the hackathon. The hackathon proves the wedge; the product roadmap is the follow-through.

---

## 8. Success metrics (post-launch)

- Cost per solved task vs. baseline (customer-reported).
- Budget violations prevented.
- Confidential sessions with zero external calls.
- Fallback recovery rate.
- Weekly active developers.
- Research cache hit rate / credits saved.
- Time to first successful task.
- Retention and expansion within a team.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Model vendors build governance | Stay provider-neutral; integrate Bifrost/Tavily; own the audit/policy layer |
| Bifrost/Tavily change APIs | Pin versions; adapter layer; upstream contributions |
| Open-source clone | Brand, conformance, integrations, enterprise features |
| Security incident | Zero-egress mode, DLP, audit, incident response |
| Buyer inertia | Start with a narrow regulated wedge; prove one team’s savings |
| Agent commoditization | The control plane, not the loop, is the product |

---

## 10. What we deliberately do not do

- Train a model.
- Build a general-purpose IDE.
- Compete with OpenCode/DSH on tool breadth.
- Host customer code.
- Offer a “fully autonomous, no approvals” mode in v1.

---

## 11. The pitch to a buyer

> “You cannot deploy coding agents without a budget, a confidentiality guarantee, and an audit trail. Gidorah gives you those on top of the models and gateway you already use. It proves cost per solved task, not tokens per run.”

That is the product.
