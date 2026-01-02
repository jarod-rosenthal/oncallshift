# OnCallShift Lean Operations Playbook

## Executive Summary

This document outlines how to operate OnCallShift with minimal burn rate while maintaining growth trajectory. The goal: **maximize runway, minimize waste, and build a foundation that scales.**

**Core Principle:** Every dollar spent must either (a) directly generate revenue, (b) prevent customer churn, or (c) be legally required.

---

## Part 1: Current State Assessment

### What You Bring to the Table

| Capability | Strength | Time Demand |
|------------|----------|-------------|
| Full-stack engineering | Strong | 60-70% of time |
| CI/CD & DevOps | Strong | 10% of time |
| Customer presentations | Strong | Variable |
| Sales conversations | Strong | Growing demand |
| Product vision | Strong | Ongoing |

### The Founder's Dilemma

You're currently wearing every hat. As customers come in, this becomes unsustainable:

```
Week 1-4:   Engineering (80%) + Sales (20%)
Week 5-8:   Engineering (60%) + Sales (25%) + Support (15%)
Week 9-12:  Engineering (40%) + Sales (30%) + Support (20%) + Ops (10%)
Week 13+:   🔥 Everything breaks 🔥
```

**The inflection point hits around 10-15 paying customers.** After that, support tickets, feature requests, billing questions, and sales calls consume more time than you have.

---

## Part 2: The Minimum Viable Team

### Phase 1: Solo + AI Tools (Months 1-2)
**Burn Rate: $0 additional salary**

Before hiring anyone, maximize what you can automate and outsource to AI:

| Function | AI/Automation Solution | Monthly Cost |
|----------|----------------------|--------------|
| Customer support (L1) | Intercom/Crisp with AI bot | $0-50 |
| Documentation | Claude for drafting, you review | $20 |
| Marketing content | Claude for drafts, Canva for graphics | $25 |
| Social media | Buffer/Hootsuite + AI scheduling | $0-15 |
| Email campaigns | Mailchimp free tier + AI copy | $0 |
| Bookkeeping | Wave (free) or Bench ($150) | $0-150 |
| Legal templates | Termly, Clerky | $20-50 |

**Total additional burn: $65-310/month**

### Phase 2: First Hire (Months 2-4)
**Target: Technical Customer Success Engineer**

This is your highest-leverage first hire. Not a pure engineer. Not pure support. The hybrid.

**Why this role first:**
- Handles support tickets (frees 15-20 hours/week)
- Can do basic bug fixes and small features
- Understands the product deeply for customer calls
- Can write documentation and help content
- Eventually becomes customer success lead

**Profile:**
- Junior-to-mid level developer (2-4 years experience)
- Strong communication skills
- Comfortable with ambiguity
- Motivated by equity upside

**Compensation Structure (Lean):**

| Component | Amount | Notes |
|-----------|--------|-------|
| Base salary | $55,000-70,000 | Below market, equity compensates |
| Equity | 0.5-1.5% | 4-year vest, 1-year cliff |
| Benefits | Minimal | Health stipend ($200-400/mo) |
| Remote | Yes | No office costs |

**Where to find them:**
- AngelList/Wellfound (startup-minded candidates)
- Hacker News "Who wants to be hired" threads
- Local coding bootcamp graduates
- Indie Hackers community
- Twitter/X tech community

**Monthly cost: ~$5,500-7,000 (fully loaded)**

### Phase 3: Second Hire (Months 4-6)
**Target: Part-Time Sales Development Rep (SDR)**

Only hire when you have:
- Product-market fit signals (customers renewing, referrals coming in)
- A repeatable sales motion you can teach
- More inbound leads than you can handle

**Why part-time:**
- Test before committing to full-time
- SDR work is measurable (calls made, meetings booked)
- Can scale up hours as pipeline grows

**Compensation Structure:**

| Component | Amount | Notes |
|-----------|--------|-------|
| Base (part-time) | $2,000-3,000/mo | 20-25 hours/week |
| Commission | $200-500/meeting booked | Performance-based |
| Equity | 0.1-0.25% | Smaller, role is more transactional |

