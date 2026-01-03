# OnCallShift Pricing & Go-To-Market Strategy

**Created:** January 2026
**Status:** Strategic Planning
**Goal:** Capture market share with aggressive pricing, scale to profitability

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Infrastructure Cost Analysis](#infrastructure-cost-analysis)
3. [Competitive Pricing Analysis](#competitive-pricing-analysis)
4. [Pricing Strategy](#pricing-strategy)
5. [Customer Acquisition](#customer-acquisition)
6. [AI Strategy & BYOK](#ai-strategy--byok)
7. [Revenue Projections](#revenue-projections)
8. [Appendix](#appendix)

---

## Executive Summary

OnCallShift has exceptional unit economics that enable an aggressive market capture strategy:

| Metric | Value |
|--------|-------|
| Infrastructure cost (10k users) | ~$350/month |
| Cost per registered user | $0.035/month |
| Gross margin | 96%+ |
| vs PagerDuty pricing | 85% cheaper |
| Target CAC | $200-350 |
| Payback period | 1-2 months |

### Strategic Position

- **Opsgenie EOL (April 2027)**: 50,000 teams seeking alternatives
- **PagerDuty price gap**: $21-41/user vs our $6/user
- **AI differentiation**: Included free vs $415-699/month add-on
- **BYOK flexibility**: Enterprise-ready, PagerDuty doesn't offer this

---

## Infrastructure Cost Analysis

### 10,000 Registered Users - Monthly Breakdown

#### Assumptions

| Factor | Value |
|--------|-------|
| Registered users | 10,000 |
| Organizations | ~400-500 |
| Monthly Active Users (MAU) | ~3,000 (30%) |
| Daily Active Users (DAU) | ~1,000 (10%) |
| Peak concurrent users | 150-250 |
| Incidents per month | ~8,000-12,000 |
| Notifications per month | ~80,000-120,000 |

#### Compute (ECS Fargate)

| Service | Tasks | vCPU | Memory | Spot % | Monthly Cost |
|---------|-------|------|--------|--------|--------------|
| API | 2-3 | 0.5 each | 1GB | 70% | $25-35 |
| Alert Processor | 2 | 0.25 each | 512MB | 100% | $8-10 |
| Notification Worker | 2 | 0.25 each | 512MB | 100% | $8-10 |
| Escalation Timer | 1 | 0.25 | 512MB | 0% | $8 |
| Snooze Expiry | 1 | 0.25 | 512MB | 100% | $4 |
| Report Scheduler | 1 | 0.25 | 512MB | 100% | $4 |
| **Subtotal** | | | | | **$57-71** |

*With 1-year Compute Savings Plan (27% off): **$42-52***

#### Database (RDS PostgreSQL)

| Configuration | Instance | Storage | Monthly Cost |
|---------------|----------|---------|--------------|
| Current (dev) | db.t4g.micro | 20GB | $17 |
| **10k users** | **db.t4g.small** | 50GB | **$35** |
| High load | db.t4g.medium | 100GB | $60 |

*With 1-year Reserved Instance (35% off): **$23***

#### Networking

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| NAT Gateway | Single (1 AZ) | $33 |
| ALB | 1 ALB + LCU usage | $25-30 |
| VPC Endpoints | 3 interfaces | $22 |
| CloudFront | ~50GB transfer | $8-10 |
| Route53 | 1 hosted zone | $0.50 |
| **Subtotal** | | **$89-96** |

#### Storage & Messaging

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| S3 | Static assets + uploads | $5 |
| SQS | ~150k messages | $5 |
| SNS | Push notifications | $5 |
| **Subtotal** | | **$15** |

#### Monitoring & Secrets

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| CloudWatch Logs | 30GB, 7-day retention | $15-20 |
| Secrets Manager | 5 secrets | $2 |
| **Subtotal** | | **$17-22** |

#### Authentication

| Service | Users | Monthly Cost |
|---------|-------|--------------|
| Cognito | 10,000 | **$0** (under 50k MAU free tier) |

#### Variable Costs

| Service | Unit Cost | Monthly Usage | Monthly Cost |
|---------|-----------|---------------|--------------|
| Email (SES) | $0.0001/email | 100,000 | $10 |
| SMS (SNS) | $0.0075/msg | 20,000 | $150 |
| Push (SNS) | ~$0 | 100,000 | $0 |

### Total Monthly Cost Summary

| Configuration | Monthly Cost | Annual Cost |
|---------------|--------------|-------------|
| **Lean (Spot + Single NAT)** | **$256** | **$3,072** |
| **Resilient (Multi-AZ + On-Demand API)** | **$350** | **$4,200** |
| **Enterprise-ready (all redundancy)** | **$450** | **$5,400** |

### Cost Per User

| Metric | Value |
|--------|-------|
| Cost per registered user | **$0.035/month** |
| Cost per MAU (3,000) | **$0.117/month** |
| Cost per DAU (1,000) | **$0.350/month** |

---

## Competitive Pricing Analysis

### PagerDuty Pricing (2025)

| Plan | Price | Limitations |
|------|-------|-------------|
| Free | $0 | 5 users max, no phone alerts |
| Professional | $21/user/month | 2 teams, 2 incident types |
| Business | $41/user/month | Full features |
| Enterprise | ~$50-99/user | Custom |

#### PagerDuty AI Add-Ons

| Add-On | Price | What It Does |
|--------|-------|--------------|
| AIOps | $699/month | Noise reduction, correlation |
| PagerDuty Advance | $415/month | AI summaries, suggestions |
| Combined | $1,114/month | Full AI suite |

#### Real-World PagerDuty Spend

| Team Size | Plan | Monthly | Annual |
|-----------|------|---------|--------|
| 10 users | Business | $410 | $4,920 |
| 25 users | Business | $1,025 | $12,300 |
| 50 users | Business | $2,050 | $24,600 |
| 50 users + AI | Business + AIOps | $2,749 | $32,988 |

### OnCallShift vs PagerDuty

| Feature | PagerDuty | OnCallShift | Savings |
|---------|-----------|-------------|---------|
| Entry paid | $21/user | **$6/user** | **71%** |
| Full features | $41/user | **$6/user** | **85%** |
| With AI | $41 + $699 | **$6/user** | **90%+** |

#### 50-User Team Comparison

| | PagerDuty Business | OnCallShift Pro |
|--|-------------------|-----------------|
| Monthly | $2,050 | **$300** |
| Annual | $24,600 | **$3,600** |
| **Savings** | | **$21,000/year** |

---

## Pricing Strategy

### Recommended Tier Structure

| Tier | Price | Target Segment |
|------|-------|----------------|
| **Free** | $0 | Startups, solo devs (5 users) |
| **Pro** | $6/user/month | Growing teams, SMBs |
| **Business** | $15/user/month | Mid-market, compliance |
| **Enterprise** | Custom | Large orgs, BYOK required |

### Feature Matrix

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| Users | 5 | Unlimited | Unlimited | Unlimited |
| Services | 1 | 25 | Unlimited | Unlimited |
| On-call schedules | 1 | 10 | Unlimited | Unlimited |
| Escalation policies | 1 | 10 | Unlimited | Unlimited |
| SMS/month | 50 | 500 | 2,000 | Custom |
| AI requests/user/month | 0 | 50 | 200 | Unlimited (BYOK) |
| SSO (Google) | Yes | Yes | Yes | Yes |
| SSO (SAML/Okta) | No | No | Yes | Yes |
| Audit logs | No | 7 days | 90 days | 1 year |
| Support SLA | Community | 24 hrs | 4 hrs | 1 hr |

### Grandfathering Strategy

**Never raise prices on early adopters.**

| Sign-Up Date | Forever Price | New Customer Price (2027+) |
|--------------|---------------|---------------------------|
| 2025 (Founding) | $6/user | |
| 2026 (Early) | $9/user | |
| 2027+ (Standard) | | $15/user |

Revenue grows through:
- New customers at higher prices
- Seat expansion (teams grow)
- Tier upgrades (Pro Business)
- Usage overages (SMS, AI)

### Opsgenie Migration Offer

**Window: Now April 2027**

| Offer | Details |
|-------|---------|
| Price match | Match their current Opsgenie bill |
| 2-year lock | Guaranteed rate for 24 months |
| Free migration | Automated import of config |
| No contract | Month-to-month, cancel anytime |

---

## Customer Acquisition

### Channel Efficiency ($10k/month budget)

| Channel | Spend | CAC | Customers/Month |
|---------|-------|-----|-----------------|
| Google Ads (high-intent) | $3,000 | $250-350 | 9-12 |
| LinkedIn Ads | $2,500 | $300-400 | 6-8 |
| Reddit/HN | $1,000 | $150-250 | 4-7 |
| Retargeting | $500 | $100-150 | 3-5 |
| Content/SEO | $1,500 | Compounds | +organic |
| Affiliate payouts | $1,000 | $100-200 | 5-10 |
| **Total** | **$10,000** | **$220 avg** | **35-45** |

### Scaling to $25k/month

| Spend Level | Avg CAC | Customers/Month | Efficiency |
|-------------|---------|-----------------|------------|
| $10k | $220 | 45 | 100% |
| $15k | $250 | 60 | 90% |
| $20k | $285 | 70 | 78% |
| **$25k** | **$320** | **78** | **69%** |
| $35k | $400 | 88 | 55% |
| $50k | $500 | 100 | 44% |

### Diminishing Returns

| Threshold | What Happens |
|-----------|--------------|
| ~$15-18k/month | Diminishing returns start |
| ~$30-35k/month | Returns get painful |
| ~$40-50k/month | Hard ceiling without new channels |

### Recommended $25k Allocation

```
Google Ads (high-intent keywords)      $5,000   (20%)
Google Ads (broader DevOps terms)      $3,000   (12%)
LinkedIn Ads                           $4,000   (16%)
Reddit/HN sponsored                    $2,000   (8%)
Podcast sponsorships                   $3,000   (12%)
Content production + SEO               $3,000   (12%)
Retargeting                            $1,500   (6%)
Affiliate/referral payouts             $2,000   (8%)
Newsletter sponsorships                $1,500   (6%)
Total                                  $25,000
```

### 12-Month Projection ($25k/month spend)

| Month | Spend | New Customers | Cumulative | MRR |
|-------|-------|---------------|------------|-----|
| 1 | $25k | 89 | 89 | $10,680 |
| 3 | $25k | 83 | 258 | $30,960 |
| 6 | $25k | 78 | 498 | $59,760 |
| 9 | $25k | 76 | 728 | $87,360 |
| 12 | $25k | 71 | 947 | $113,640 |

**Year 1 Totals:**
- Ad spend: $300,000
- New customers: ~947
- Ending MRR: ~$114,000
- ARR run rate: ~$1.37M

---

## AI Strategy & BYOK

### The Competitive Advantage

| | PagerDuty | OnCallShift |
|--|-----------|-------------|
| AI included? | No ($415-699 extra) | **Yes** |
| BYOK option? | No | **Yes** |
| Model choice? | Proprietary | **Claude, GPT-4, etc.** |
| Data control? | Their servers | **Your key = your data** |

### AI Cost Analysis

#### On-Demand AI (Current Implementation)

| Feature | Model | Cost per Use | 100 Uses/Month |
|---------|-------|--------------|----------------|
| Incident summary | Haiku | $0.002 | $0.20 |
| Root cause analysis | Sonnet | $0.02 | $2.00 |
| AI chat | Sonnet | $0.008 | $0.80 |
| Postmortem generation | Sonnet | $0.02 | $2.00 |
| **Total** | | | **~$5** |

#### Cost at Scale

| Usage Pattern | AI Calls/Month | Cost |
|---------------|----------------|------|
| Light (on-demand) | 100 | $5 |
| Moderate | 500 | $25 |
| Heavy | 2,000 | $100 |
| Every incident auto-analyzed | 10,000 | $400 |

### BYOK Strategy

#### Tier Approach

| Tier | AI Approach | Your Cost | User Pays |
|------|-------------|-----------|-----------|
| Free | No AI | $0 | $0 |
| Pro ($6/user) | Platform AI (capped) | ~$0.10/user | $0 |
| Business ($15/user) | Platform AI (generous) | ~$0.50/user | $0 |
| Enterprise | BYOK | $0 | Their API costs |

#### Usage Caps

| Tier | AI Requests/User/Month | BYOK Available |
|------|------------------------|----------------|
| Pro | 50 | Yes (unlocks unlimited) |
| Business | 200 | Yes |
| Enterprise | Unlimited | Required |

#### Why BYOK Wins

1. **Enterprise compliance**: Use existing AI contracts, data residency
2. **Cost control**: Heavy users pay Anthropic directly
3. **Flexibility**: Choose Claude, GPT-4, or other models
4. **Positioning**: "Your data, your control" vs PagerDuty lock-in

### Recommended AI Pricing Message

> "Unlike PagerDuty, AI is included at every paid tier.
>
> Want unlimited? Bring your own Anthropic key:
> - Unlimited usage
> - Your data never leaves your control
> - Use your existing enterprise AI contract"

---

## Revenue Projections

### Conservative Scenario ($10k/month marketing)

| Year | Ending MRR | Annual Revenue | Customers |
|------|------------|----------------|-----------|
| 1 | $68k | $400k | 565 |
| 2 | $150k | $1.3M | 1,250 |
| 3 | $280k | $2.8M | 2,300 |

### Moderate Scenario ($25k/month marketing)

| Year | Ending MRR | Annual Revenue | Customers |
|------|------------|----------------|-----------|
| 1 | $114k | $700k | 947 |
| 2 | $280k | $2.4M | 2,300 |
| 3 | $500k | $5M | 4,100 |

### Aggressive Scenario (Opsgenie capture)

If OnCallShift captures just 5% of Opsgenie's migrating customers:

| Metric | Value |
|--------|-------|
| Teams captured | 2,500 |
| MRR | $1.01M |
| ARR | $12.2M |

### Unit Economics

| Metric | Value |
|--------|-------|
| ARPU (blended) | $120/month |
| Variable cost per customer | ~$15/month |
| Gross profit per customer | ~$105/month |
| Gross margin | 87.5% |
| LTV (at 2% churn) | ~$5,250 |
| Target CAC | $200-350 |
| LTV:CAC ratio | 15:1 to 26:1 |

---

## Appendix

### Free vs Paid Analysis

**Don't give it away. Price aggressively instead.**

| Strategy | 10,000 Users | Paying | MRR |
|----------|--------------|--------|-----|
| 100% Free | 10,000 | 0 | $0 |
| Freemium (5% convert) | 10,000 | 500 | $60,000 |
| Aggressive paid ($6/user) | 3,000 | 3,000 | $360,000 |

Aggressive paid generates 6x revenue with fewer users.

### Who Gets Free

| Segment | Pricing | Rationale |
|---------|---------|-----------|
| Solo developers | Free | Future team leads |
| Startups < 10 people | Free or $3/user | Can't pay, will grow |
| Startups 10-50 | $6/user | Can pay, should pay |
| SMB 50-200 | $6/user | Core revenue |
| Mid-market 200-1000 | $12/user | Can afford more |
| Enterprise 1000+ | $20/user | Want SLA, compliance |

### Key Messages

#### For Opsgenie Refugees
> "We'll match your Opsgenie price for 2 years. Zero migration friction."

#### For PagerDuty Prospects
> "Everything PagerDuty Business offers, 85% cheaper. AI included."

#### For Enterprise
> "Bring your own AI key. Your data, your control, your compliance."

#### For Startups
> "Free for teams under 5. Grow with us."

### Timeline Recommendation

| Phase | Timeframe | Pricing | Goal |
|-------|-----------|---------|------|
| Land | Now - Dec 2026 | 80% off PagerDuty | 500-1000 customers |
| Expand | 2027-2028 | Add premium tiers | Grow ARPU |
| Mature | 2029+ | New customers at $15/user | Sustainable |

---

## Sources

- [PagerDuty Official Pricing](https://www.pagerduty.com/pricing/incident-management/)
- [Spike.sh PagerDuty Pricing Breakdown 2025](https://blog.spike.sh/pagerduty-pricing-breakdown-2025-and-how-to-save-up-to-86-percent-cost/)
- [Anthropic Claude Pricing](https://www.anthropic.com/pricing)
- [JetBrains BYOK](https://blog.jetbrains.com/ai/2025/12/bring-your-own-key-byok-is-now-live-in-jetbrains-ides/)
- [VS Code BYOK](https://code.visualstudio.com/blogs/2025/10/22/bring-your-own-key)
- [First Page Sage B2B SaaS CAC Report](https://firstpagesage.com/reports/b2b-saas-customer-acquisition-cost-2024-report/)

---

## Strategic Gaps & Roadmap

### Current Positioning Problem

**Current:** "PagerDuty Alternative - 85% cheaper"
**Problem:** Positions OnCallShift as a follower, not a leader

**Target:** "The AI-Native Incident Platform"
**Message:** "OnCallShift is the first incident management platform built for the AI era. Your AI assistant can set up your org, migrate from competitors, and resolve incidents—all through conversation."

### Positioning Pivot

| Instead of | Lead With |
|------------|-----------|
| "PagerDuty Alternative" | "AI-Native Incident Management" |
| "Save 60% vs PagerDuty" | "Resolve Incidents 50% Faster with AI" |
| "Same features, less cost" | "The platform your AI assistant already knows" |

### Unique Differentiators (Not Currently Marketed)

| Feature | Positioning |
|---------|-------------|
| MCP Server | "The only incident platform your AI can configure" |
| BYOK AI | "Enterprise AI compliance without vendor lock-in" |
| One-command migration | "Migrate from PagerDuty with a single conversation" |
| Mobile runbook execution | "Execute runbooks from your phone during incidents" |
| Cloud investigation | "AI that queries your AWS/GCP/Azure directly" |

### Trust Signals Gap (Critical for Enterprise)

| Missing | Impact | Priority | Effort |
|---------|--------|----------|--------|
| SOC 2 Type II | Blocks enterprise sales | High | 3-6 months |
| Public status page | No reliability proof | High | 1 day |
| Customer logos/testimonials | No social proof | High | Ongoing |
| Case studies with metrics | Can't prove ROI | Medium | 2 weeks each |
| Security page details | Blocks procurement | Medium | 1 week |

### Developer Experience Gap

| Tool | Status | Competition | Priority |
|------|--------|-------------|----------|
| MCP Server | ✅ Done | Ahead of PagerDuty | - |
| Terraform Provider | ❌ Missing | PagerDuty has one | High |
| CLI Tool (`ocs`) | ❌ Missing | PagerDuty has `pd` CLI | Medium |
| GitHub Action | ❌ Missing | Standard for IaC teams | Medium |
| OpenAPI Spec (complete) | ⚠️ Partial | Needed for SDK generation | Medium |

### Enterprise Features Gap

| Feature | Status | Requirement Level |
|---------|--------|-------------------|
| SAML SSO | ⚠️ Mentioned | Must-have for 500+ companies |
| SCIM Provisioning | ❌ Missing | Auto user sync with Okta/Azure AD |
| Granular RBAC | ⚠️ Basic | Need fine-grained permissions |
| Data Residency (EU) | ❌ Missing | Required for EU customers |
| IP Allowlisting | ❌ Missing | Security requirement |
| Audit Log Export | ⚠️ Basic | Need detailed, exportable logs |

### Content & Thought Leadership Gap

| Missing | Why It Matters |
|---------|----------------|
| Blog with real content | SEO, credibility, inbound leads |
| "State of On-Call" report | Thought leadership, press coverage |
| Incident management playbooks | Content marketing, SEO |
| Video tutorials | Discovery, reduced support load |
| Podcast sponsorships | Reach DevOps audience |

**Priority blog topics:**
1. "PagerDuty vs Opsgenie vs OnCallShift (2026 comparison)"
2. "How to reduce MTTR by 50% with AI"
3. "Migrating from Opsgenie before April 2027"
4. "On-call fairness: how top teams balance the load"
5. "The AI-native future of incident management"

### Community & Ecosystem Gap

| Missing | Competition |
|---------|-------------|
| Discord/Slack community | PagerDuty has community forums |
| Integration marketplace | PagerDuty has 700+ integrations |
| Partner program | PagerDuty has MSP/consulting partners |
| Open source contributions | Builds developer trust |

### Implementation Roadmap

#### Phase 1: Trust & Credibility (Immediate - 2 weeks)

| Action | Owner | Timeline |
|--------|-------|----------|
| Public status page (dogfooding) | Engineering | 1 day |
| Security page with details | Engineering | 3 days |
| Open source MCP server package | Engineering | 1 day |
| First 3 blog posts | Marketing | 2 weeks |

#### Phase 2: Developer Experience (2-4 weeks)

| Action | Owner | Timeline |
|--------|-------|----------|
| Terraform provider MVP | Engineering | 2-3 weeks |
| CLI tool (`ocs`) | Engineering | 1 week |
| Complete OpenAPI spec | Engineering | 1 week |
| GitHub Action for deployments | Engineering | 3 days |

#### Phase 3: Enterprise Readiness (1-3 months)

| Action | Owner | Timeline |
|--------|-------|----------|
| SAML SSO integration | Engineering | 2 weeks |
| SOC 2 Type II engagement | Security/Compliance | Start immediately (3-6 months) |
| Audit log improvements | Engineering | 1 week |
| First customer case study | Sales/Marketing | Ongoing |

#### Phase 4: Growth & Scale (3-6 months)

| Action | Owner | Timeline |
|--------|-------|----------|
| SCIM provisioning | Engineering | 2 weeks |
| EU data residency option | Infrastructure | 4-6 weeks |
| Partner program launch | Business Dev | 2 months |
| Integration marketplace | Engineering | 3 months |

### Key Messages (Updated)

#### Hero Message
> "OnCallShift is the first incident management platform built for the AI era. Your AI assistant can set up your org, migrate from competitors, and resolve incidents—all through conversation. And yes, it's 85% cheaper than PagerDuty."

#### For Opsgenie Refugees
> "We'll match your Opsgenie price for 2 years. Migrate with a single AI conversation—no manual export required."

#### For PagerDuty Prospects
> "Everything PagerDuty offers, but AI-native from day one. Configure your entire org through Claude Code or Cursor."

#### For Enterprise
> "Bring your own AI key. Your data, your control, your compliance. SOC 2 Type II compliant." *(once achieved)*

#### For Developers
> "The only incident platform with an MCP server. Manage on-call from your IDE."

#### For Startups
> "Free for teams under 10. Set up in 5 minutes with AI. Scale when you're ready."

---

*Last Updated: January 2026*
*Document Owner: Founder*
*Review Frequency: Quarterly*
