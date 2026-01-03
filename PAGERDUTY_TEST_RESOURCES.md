# PagerDuty Test Environment Resources

Created for migration testing from PagerDuty to OnCallShift.

## API Key
- Token: `u+d9rSnegHDNnqBUPyHw`
- Account URL: https://oncallshift.pagerduty.com

---

## Users (9 total)

| Name | Email | ID |
|------|-------|-----|
| Alice Chen | alice@oncallshift.com | (see API) |
| Bob Martinez | bob@oncallshift.com | (see API) |
| Carol Johnson | carol@oncallshift.com | (see API) |
| David Kim | david@oncallshift.com | (see API) |
| Emma Wilson | emma@oncallshift.com | (see API) |
| Frank Brown | frank@oncallshift.com | (see API) |
| Grace Lee | grace@oncallshift.com | (see API) |
| Henry Taylor | henry@oncallshift.com | (see API) |
| Jarod Rosenthal | jarod@oncallshift.com | (owner) |

---

## Teams (4 total)

| Team | ID | Members |
|------|-----|---------|
| Platform | PDX2JFI | Alice, Bob |
| Payments | PZKEJ3V | Carol, David |
| Mobile | PWOTIR5 | Emma, Frank |
| Infrastructure | PSC5HBF | Grace, Henry |

---

## On-Call Schedules (4 total)

| Schedule | ID | Team | Rotation |
|----------|-----|------|----------|
| Platform Primary | PZ07QRZ | Platform | Weekly |
| Payments Primary | PVQJPC9 | Payments | Weekly |
| Mobile Primary | PREYOMJ | Mobile | Weekly |
| Infrastructure Primary | PO5NONW | Infrastructure | Weekly |

---

## Escalation Policies (5 total)

| Policy | ID | Levels | Loop Count |
|--------|-----|--------|------------|
| Default | PKZ0DZN | 1 | 0 |
| Platform Escalation | PFZCQFG | 3 | 2 |
| Payments Escalation | PYR3PR3 | 3 | 3 |
| Mobile Escalation | PR5UNMQ | 3 | 2 |
| Infrastructure Escalation | P6JI9XA | 3 | 3 |

---

## Services (14 total)

| Service | ID | Team | Escalation Policy |
|---------|-----|------|-------------------|
| API Gateway | PZI9NAM | Platform | Platform Escalation |
| Auth Service | PW8L9LZ | Platform | Platform Escalation |
| User Service | PSZA999 | Platform | Platform Escalation |
| Payment Processor | PP0P8WJ | Payments | Payments Escalation |
| Billing Service | P8R17HW | Payments | Payments Escalation |
| Fraud Detection | P4ED756 | Payments | Payments Escalation |
| iOS App | P15S6SG | Mobile | Mobile Escalation |
| Android App | PK1B6D0 | Mobile | Mobile Escalation |
| Push Notifications | PGSQ60A | Mobile | Mobile Escalation |
| Kubernetes Cluster | PCG25ON | Infrastructure | Infrastructure Escalation |
| PostgreSQL Primary | PZ6E4YK | Infrastructure | Infrastructure Escalation |
| Redis Cache | PVXT3JX | Infrastructure | Infrastructure Escalation |
| AWS Infrastructure | PRL5377 | Infrastructure | Infrastructure Escalation |
| Default Service | PUB5ESS | - | Default |

### Service Standards Applied:
- Alert Grouping: Intelligent (all services)
- Urgency Rules: Support hours (high during 9-5 ET, low outside)
- API Integrations: Events API v2 on key services
- Change Integrations: GitHub/ArgoCD/Terraform on key services
- Webhook Extensions: Slack channels for Platform, Payments, Infrastructure

---

## Business Services (4 total)

| Business Service | ID | Point of Contact |
|------------------|-----|------------------|
| E-Commerce Platform | PFCW7I3 | platform-team@oncallshift.com |
| Payment Processing | PC3875D | payments-team@oncallshift.com |
| Mobile Experience | PYTK6TQ | mobile-team@oncallshift.com |
| Core Infrastructure | PUHZ5E0 | infra-team@oncallshift.com |

---

## Service Dependencies

### Technical Dependencies (Service → Service)
- API Gateway → Auth Service
- API Gateway → User Service
- Payment Processor → PostgreSQL Primary

### Business Dependencies (Business Service → Technical Service)
- E-Commerce Platform → API Gateway
- Payment Processing → Payment Processor
- Payment Processing → Fraud Detection
- Mobile Experience → iOS App
- Mobile Experience → Android App
- Core Infrastructure → Kubernetes Cluster
- Core Infrastructure → PostgreSQL Primary

---

## Integrations

| Service | Integration | Type | Integration Key |
|---------|-------------|------|-----------------|
| API Gateway | Datadog Monitoring | Events API v2 | 23824d00f36d420fc0820a85aaaead1c |
| API Gateway | GitHub Deployments | Events API v1 | 4e9a778051bc460bc0131c09fe1d401b |
| Payment Processor | Stripe Webhooks | Events API v2 | e1d2c7443e054d0bc0af2e12faaf4956 |
| Payment Processor | ArgoCD Deployments | Events API v1 | (see API) |
| Kubernetes Cluster | Prometheus Alertmanager | Events API v2 | c739dd4640424702c07e172b7fb80d7b |
| Kubernetes Cluster | Terraform Apply | Events API v1 | (see API) |
| PostgreSQL Primary | CloudWatch Alarms | Events API v2 | 4c56989a2efd4505c0c73b4deab237e4 |
| PostgreSQL Primary | Database Migrations | Events API v1 | (see API) |

---

## Extensions (Webhooks)

| Extension | ID | Services | Endpoint |
|-----------|-----|----------|----------|
| Slack Alerts Channel | PF6H5X1 | API Gateway | hooks.slack.com/... |
| Payments Slack Channel | PBXW4HB | Payment Processor | hooks.slack.com/... |
| Infra Slack Channel | PXL845O | Kubernetes Cluster | hooks.slack.com/... |

---

## Service Standards Compliance

| Standard | Status |
|----------|--------|
| Has extension or add-on (e.g. Slack) | 3 services have webhooks |
| Has Alert Grouping turned on | All services (intelligent) |
| Does not only send high urgency | All services (support hours) |
| Has at least 1 change integration | 4 services have change integrations |
| Has at least 1 business service dependency | 4 business services configured |
| Has at least 1 technical service dependency | 3 services have tech dependencies |
| Has at least 1 API integration | 4 services have Events API |
| Has a description | All services have descriptions |
| Has escalation policy with 2+ levels | All team policies have 3 levels |