**Where to find them:**
- Upwork/Toptal (try before you buy)
- Sales bootcamp graduates (Aspireship, Vendition)
- Career changers from customer service
- College students (business/marketing majors)

**Monthly cost: ~$2,500-4,000**

---

## Part 3: The Lean Org Chart

### Month 1-2: Solo Founder + AI
```
┌─────────────────────────────────────────┐
│              YOU (Founder)               │
│  Engineering + Sales + Product + Ops     │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   [AI Support Bot]      [Automated Ops]
   - L1 tickets          - Billing (Stripe)
   - FAQ responses       - Monitoring alerts
   - Doc suggestions     - CI/CD pipeline
```

### Month 3-4: +1 Technical CSE
```
┌─────────────────────────────────────────┐
│              YOU (Founder)               │
│     Engineering + Sales + Product        │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
[Tech CSE]    [AI Support]    [Automated Ops]
- L2 support   - L1 tickets    - Billing
- Bug fixes    - FAQ           - Monitoring
- Docs         - Routing       - CI/CD
- Onboarding
```

### Month 5-6: +1 Part-Time SDR
```
┌─────────────────────────────────────────┐
│              YOU (Founder)               │
│       Engineering + Product + Deals      │
└─────────────────────────────────────────┘
                    │
    ┌───────────┬───┴───┬───────────┐
    ▼           ▼       ▼           ▼
[Tech CSE]  [PT SDR]  [AI Ops]  [Automation]
- Support   - Outbound - L1 tix  - Billing
- Bug fixes - LinkedIn  - FAQ    - Monitoring
- Docs      - Cold email        - CI/CD
- Onboard   - Qualify leads
```

---

## Part 4: Role-by-Role Playbook

### Your Role as Founder (First 6 Months)

**Time Allocation Target:**

| Activity | Months 1-2 | Months 3-4 | Months 5-6 |
|----------|------------|------------|------------|
| Engineering | 50% | 40% | 35% |
| Sales/Customer calls | 25% | 30% | 35% |
| Product decisions | 15% | 15% | 15% |
| Operations/Admin | 10% | 10% | 10% |
| Managing team | 0% | 5% | 5% |

