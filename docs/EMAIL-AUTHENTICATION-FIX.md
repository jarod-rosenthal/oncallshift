# Email Authentication Fix - Stop Emails from Going to Spam

## Problem

Emails from OnCallShift are being marked as spam with the warning:
> "This email has failed its domain's authentication requirements. It may be spoofed or improperly forwarded."

This occurs when SPF, DKIM, or DMARC authentication fails.

---

## Current DNS Configuration

Your Terraform already has email authentication records defined in `/infrastructure/terraform/environments/dev/main.tf` (lines 268-336):

```hcl
# ProtonMail TXT records (verification and SPF)
resource "aws_route53_record" "protonmail_txt" {
  records = [
    "protonmail-verification=fc93d89c63116acd6455ebdb1bc45cd47f9e4d6b",
    "v=spf1 include:_spf.protonmail.ch ~all"
  ]
}

# ProtonMail DKIM CNAME records (3 keys)
resource "aws_route53_record" "protonmail_dkim" {
  name = "protonmail._domainkey.${var.domain_name}"
  records = ["protonmail.domainkey.dypowykbuzkuqq5u3skixytgcwuv4zo4b5ptyc4f7ti6kofmn5ysa.domains.proton.ch."]
}
# ... protonmail2 and protonmail3

# ProtonMail DMARC TXT record
resource "aws_route53_record" "protonmail_dmarc" {
  name = "_dmarc.${var.domain_name}"
  records = ["v=DMARC1; p=quarantine"]
}
```

---

## Root Cause Analysis

### Likely Issues

1. **DKIM Keys Don't Match Your ProtonMail Account**
   - The DKIM values in Terraform are hardcoded
   - They may not match YOUR actual ProtonMail account's DKIM keys
   - Each ProtonMail account gets unique DKIM keys

2. **DMARC Policy Too Strict**
   - Current policy: `p=quarantine` (send failed emails to spam/quarantine)
   - If SPF/DKIM fail, DMARC will quarantine the email

3. **DNS Records Not Applied or Outdated**
   - Records may not have been applied via `terraform apply`
   - DNS propagation can take 24-48 hours

4. **Domain Not Set in Terraform Variables**
   - If `domain_name` variable is not set, these records won't be created
   - Records are conditional: `count = var.domain_name != null ? 1 : 0`

---

## The Fix

### Step 1: Get YOUR ProtonMail DKIM Keys

You need to get the **actual DKIM keys** from your ProtonMail account:

1. Log in to ProtonMail web interface
2. Go to **Settings** → **Domains** → Click your domain (oncallshift.com)
3. Click **Verify** or **DNS Settings**
4. Copy the three DKIM CNAME records shown (they look like):
   ```
   protonmail._domainkey     CNAME   protonmail.domainkey.XXXXXXXX.domains.proton.ch.
   protonmail2._domainkey    CNAME   protonmail2.domainkey.XXXXXXXX.domains.proton.ch.
   protonmail3._domainkey    CNAME   protonmail3.domainkey.XXXXXXXX.domains.proton.ch.
   ```

5. Also copy the **ProtonMail verification TXT record** (looks like):
   ```
   protonmail-verification=XXXXXXXXXX
   ```

### Step 2: Update Terraform with Your Actual Keys

Edit `/infrastructure/terraform/environments/dev/main.tf`:

**Line 277 - Update verification code:**
```hcl
resource "aws_route53_record" "protonmail_txt" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 3600
  records = [
    "protonmail-verification=YOUR_ACTUAL_VERIFICATION_CODE_HERE",  # ← UPDATE THIS
    "v=spf1 include:_spf.protonmail.ch ~all"  # ← This is usually correct
  ]
}
```

**Lines 297-325 - Update DKIM CNAME targets:**
```hcl
resource "aws_route53_record" "protonmail_dkim" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "protonmail._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 3600
  records = ["YOUR_ACTUAL_DKIM1_VALUE_HERE"]  # ← UPDATE THIS
}

resource "aws_route53_record" "protonmail_dkim2" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "protonmail2._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 3600
  records = ["YOUR_ACTUAL_DKIM2_VALUE_HERE"]  # ← UPDATE THIS
}

resource "aws_route53_record" "protonmail_dkim3" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "protonmail3._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 3600
  records = ["YOUR_ACTUAL_DKIM3_VALUE_HERE"]  # ← UPDATE THIS
}
```

### Step 3: Temporarily Soften DMARC Policy

While debugging, change DMARC from `quarantine` to `none` to prevent spam filtering:

**Line 328-336:**
```hcl
resource "aws_route53_record" "protonmail_dmarc" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=none; rua=mailto:dmarc@oncallshift.com"]  # ← Changed to p=none
}
```

**What this does:**
- `p=none` - Monitor only, don't quarantine failed emails
- `rua=mailto:dmarc@oncallshift.com` - Send aggregate reports to this email

