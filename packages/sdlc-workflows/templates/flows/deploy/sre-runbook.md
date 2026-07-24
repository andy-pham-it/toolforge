---
standard: sre
version: 1.0.0
variables:
  - serviceName
  - serviceOverview
  - slis
  - errorBudget
  - deployment
  - rollback
  - monitoring
  - incidentManagement
  - capacity
  - security
---

# SRE Runbook: {{ serviceName | default("<Service Name>") }}

## 1. Service Overview
{{ serviceOverview | default("*Purpose, owner, stakeholders, SLO targets*") }}

## 2. SLIs & SLOs
{{ slis | default("*Service Level Indicators and Objectives*") }}

## 3. Error Budget
{{ errorBudget | default("*Current budget status, consumption rate*") }}

## 4. Deployment Pipeline
{{ deployment | default("*CI/CD, environments, rollout automation*") }}

## 5. Rollback Procedure
{{ rollback | default("*Automated rollback triggers, manual steps*") }}

## 6. Monitoring & Alerting
{{ monitoring | default("*Dashboard links, alert rules, on-call rotation*") }}

## 7. Incident Management
{{ incidentManagement | default("*Severity definitions, escalation, postmortem process*") }}

## 8. Capacity Planning
{{ capacity | default("*Load metrics, growth projection, scaling triggers*") }}

## 9. Security & Compliance
{{ security | default("*Access control, audit trail, data classification*") }}

{% include "_footer" %}
