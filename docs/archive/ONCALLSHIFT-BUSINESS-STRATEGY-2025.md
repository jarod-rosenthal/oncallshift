# OnCallShift Business Strategy & Market Research
## Comprehensive Analysis for Product, Monetization, and Growth

*Generated: December 2025*

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part 1: Escalation Workflow UX Redesign](#part-1-escalation-workflow-ux-redesign)
3. [Part 2: Monetization Strategy](#part-2-monetization-strategy)
4. [Part 3: Revenue Projections](#part-3-revenue-projections)
5. [Part 4: Operating Costs & Unit Economics](#part-4-operating-costs--unit-economics)
6. [Part 5: AI Integration Costs (Claude API)](#part-5-ai-integration-costs-claude-api)
7. [Part 6: Fundraising Guide](#part-6-fundraising-guide)
8. [Part 7: Growth & Customer Acquisition](#part-7-growth--customer-acquisition)
9. [Appendix: Sources & References](#appendix-sources--references)

---

## Executive Summary

OnCallShift (PagerDuty-Lite) is positioned to capture significant market share in the $2.5B+ incident management market. Key opportunities:

- **Opsgenie EOL (April 2027)**: ~50,000 teams seeking alternatives
- **PagerDuty Price Gap**: Room for 40-50% cheaper alternative
- **AI Differentiation**: Include AI features that competitors charge $699+/month extra for
- **Exceptional Unit Economics**: 96% gross margins enable aggressive growth strategies

### Key Metrics Summary

| Metric | Value |
|--------|-------|
| Gross Margin | 96.3% |
| Blended ARPU | $405/month |
| Infrastructure Cost (100 customers) | $150/month |
| Variable Cost per Customer | ~$15/month |
| Net Profit per Customer | ~$390/month |
| LTV (at 2% churn) | $19,539 |
| Target CAC | $400-600 |
| LTV:CAC Ratio | 32:1 to 49:1 |

---

## Part 1: Escalation Workflow UX Redesign

### Target Model: PagerDuty-Style

#### Core Entity Hierarchy

```
Service
└── Assigned Escalation Policy (1:1)

Escalation Policy
├── Name, Description
├── Number of Loops (0 = don't loop, 1+ = loop N times)
└── Rules (ordered list)
    ├── Rule 1 (Step 1)
    │   ├── Escalation Delay: 0 minutes (immediate)
    │   └── Targets (notify ALL simultaneously)
    ├── Rule 2 (Step 2)
    │   ├── Escalation Delay: 5 minutes
    │   └── Targets
    └── Rule 3 (Step 3)
        ├── Escalation Delay: 10 minutes
        └── Targets

Schedule
├── Name, Time Zone
├── Rotation Type (daily, weekly, custom)
├── Rotation Layers (stackable)
└── Overrides (temporary substitutions)
```

#### Terminology Mapping

| Concept | PagerDuty Term | OnCallShift Current | Proposed |
|---------|---------------|---------------------|----------|
| Escalation container | Escalation Policy | Escalation Policy | **Keep** |
| Individual tier | Rule | Level / Step | **Rule** |
| Time before advance | Escalation Delay | Timeout (seconds) | **Delay (minutes)** |
| Repeat behavior | Number of Loops | Repeat Count | **Keep** |
| Who gets notified | Target | Target | **Keep** |

#### Gap Analysis vs. Current Implementation

| Aspect | PagerDuty | OnCallShift Current | Gap |
|--------|-----------|---------------------|-----|
| Multiple targets per step | ✅ Yes | ✅ Yes (Phase 2) | Aligned |
| Schedule layers | Multiple overlapping | Single rotation | **Significant gap** |
| Schedule overrides | First-class feature | Not implemented | **Significant gap** |
| Maintenance windows | Service-level pause | Snooze (incident-level) | Different scope |
| Visual escalation preview | Yes | No | **Missing** |
| "Who's next" display | Prominent | Not shown | **Missing** |

#### Proposed Domain Model Changes

```sql
-- Rename EscalationStep → EscalationRule
-- Rename stepOrder → position
-- Rename timeoutSeconds → delayMinutes
-- Add ScheduleOverride entity
-- Add MaintenanceWindow entity
-- Add incident.escalationLoopsRemaining
```

#### Migration Milestones

**Milestone 1: Terminology & UI Polish**
- Rename "Levels" → "Rules" in UI
- Display delay in minutes (convert internally)
- Add "currently on-call" preview for schedule targets
- Update labels and help text

**Milestone 2: Enhanced Escalation Visibility**
- Visual progress bar (Rule 1 → 2 → 3)
- "Next escalation in X minutes → Will notify: Y" display
- Escalation history timeline
- Drag-to-reorder for rules

**Milestone 3: Schedule Overrides & Maintenance**
- Schedule override CRUD
- Maintenance window CRUD
- Integration with alert processing

---

## Part 2: Monetization Strategy

### Competitive Landscape (2025)

| Provider | Free Tier | Entry Paid | Mid Tier | Enterprise | AI Add-on |
|----------|-----------|------------|----------|------------|-----------|
| PagerDuty | 5 users | $21/user/mo | $41/user/mo | $99/user/mo | $699-1,114/mo |
| Opsgenie (EOL 2027) | 5 users | $9.45/user/mo | $19.95/user/mo | $38.50/user/mo | N/A |
| Squadcast | Limited | $9/user/mo | $16/user/mo | $21/user/mo | N/A |
| incident.io | 5 users | $19/user/mo | $25/user/mo | Custom | +$12-20/user |
| Better Stack | Yes | $29/user/mo | — | Custom | $50/mo |

### Recommended Pricing Tiers

| Tier | Price | Target Segment |
|------|-------|----------------|
| **Free** | $0 | Startups, small teams (≤5 users) |
| **Pro** | $12/user/month | Growing teams, SMBs |
| **Business** | $29/user/month | Mid-market, compliance needs |
| **AI Premium** | $49/user/month | Enterprise, AI-powered workflows |

**Annual Discount:** 20% off

### Feature Matrix

| Feature | Free | Pro | Business | AI Premium |
|---------|------|-----|----------|------------|
| **Users** | 5 | ∞ | ∞ | ∞ |
| **Services** | 2 | 25 | ∞ | ∞ |
| **Incidents/month** | 100 | 1,000 | ∞ | ∞ |
| **On-call schedules** | 1 | 10 | ∞ | ∞ |
| **Escalation policies** | 1 | 10 | ∞ | ∞ |
| **Rules per policy** | 3 | 10 | ∞ | ∞ |
| **Repeat/loop policies** | ✗ | ✓ | ✓ | ✓ |
| **SMS notifications/mo** | 50 | 500 | 2,000 | 5,000 |
| **Voice calls/mo** | ✗ | 100 | 500 | 1,000 |
| **SSO (Google)** | ✓ | ✓ | ✓ | ✓ |
| **SSO (SAML/Okta)** | ✗ | ✗ | ✓ | ✓ |
| **Audit logs** | ✗ | 7 days | 90 days | 1 year |
| **Public status page** | ✗ | 1 | 3 | 5 |
| **MTTA/MTTR dashboards** | ✗ | ✓ | ✓ | ✓ |
| **AI alert correlation** | ✗ | ✗ | ✗ | ✓ |
| **AI incident summary** | ✗ | ✗ | ✗ | ✓ |
| **AI root cause analysis** | ✗ | ✗ | ✗ | ✓ |
| **AI postmortem generation** | ✗ | ✗ | ✗ | ✓ |
| **Support SLA** | — | 24 hrs | 4 hrs | 1 hr |

### Notification Overage Pricing

| Type | Price |
|------|-------|
| SMS | $0.02/message |
| Voice | $0.08/minute |
| AI tokens | $0.01/1K tokens |

---

## Part 3: Revenue Projections

### Assumptions

| Factor | Value | Source |
|--------|-------|--------|
| Blended ARPU | $405/month | Weighted by plan mix |
| Trial-to-Paid Conversion | 15-30% | Industry benchmark |
| Monthly Churn | 1.5-4% | SaaS benchmark |
| B2B SaaS CAC | $400-800 | First Page Sage 2025 |

### Scenario Comparison

#### Conservative (Bootstrap - $5-10K/mo marketing)

| Year | Ending MRR | Annual Revenue | Paid Customers |
|------|------------|----------------|----------------|
| 1 | $24K | $92K | 59 |
| 2 | $75K | $523K | 185 |
| 3 | $170K | $1.35M | 420 |
| 4 | $316K | $2.9M | 780 |
| 5 | $506K | $5.2M | 1,250 |

#### Moderate (Seed-Funded - $25-50K/mo marketing)

| Year | Ending MRR | Annual Revenue | Paid Customers |
|------|------------|----------------|----------------|
| 1 | $155K | $650K | 383 |
| 2 | $466K | $3.8M | 1,150 |
| 3 | $972K | $8.5M | 2,400 |
| 4 | $1.66M | $16M | 4,100 |
| 5 | $2.51M | $26M | 6,200 |

#### Aggressive (Well-Funded - $100K+/mo marketing)

| Year | Ending MRR | Annual Revenue | Paid Customers |
|------|------------|----------------|----------------|
| 1 | $948K | $2.7M | 2,341 |
| 2 | $2.75M | $22M | 6,800 |
| 3 | $5.67M | $52M | 14,000 |
| 4 | $9.72M | $95M | 24,000 |
| 5 | $15.4M | $160M | 38,000 |

### Opsgenie Migration Opportunity

| Market Capture | Teams | MRR | ARR |
|----------------|-------|-----|-----|
| 1% | 500 | $202K | $2.4M |
| 3% | 1,500 | $608K | $7.3M |
| 5% | 2,500 | $1.01M | $12.2M |
| 10% | 5,000 | $2.03M | $24.3M |

---

## Part 4: Operating Costs & Unit Economics

### Fixed Infrastructure Costs (Monthly)

Based on actual Terraform configuration in `/infrastructure/terraform/`:

| AWS Service | Configuration | Monthly Cost |
|-------------|---------------|--------------|
| ECS Fargate (Spot) | 4 services, ~1.25 vCPU | $18 |
| RDS PostgreSQL | db.t4g.micro, 20GB | $17 |
| NAT Gateway | 2 AZs | $64 |
| Application Load Balancer | 1 ALB | $18 |
| VPC Endpoints | 3 interfaces | $22 |
| CloudWatch Logs | ~10GB, 7-day retention | $5 |
| CloudFront + S3 | ~10GB transfer | $1 |
| Route53 | 1 hosted zone | $0.50 |
| Secrets Manager | 3 secrets | $1.20 |
| **Total** | — | **$146.70** |

**Optimized (Single NAT):** ~$113/month
**Scaled (100+ customers):** ~$223/month
**Enterprise (1000+ customers):** ~$571/month

### Variable Costs per Customer

| Cost Type | Monthly Cost |
|-----------|--------------|
| Email (AWS SES) | $0.02 |
| SMS (AWS SNS) | $0.32-1.94 |
| Voice (AWS SNS) | $0.13-0.65 |
| Push (AWS SNS) | ~$0 |
| AI (Claude API) | $0.65 (AI Premium only) |
| Stripe fees | 2.9% + $0.30 |

### Per-Customer Unit Economics

| Plan | Revenue | Variable Cost | Gross Profit | Margin |
|------|---------|---------------|--------------|--------|
| Pro ($12 × 12 users) | $144 | $6.45 | $137.55 | 95.5% |
| Business ($29 × 20 users) | $580 | $20.53 | $559.47 | 96.5% |
| AI Premium ($49 × 25 users) | $1,225 | $41.88 | $1,183.12 | 96.6% |
| **Blended Average** | $405.70 | $14.93 | **$390.77** | **96.3%** |

### Net Profit by Scale

| Customers | Monthly Revenue | Monthly Net | Annual Net | Net Margin |
|-----------|-----------------|-------------|------------|------------|
| 10 | $4,057 | $3,831 | $45,972 | 94.4% |
| 50 | $20,285 | $19,468 | $233,616 | 96.0% |
| 100 | $40,570 | $39,153 | $469,836 | 96.5% |
| 250 | $101,425 | $97,645 | $1,171,740 | 96.3% |
| 500 | $202,850 | $195,507 | $2,346,084 | 96.4% |
| 1,000 | $405,700 | $390,904 | $4,690,848 | 96.4% |

---

## Part 5: AI Integration Costs (Claude API)

### API Pricing (Per Million Tokens)

| Model | Input | Output | Best For |
|-------|-------|--------|----------|
| Claude Haiku 3.5 | $0.80 | $4.00 | High-volume, simple tasks |
| Claude Sonnet 4/4.5 | $3.00 | $15.00 | Balanced quality/cost |
| Claude Opus 4.5 | $5.00 | $25.00 | Complex reasoning |

### Cost-Saving Features

| Feature | Discount | Use Case |
|---------|----------|----------|
| Batch API | 50% | Postmortems, reports (async OK) |
| Prompt Caching | Up to 90% | Repeated system prompts |

### Recommended Model Selection

| Feature | Model | Cost/Use |
|---------|-------|----------|
| Incident Summary | Haiku 3.5 | $0.0024 |
| Root Cause Analysis | Sonnet 4 | $0.020 |
| AI Chat | Sonnet 4 | $0.008 |
| Postmortem (Batch) | Sonnet 4 | $0.019 |
| Alert Correlation | Haiku 3.5 | $0.0015 |

### AI Premium Customer Cost

| Component | Monthly Cost |
|-----------|--------------|
| AI features (all) | $0.65 |
| Revenue | $1,225 |
| AI as % of revenue | **0.05%** |

### Enterprise Thresholds

| Monthly API Spend | Recommended Action |
|-------------------|-------------------|
| < $1,000 | Self-serve API |
| $1,000 - $5,000 | Consider AWS Bedrock |
| $5,000 - $20,000 | Contact Anthropic sales |
| > $20,000 | Negotiate committed usage |

---

## Part 6: Fundraising Guide

### 2025 Fundraising Landscape

| Metric | Value |
|--------|-------|
| Global VC Funding | $90-110B projected |
| Median Seed Round | $2-4M |
| Cold Email Response Rate | 5.1% |
| Warm Intro Success Rate | 10x higher |
| % Seed Rounds via Warm Intro | 68% |

### Investor Discovery Platforms

#### Free Platforms

| Platform | Best For |
|----------|----------|
| OpenVC | Filtered investor lists (20K+ investors) |
| AngelList | Angels, syndicates, rolling funds |
| Crunchbase | Research competitor investors |
| LinkedIn Sales Navigator | Network mapping |

#### Fundraising Platforms

| Platform | Check Size | Model |
|----------|------------|-------|
| Republic | $50K-5M | Equity crowdfunding |
| OurCrowd | $2M-20M | Curated VC platform |
| FundersClub | $250K-2M | Online VC |
| Angel Match | Varies | Investor database |

### Accelerators for B2B SaaS

| Accelerator | Investment | Equity | Focus |
|-------------|------------|--------|-------|
| Y Combinator | $500K | 7% | Generalist (strong dev tools) |
| Alchemist | $25K | 5% | Enterprise B2B |
| Techstars | $120K | 6% | Multiple verticals |
| Forum Ventures | $250K | 6% | B2B SaaS only |
| High Alpha | Varies | Varies | B2B SaaS studio |

### Warm Introduction Strategy

1. **Portfolio Founder Pathway** (Highest success)
   - Find VC's portfolio companies similar to yours
   - Build relationship with those founders
   - Ask for intro once relationship established

2. **LinkedIn Network Mapping**
   - Search target VC firm → "People"
   - Note 1st and 2nd degree connections
   - Request intro through mutual connections

3. **Build in Public**
   - Share MRR milestones, learnings, metrics
   - Creates inbound investor interest
   - Platforms: Twitter, LinkedIn, Hacker News

### DevOps/Incident Management Investors

| Firm | Notable Investments | Stage |
|------|---------------------|-------|
| Andreessen Horowitz | PagerDuty, Datadog | Series A+ |
| Bessemer Venture Partners | PagerDuty | Series A+ |
| Point Nine (EU) | Incident.io | Seed |
| Craft Ventures | Various DevOps | Seed/A |
| Heavybit | Developer tools | Seed |

---

## Part 7: Growth & Customer Acquisition

### Opsgenie Migration Campaign

**The Opportunity:** 50,000 teams migrating by April 2027

#### Tactics

1. **Free Migration Service**
   - Automated import of escalation policies, schedules, integrations
   - "Switch from Opsgenie in 15 minutes"

2. **Pricing Guarantee**
   - "Lock in your current Opsgenie per-user price for 2 years"

3. **SEO Campaign**
   - Target: "Opsgenie alternatives", "Opsgenie migration guide"
   - These searches will spike as deadline approaches

4. **Direct Outreach**
   - Find Opsgenie customers via job postings, GitHub repos, LinkedIn

### Aggressive Free Tier Strategy

| Standard Free Tier | Aggressive Free Tier |
|--------------------|---------------------|
| 5 users | 10 users |
| 2 services | 10 services |
| Limited features | Full escalation features |
| — | Only limit: No AI, basic support |

**Economics:**
- Marginal cost per free user: ~$0.50/month
- 1,000 free users cost: $500/month
- At 3% conversion: 30 customers × $405 = $12,150/month
- **Effective CAC: $16.67** (exceptional)

### Viral Loop Strategies

1. **Status Page Branding**
   - "Powered by OnCallShift" on free status pages
   - Every outage = exposure to customer's customers

2. **Incident Stakeholder Notifications**
   - Non-users receive branded notifications
   - Include: "Free for teams under 10"

3. **Postmortem Sharing**
   - Generate beautiful, shareable postmortem reports
   - Engineers share on blogs with "Generated with OnCallShift AI"

4. **Team Invitation Mechanics**
   - "Invite 3 teammates → unlock [feature]"
   - On-call tools require multiple users to function

### Open Source Strategy (Optional)

**Open Core Model:**

| Open Source | Proprietary |
|-------------|-------------|
| Basic alerting & escalation | AI features |
| On-call scheduling | Advanced analytics |
| Core integrations | Enterprise SSO/SCIM |
| Mobile apps | White-labeling |

**Success Examples:**
- Grafana: Open core → $240M ARR
- GitLab: Open core → $424M ARR
- Sentry: Open source → $100M+ ARR

### Referral Program Options

| Model | Structure |
|-------|-----------|
| Revenue Share | 20% of referred customer's bill for 12 months |
| Tiered | 1 ref = 1mo free, 5 refs = 6mo free, 10 refs = 1yr free |
| Both-Sides | Referrer + referee both get 3 months free |

### Quick Wins Checklist

**< 1 Day:**
- [ ] Add "Powered by OnCallShift" to status pages
- [ ] Create ProductHunt launch
- [ ] Submit to G2, Capterra, GetApp
- [ ] Create comparison pages (vs PagerDuty, vs Opsgenie)
- [ ] Start Twitter/LinkedIn presence

**< 1 Week:**
- [ ] Build Opsgenie migration/import tool
- [ ] Create free on-call checker widget
- [ ] Write "Ultimate Guide to On-Call" SEO content
- [ ] Set up referral program
- [ ] Create Discord community

**< 1 Month:**
- [ ] Launch "Startup Program" (free for qualifying startups)
- [ ] Build Datadog, Grafana, Prometheus integrations
- [ ] Host first webinar
- [ ] Launch Opsgenie migration content campaign

### Loss Leader Economics

With 96% margins, aggressive pricing is sustainable:

| Strategy | Price Point | Margin |
|----------|-------------|--------|
| Standard | $12/user | 96% |
| 50% discount | $6/user | 79% |
| First year free | $0 | -$15/customer/mo |

**First Year Free ROI:**
- Year 1 cost: 100 × $15 × 12 = $18,000
- Year 2 (80% retention): 80 × $405 × 12 = $388,800
- **ROI: 21x**

---

## Appendix: Sources & References

### Pricing Research
- [PagerDuty Pricing](https://www.pagerduty.com/pricing/incident-management/)
- [Opsgenie Pricing](https://www.atlassian.com/software/opsgenie/pricing)
- [Squadcast Pricing](https://www.squadcast.com/pricing)
- [incident.io Pricing Analysis](https://spike.sh/blog/incident-io-pricing-breakdown-2025/)
- [Better Stack Pricing](https://betterstack.com/pricing)

### AI & API Costs
- [Anthropic Official Pricing](https://www.anthropic.com/pricing)
- [Claude API Documentation](https://docs.claude.com/en/docs/about-claude/pricing)
- [Anthropic API Pricing Guide - Finout](https://www.finout.io/blog/anthropic-api-pricing)

### Fundraising
- [B2B SaaS CAC 2025 Report - First Page Sage](https://firstpagesage.com/reports/b2b-saas-customer-acquisition-cost-2024-report/)
- [SaaS Free Trial Conversion Benchmarks](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)
- [2025 Warm Intro Trends - Metal.so](https://www.metal.so/collections/2025-seed-funding-warm-intro-trend-analysis-68-percent)
- [OpenVC - SaaS Investors](https://www.openvc.app/investor-lists/saas-investors)

### Growth Strategies
- [Growth Unhinged - Best Tactics 2025](https://www.growthunhinged.com/p/the-best-growth-tactics-of-2025)
- [PostHog - Growth Loops](https://posthog.com/product-engineers/growth-loops)
- [Product-Led Alliance - PLG Trends 2025](https://www.productledalliance.com/top-11-plg-trends-for-2025/)
- [Cobloom - 87 SaaS Growth Tactics](https://www.cobloom.com/blog/saas-growth-hacking-strategies)

### AWS Infrastructure
- [AWS ECS Pricing](https://aws.amazon.com/ecs/pricing/)
- [AWS RDS Pricing](https://aws.amazon.com/rds/pricing/)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial comprehensive research document |

---

*This document was generated as part of strategic planning for OnCallShift. All projections are estimates based on market research and should be validated with actual business data.*
