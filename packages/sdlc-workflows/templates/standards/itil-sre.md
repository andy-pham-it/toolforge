standard: itil-sre
version: 1.0.0

# ITIL & SRE Reference

> **Phase 1 reference notes.** Full ITIL 4 / SRE alignment targeted for Phase 2.

## Required Runbook Sections

1. **Service Overview** — Purpose, owner, stakeholders
2. **Architecture** — Components, dependencies, data flow
3. **Deployment** — CI/CD pipeline, environments, rollout strategy
4. **Monitoring** — Metrics, dashboards, alert thresholds
5. **Incident Response** — Severity matrix, escalation, runbook links
6. **Backup & Recovery** — RPO/RTO, backup strategy, restore steps
7. **Capacity Planning** — Current load, growth projection, scaling trigger
8. **Security & Compliance** — Access control, audit trail, data classification

## SRE Principles

- Service Level Objectives (SLOs): Target values for reliability
- Service Level Indicators (SLIs): Measured metrics
- Error Budgets: (1 - SLO) * total events
- Toil Automation: Manual work that can/should be automated
- Incident Analysis: Postmortems without blame

## ITIL 4 Guiding Principles

- Focus on value
- Start where you are
- Progress iteratively with feedback
- Collaborate and promote visibility
- Think and work holistically
- Keep it simple and practical
- Optimize and automate