Once everything is working, you can change back to `p=quarantine` or `p=reject`.

### Step 4: Ensure Domain Name is Set

Check if you have a `terraform.tfvars` file in `/infrastructure/terraform/environments/dev/`:

```bash
cd /mnt/c/Users/jarod/github/pagerduty-lite/infrastructure/terraform/environments/dev
ls -la *.tfvars
```

If it exists, verify it contains:
```hcl
domain_name = "oncallshift.com"
```

If the file doesn't exist, create `terraform.tfvars`:
```hcl
# terraform.tfvars
domain_name = "oncallshift.com"
project_name = "pagerduty-lite"
environment = "dev"
```

### Step 5: Apply the Changes

```bash
cd /mnt/c/Users/jarod/github/pagerduty-lite/infrastructure/terraform/environments/dev

# Review what will change
terraform plan

# Apply the changes
terraform apply
```

Type `yes` when prompted.

### Step 6: Wait for DNS Propagation

DNS changes can take **1-48 hours** to propagate globally. Most updates happen within 1-4 hours.

---

## Verification

### Check DNS Records Are Live

Use `dig` or online DNS checkers:

```bash
# Check SPF
dig TXT oncallshift.com +short

# Check DKIM
dig CNAME protonmail._domainkey.oncallshift.com +short
dig CNAME protonmail2._domainkey.oncallshift.com +short
dig CNAME protonmail3._domainkey.oncallshift.com +short

# Check DMARC
dig TXT _dmarc.oncallshift.com +short
```

**Expected results:**
```
# SPF
"protonmail-verification=..." "v=spf1 include:_spf.protonmail.ch ~all"

# DKIM (should match what ProtonMail gave you)
protonmail.domainkey.XXXXXXXX.domains.proton.ch.
protonmail2.domainkey.XXXXXXXX.domains.proton.ch.
protonmail3.domainkey.XXXXXXXX.domains.proton.ch.

# DMARC
"v=DMARC1; p=none; rua=mailto:dmarc@oncallshift.com"
```

### Online DNS Verification Tools

Use these free tools to verify all records:

1. **MXToolbox** (comprehensive check)
   - SPF: https://mxtoolbox.com/spf.aspx
   - DKIM: https://mxtoolbox.com/dkim.aspx
   - DMARC: https://mxtoolbox.com/dmarc.aspx

2. **Google Admin Toolbox** (excellent diagnostics)
   - https://toolbox.googleapps.com/apps/checkmx/

3. **DMARC Analyzer**
   - https://www.dmarcanalyzer.com/dmarc/dmarc-record-check/

### Send a Test Email

1. Send a test email from ProtonMail to Gmail
2. Open the email in Gmail
3. Click the three-dot menu → **Show original**
4. Check the authentication results:

**Good (passing):**
```
SPF: PASS
DKIM: PASS
DMARC: PASS
```