**Non-Negotiable Founder Tasks:**
- Close deals (you're the best salesperson for now)
- Product vision and roadmap decisions
- Hiring decisions
- Investor relations
- Enterprise customer relationships
- Architecture decisions

**Delegate ASAP:**
- L1/L2 support tickets
- Documentation updates
- Routine bug fixes
- Social media posting
- Meeting scheduling
- Invoice chasing

### Technical Customer Success Engineer Playbook

**Week 1-2: Onboarding**
- Shadow you on 5+ customer calls
- Set up local development environment
- Fix 3-5 small bugs to learn codebase
- Read all existing documentation
- Monitor support channel (just observe)

**Week 3-4: Gradual Takeover**
- Handle L1 support tickets (you review)
- Fix bugs under 2-hour estimate
- Write first help article
- Join customer calls (you lead, they observe)

**Week 5-8: Full Ownership**
- Own all support tickets (escalate complex)
- Independent bug fixes
- Lead onboarding calls for small customers
- Maintain documentation
- Weekly 1:1 with you (30 min)

**Success Metrics:**
- First response time < 2 hours
- Resolution time < 24 hours (L1), < 72 hours (L2)
- Customer satisfaction > 4.5/5
- Bug fix velocity: 3-5/week
- Escalation rate < 20%

### Part-Time SDR Playbook

**Activities:**
- Research and build prospect lists
- Send personalized cold emails (50/day)
- LinkedIn outreach (20 connections/day)
- Qualify inbound leads
- Book discovery calls on your calendar

**Do NOT have them:**
- Run discovery calls (you do these)
- Handle pricing discussions
- Make product promises
- Negotiate contracts

**Success Metrics:**
- Meetings booked: 8-12/month
- Email open rate: >40%
- Response rate: >5%
- Lead-to-meeting: >15%
- Show rate: >80%

---

## Part 5: Compensation Philosophy

### The Startup Compensation Stack

```
┌────────────────────────────────────────────────────┐
│  TOTAL COMPENSATION = Base + Equity + Flexibility  │
└────────────────────────────────────────────────────┘

Traditional Job:     $100K base + minimal equity + rigid schedule
Your Offer:          $65K base + meaningful equity + full flexibility

Equity value if exit at $20M:
  - 1% = $200,000
  - 0.5% = $100,000
```

### Equity Guidelines (Early Stage)

| Role | Equity Range | Vesting |
|------|-------------|---------|
| Technical Co-founder | 10-25% | 4yr/1yr cliff |
| First engineer hire | 0.5-2% | 4yr/1yr cliff |
| Technical CSE (#1) | 0.5-1.5% | 4yr/1yr cliff |
| SDR (part-time) | 0.1-0.25% | 2yr/6mo cliff |
| Contractors | 0% | N/A |

**Equity Best Practices:**
- Use 409A valuation (get one done, ~$1,000-2,000)
- Issue ISOs for employees, NSOs for contractors
- Keep a clean cap table from day one
- Reserve 10-15% for employee option pool

### Benefits on a Budget

| Benefit | Budget Approach | Monthly Cost |
|---------|-----------------|--------------|
| Health | QSEHRA stipend | $300-500/employee |
| Retirement | No 401k yet | $0 |
| PTO | Flexible/unlimited | $0 |
| Equipment | $1,000 one-time setup | Amortized |
| Remote work | Included | $0 |
| Learning | $500/year budget | ~$40/mo |

---

## Part 6: Alternative Staffing Models

### Option A: Technical Co-Founder Instead of Employee

**Pros:**
- Shares the burden 50/50
- No salary needed (equity only)
- Brings complementary skills
- Emotional support/partnership

**Cons:**
- Gives up significant equity (20-40%)
- Decision-making friction
- Harder to "fire" if not working
- Must find right cultural fit

**Where to find:**
- Y Combinator co-founder matching
- Indie Hackers community
- Local startup events
- Former colleagues

**When to pursue:**
- You're feeling burned out solo
- Found someone with complementary skills (if you're backend, find frontend)
- They bring network/customers
- You work well together (do a 2-week trial project)

### Option B: Offshore/Nearshore Engineering Support

**Pros:**
- 50-70% cost savings
- Access to large talent pool
- Timezone coverage (support)

**Cons:**
- Communication overhead
- Quality variance
- Cultural differences
- Management burden

**Recommended approach:**
- Use for specific, well-defined tasks only
- NOT for customer-facing roles
- Try platforms: Toptal, Turing, Arc.dev
- Budget: $25-50/hour for senior talent

**Best uses:**
- Bug fixes with clear reproduction steps
- Feature implementation with detailed specs
- Testing and QA
- Documentation translation

### Option C: Fractional Roles

For functions you need but not full-time:

| Role | Hours/Week | Monthly Cost | When to Use |
|------|------------|--------------|-------------|
| Fractional CFO | 5-10 | $1,500-3,000 | Series A prep, complex finances |
| Fractional CMO | 10-15 | $3,000-5,000 | Need marketing strategy |
| Part-time legal | As needed | $300-500/hr | Contracts, compliance |
| Bookkeeper | 5-10 | $500-1,000 | Monthly close, invoicing |

---

## Part 7: Monthly Burn Rate Scenarios

### Scenario A: Absolute Minimum (Solo + AI)
```
Infrastructure (from business doc):     $147/mo
AI/Automation tools:                    $100/mo
Software subscriptions:                 $200/mo
───────────────────────────────────────────────
Total Monthly Burn:                     $447/mo
```

### Scenario B: Lean Team (Months 3-4)
```
Infrastructure:                         $200/mo  (growing usage)
AI/Automation tools:                    $150/mo
Software subscriptions:                 $300/mo
Tech CSE salary:                        $6,000/mo
Health stipend:                         $400/mo
Equipment (amortized):                  $100/mo
Misc (legal, accounting):               $300/mo
───────────────────────────────────────────────
Total Monthly Burn:                     $7,450/mo
```

### Scenario C: Growth Mode (Months 5-6)
```
Infrastructure:                         $300/mo  (scaling)
AI/Automation tools:                    $200/mo
Software subscriptions:                 $400/mo
Tech CSE salary:                        $6,000/mo
Part-time SDR:                          $3,000/mo
Health stipends:                        $600/mo
Equipment (amortized):                  $150/mo
Sales tools (Apollo, etc.):             $200/mo
Misc (legal, accounting):               $400/mo
───────────────────────────────────────────────
Total Monthly Burn:                     $11,250/mo
```

### Runway Analysis

| Funding | Scenario A | Scenario B | Scenario C |
|---------|-----------|------------|------------|
| $50K | 111 months | 6.7 months | 4.4 months |
| $100K | 223 months | 13.4 months | 8.9 months |
| $200K | 447 months | 26.8 months | 17.8 months |
| $500K | 1,118 months | 67 months | 44.4 months |

**Reality check:** With $200K funding, you have ~18 months in growth mode to hit profitability or raise again.

---

## Part 8: The First 90 Days Game Plan

### Days 1-30: Foundation

**Week 1: Automation Blitz**
- [ ] Set up Intercom/Crisp with AI bot for L1 support
- [ ] Create 20 FAQ responses for common questions
- [ ] Set up automated onboarding email sequence (5 emails)
- [ ] Configure Stripe for self-service billing
- [ ] Set up basic monitoring alerts (PagerDuty yourself)

**Week 2: Process Documentation**
- [ ] Document your sales process (discovery call script)
- [ ] Document your onboarding process (checklist)
- [ ] Document common support issues and solutions
- [ ] Create employee handbook draft (even if no employees)

**Week 3-4: Customer Acquisition Focus**
- [ ] Launch on Product Hunt (one day of focused effort)
- [ ] Post in 5 relevant communities (Reddit, HN, etc.)
- [ ] Reach out to 20 potential pilot customers
- [ ] Set up basic analytics (Mixpanel/Amplitude free tier)

**Success Criteria for Month 1:**
- [ ] 3-5 pilot customers onboarded
- [ ] Support response time < 4 hours
- [ ] Zero customer-facing outages
- [ ] Sales pipeline of 10+ prospects

### Days 31-60: First Hire Sprint

**Week 5: Job Posting**
- [ ] Write job description for Technical CSE
- [ ] Post on AngelList, LinkedIn, Hacker News
- [ ] Share in personal network
- [ ] Set up simple ATS (Notion or Lever free)

**Week 6-7: Interviewing**
- [ ] Screen 15-20 applications
- [ ] Phone screen 8-10 candidates
- [ ] Technical interview 4-5 candidates
- [ ] Final round with 2-3 candidates

**Week 8: Hiring**
- [ ] Make offer
- [ ] Set up payroll (Gusto, $40/mo)
- [ ] Prepare onboarding materials
- [ ] Order equipment

**Success Criteria for Month 2:**
- [ ] Technical CSE hired and start date set
- [ ] 8-10 paying customers
- [ ] First customer expansion/upsell
- [ ] Documented sales playbook

### Days 61-90: Scale Preparation

**Week 9-10: New Hire Onboarding**
- [ ] Complete Technical CSE onboarding
- [ ] Transition support queue ownership
- [ ] Review and improve documentation
- [ ] Establish weekly 1:1 cadence

**Week 11-12: Growth Experiments**
- [ ] Launch referral program
- [ ] Test 3 different outreach approaches
- [ ] Begin SDR candidate search
- [ ] Plan Q2 roadmap based on customer feedback

**Success Criteria for Month 3:**
- [ ] 15-20 paying customers
- [ ] Technical CSE handling 80%+ of support
- [ ] NPS score > 40
- [ ] MRR > $3,000
- [ ] Clear path to $10K MRR

---

## Part 9: Tools Stack (Lean Budget)

### Must-Haves (Month 1)

| Tool | Purpose | Cost |
|------|---------|------|
| Stripe | Payments & billing | 2.9% + $0.30/txn |
| Intercom Starter | Support + AI bot | $74/mo |
| Notion | Internal wiki, ATS | $0 |
| Slack | Team communication | $0 |
| GitHub | Code + project management | $0 |
| Google Workspace | Email, docs | $6/user/mo |
| Calendly | Meeting scheduling | $0 |

**Monthly total: ~$100 + transaction fees**

### Nice-to-Haves (Month 3+)

| Tool | Purpose | Cost |
|------|---------|------|
| Apollo.io | Sales prospecting | $49/mo |
| Loom | Async video updates | $0 |
| Linear | Issue tracking | $0 |
| Metabase | Analytics dashboard | $0 (self-hosted) |
| Gusto | Payroll | $40 + $6/employee |

### Skip for Now

- Salesforce (use Notion or HubSpot free)
- Zendesk (use Intercom)
- Fancy analytics (use Mixpanel free)
- HR software (use spreadsheets)
- Expensive project management (use GitHub Projects)

---

## Part 10: Risk Mitigation

### Biggest Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Founder burnout | High | Critical | Hire help before breaking; take 1 day off/week |
| Bad first hire | Medium | High | 30-day trial period; clear success metrics |
| Cash runs out | Medium | Critical | Track burn weekly; have 3-month runway minimum |
| Key customer churns | Medium | High | Diversify customer base; listen to feedback |
| Support overwhelm | High | Medium | AI bot first; hire Tech CSE early |
| Technical debt | Medium | Medium | Allocate 20% time to maintenance |

### Emergency Playbook

**If burn rate exceeds plan:**
1. Pause all non-essential subscriptions
2. Reduce part-time hours before cutting salary
3. Look for quick revenue wins (annual prepay discounts)
4. Consider contractor pause before full-time cuts

**If first hire doesn't work out:**
1. Address issues directly in first 2 weeks
2. Document performance concerns
3. If no improvement by day 30, exit quickly
4. Don't let a bad hire linger (costs more in the long run)

**If you're burning out:**
1. Recognize the signs (working 7 days, irritability, mistakes)
2. Hire help even if "not ready"
3. Automate one major time sink immediately
4. Block 1 day/week as no-meeting recovery time

---

## Part 11: Key Metrics to Track Weekly

### Operational Health
- [ ] Runway remaining (months)
- [ ] Weekly burn rate
- [ ] Support ticket volume & response time
- [ ] NPS/CSAT scores
- [ ] Your working hours (be honest)

### Business Health
- [ ] MRR and growth rate
- [ ] New customers this week
- [ ] Churned customers this week
- [ ] Pipeline value
- [ ] Conversion rates (trial → paid)

### Team Health (once you have one)
- [ ] Employee satisfaction (monthly pulse)
- [ ] Ticket resolution rate
- [ ] Bugs fixed vs. created
- [ ] Meeting booked (SDR)

---

## Summary: The Game Plan

```
┌─────────────────────────────────────────────────────────────┐
│                    THE LEAN STARTUP PATH                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Month 1-2: SURVIVE                                          │
│  ├─ Solo founder + AI automation                            │
│  ├─ Burn: $450/month                                        │
│  ├─ Goal: 5 pilot customers, validate product-market fit    │
│  └─ Hire trigger: Support taking >15 hrs/week               │
│                                                              │
│  Month 3-4: STABILIZE                                        │
│  ├─ Add Technical CSE (first hire)                          │
│  ├─ Burn: $7,500/month                                      │
│  ├─ Goal: 15 customers, <2hr support response               │
│  └─ Hire trigger: >20 qualified leads/month                 │
│                                                              │
│  Month 5-6: SCALE                                            │
│  ├─ Add Part-time SDR                                       │
│  ├─ Burn: $11,250/month                                     │
│  ├─ Goal: 30 customers, $10K MRR                            │
│  └─ Next: Consider full-time SDR or second engineer         │
│                                                              │
│  Month 7+: GROW                                              │
│  ├─ Hire based on bottlenecks                               │
│  ├─ Target: 50% MoM growth until $100K MRR                  │
│  └─ Prepare for Series A when $50K+ MRR with growth         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Remember:** The goal isn't to stay lean forever—it's to stay lean until you have the revenue and traction to justify scaling. Every dollar saved in months 1-6 is a dollar that extends your runway to find product-market fit.

---

*Last updated: December 2024*
*Document owner: Founder*
*Review frequency: Monthly*