**Bad (what you're seeing now):**
```
SPF: FAIL or SOFTFAIL
DKIM: FAIL
DMARC: FAIL
```

### Verify in ProtonMail

1. Go to ProtonMail Settings → Domains → oncallshift.com
2. Click **Verify**
3. All DNS records should show green checkmarks ✓

---

## Understanding the Authentication Stack

### SPF (Sender Policy Framework)
**What it does:** Verifies the sending server is authorized to send email for your domain

**Your record:**
```
v=spf1 include:_spf.protonmail.ch ~all
```

- `v=spf1` - Version 1 of SPF
- `include:_spf.protonmail.ch` - Authorize ProtonMail's servers
- `~all` - Soft fail for all others (mark as suspicious but deliver)

**Common issues:**
- Missing SPF record
- Wrong include domain
- Multiple SPF records (only one allowed)

### DKIM (DomainKeys Identified Mail)
**What it does:** Cryptographically signs emails to prove they came from your domain and weren't modified

**Your records:** Three CNAME records pointing to ProtonMail's DKIM keys

**Common issues:**
- DKIM keys don't match your ProtonMail account ← **This is likely your issue**
- CNAME records have wrong values
- DNS not propagated

### DMARC (Domain-based Message Authentication)
**What it does:** Tells receiving servers what to do if SPF or DKIM fails

**Your record:**
```
v=DMARC1; p=none; rua=mailto:dmarc@oncallshift.com
```

- `v=DMARC1` - Version 1
- `p=none` - Monitor mode (don't reject)
- `p=quarantine` - Send to spam if fail ← **Current setting causing spam**
- `p=reject` - Reject email if fail (most strict)
- `rua=` - Send aggregate reports here

---

## Recommended DMARC Progression

### Phase 1: Monitor (Start here)
```
v=DMARC1; p=none; rua=mailto:dmarc@oncallshift.com
```
- Monitors authentication results
- Sends weekly reports
- Doesn't affect delivery

### Phase 2: Quarantine (After 2-4 weeks of monitoring)
```
v=DMARC1; p=quarantine; pct=10; rua=mailto:dmarc@oncallshift.com
```
- Quarantine 10% of failing emails
- Gradually increase `pct` to 100 over time

### Phase 3: Reject (Production hardening)
```
v=DMARC1; p=reject; rua=mailto:dmarc@oncallshift.com; ruf=mailto:dmarc-forensics@oncallshift.com
```
- Reject all failing emails
- Maximum protection against spoofing
- Only use when 100% confident SPF/DKIM are working

---

## Common Mistakes to Avoid

1. **Don't use hardcoded DKIM values from examples**
   - Every ProtonMail account has unique keys
   - You MUST get them from your ProtonMail settings

2. **Don't set DMARC to `p=reject` before testing**
   - Start with `p=none` to monitor
   - Move to `p=quarantine` then `p=reject` gradually

3. **Don't skip DNS propagation time**
   - Wait at least 2-4 hours before testing
   - Some resolvers cache for 24-48 hours

4. **Don't forget the trailing dot in CNAME records**
   - Terraform handles this automatically
   - But if entering manually, use: `protonmail.domainkey.XXX.domains.proton.ch.`

5. **Don't create multiple SPF records**
   - Only ONE TXT record with SPF
   - Multiple records will cause validation to fail

---

## Troubleshooting

### Issue: "DNS records still showing old values"

**Solution:**
```bash
# Flush your local DNS cache
# On macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# On Linux:
sudo systemd-resolve --flush-caches

# On Windows:
ipconfig /flushdns
```

### Issue: "ProtonMail says DNS not verified"

**Solution:**
1. Wait 24 hours for full DNS propagation
2. Double-check you copied the exact DKIM values
3. Check for typos (common with long strings)
4. Use a different DNS checker to verify

### Issue: "SPF passes but DKIM fails"

**Solution:**
- DKIM keys don't match your ProtonMail account
- Go back to ProtonMail settings and copy the correct keys
- Update Terraform and re-apply

### Issue: "All records pass but emails still go to spam"

**Possible causes:**
1. **Reputation:** New domain/IP needs time to build reputation
2. **Content:** Email content triggers spam filters (ALL CAPS, too many links, etc.)
3. **Engagement:** Low open/high bounce rates hurt reputation
4. **Blacklists:** Check if domain/IP is blacklisted at https://mxtoolbox.com/blacklists.aspx

**Solutions:**
- Warm up the domain (start with small send volumes)
- Avoid spam trigger words
- Use plain text + HTML combo
- Add unsubscribe links
- Monitor DMARC reports for insights

### Issue: "Terraform says domain_name is null"

**Solution:**
```bash
cd infrastructure/terraform/environments/dev

# Create terraform.tfvars if it doesn't exist
cat > terraform.tfvars <<EOF
domain_name = "oncallshift.com"
EOF

# Re-run
terraform plan
```

---

## Quick Reference: Required DNS Records

For domain: **oncallshift.com**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | @ | `protonmail-verification=YOUR_CODE` | 3600 |
| TXT | @ | `v=spf1 include:_spf.protonmail.ch ~all` | 3600 |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc@oncallshift.com` | 3600 |
| CNAME | protonmail._domainkey | `protonmail.domainkey.YOUR_KEY.domains.proton.ch.` | 3600 |
| CNAME | protonmail2._domainkey | `protonmail2.domainkey.YOUR_KEY.domains.proton.ch.` | 3600 |
| CNAME | protonmail3._domainkey | `protonmail3.domainkey.YOUR_KEY.domains.proton.ch.` | 3600 |
| MX | @ | `10 mail.protonmail.ch` | 3600 |
| MX | @ | `20 mailsec.protonmail.ch` | 3600 |

---

## Summary: What You Need to Do

1. ✅ Log in to ProtonMail and get YOUR actual DKIM keys
2. ✅ Update lines 277, 304, 314, 324 in `main.tf` with your keys
3. ✅ Change DMARC policy from `p=quarantine` to `p=none` (line 335)
4. ✅ Ensure `domain_name = "oncallshift.com"` is set in `terraform.tfvars`
5. ✅ Run `terraform apply` to deploy changes
6. ✅ Wait 2-24 hours for DNS propagation
7. ✅ Verify DNS records with `dig` or online tools
8. ✅ Send test email and check authentication headers
9. ✅ Monitor DMARC reports for 2-4 weeks
10. ✅ Gradually tighten DMARC policy to `p=quarantine` then `p=reject`

---

## Additional Resources

- **ProtonMail DNS Setup Guide:** https://proton.me/support/dns-records
- **Google's SPF Guide:** https://support.google.com/a/answer/33786
- **DMARC.org:** https://dmarc.org/overview/
- **MXToolbox (free DNS checker):** https://mxtoolbox.com/
- **DMARC Reports Analyzer:** https://dmarcian.com/

---

*Last updated: December 2024*
*File location: `/docs/EMAIL-AUTHENTICATION-FIX.md`*
