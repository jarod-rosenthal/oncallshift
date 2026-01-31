# Troubleshooting Guide

Solutions to common issues with OnCallShift. Can't find your answer? [Contact support](./contact.md).

## Table of Contents

- [Notification Issues](#notification-issues)
- [Mobile App Issues](#mobile-app-issues)
- [Login and Authentication](#login-and-authentication)
- [Schedule Issues](#schedule-issues)
- [Integration Problems](#integration-problems)
- [Incident Management](#incident-management)
- [Performance Issues](#performance-issues)

---

## Notification Issues

### Not Receiving Push Notifications

**On iOS:**

1. **Check notification permissions**
   - Go to Settings > Notifications > OnCallShift
   - Ensure "Allow Notifications" is enabled
   - Enable "Sounds" and "Badges"

2. **Check Do Not Disturb**
   - Disable DND or add OnCallShift to allowed apps
   - Settings > Focus > Do Not Disturb > Apps > Add OnCallShift

3. **Check app settings**
   - Open OnCallShift app > Settings > Notifications
   - Verify push notifications are enabled

4. **Re-register for push**
   - Log out of the app
   - Force close the app
   - Log back in
   - Allow notifications when prompted

**On Android:**

1. **Check notification permissions**
   - Settings > Apps > OnCallShift > Notifications
   - Enable all notification categories
   - Disable "Battery Optimization" for OnCallShift

2. **Check notification channels**
   - Critical Alerts: High importance
   - Incident Updates: Default importance
   - Enable all channels

3. **Battery optimization**
   - Settings > Battery > OnCallShift > Don't optimize
   - Some manufacturers have aggressive battery saving

**General checks:**

- Verify you're on-call: Check your schedule
- Verify the service's escalation policy includes you
- Check if someone else acknowledged before escalation reached you

### Not Receiving Emails

1. **Check spam/junk folder**
   - Search for emails from `@oncallshift.com`
   - Mark as "Not Spam"
   - Add to contacts

2. **Verify email address**
   - Go to Settings > Profile
   - Confirm email is correct
   - Check for typos

3. **Check notification preferences**
   - Settings > Notifications
   - Verify email notifications are enabled

4. **Whitelist our senders**
   - Add these to your allowed senders:
     - `noreply@oncallshift.com`
     - `alerts@oncallshift.com`
     - `reports@oncallshift.com`

5. **Check email provider**
   - Some corporate email filters block external mail
   - Ask IT to whitelist `oncallshift.com`

### Not Receiving SMS

1. **Verify phone number**
   - Settings > Profile > Phone Number
   - Include country code (e.g., +1 for US)

2. **Check SMS credits**
   - Contact your admin to verify SMS quota
   - Some plans have SMS limits

3. **Carrier issues**
   - Some carriers block automated SMS
   - Try a different phone number

4. **Check notification rules**
   - SMS may only be enabled for critical alerts
   - Review your notification preferences

### Notifications Delayed

1. **Check device connectivity**
   - Ensure stable internet connection
   - Try switching between WiFi and cellular

2. **Check OnCallShift status**
   - Visit [status.oncallshift.com](https://status.oncallshift.com)
   - Check for reported delivery delays

3. **Push notification delays**
   - Apple/Google sometimes delay push delivery
   - Add SMS as backup for critical alerts

---

## Mobile App Issues

### App Won't Open or Crashes

1. **Update the app**
   - Check App Store/Play Store for updates
   - Install latest version

2. **Clear app data (Android)**
   - Settings > Apps > OnCallShift > Storage > Clear Cache
   - If needed, Clear Data (will log you out)

3. **Reinstall the app**
   - Delete the app
   - Restart your phone
   - Reinstall from store
   - Log in again

### App Not Syncing

1. **Check connectivity**
   - Ensure internet connection is working
   - Try switching networks

2. **Pull to refresh**
   - Drag down on the incident list to refresh
   - Wait for sync to complete

3. **Force sync**
   - Go to Settings > Sync Now
   - Or log out and back in

4. **Check app version**
   - Outdated apps may have sync issues
   - Update to latest version

### Login Issues on Mobile

1. **Check credentials**
   - Verify email and password
   - Try logging into web first

2. **Reset password**
   - Use "Forgot Password" on login screen
   - Check email for reset link

3. **SSO issues**
   - Ensure corporate VPN is connected if required
   - Contact admin if SSO is failing

4. **Clear app data**
   - Log out
   - Clear cache/data
   - Reinstall if needed

### Push Notifications Not Working After Update

1. **Re-register for push**
   - Log out of the app
   - Log back in
   - Allow notifications when prompted

2. **Check permissions again**
   - OS updates can reset permissions
   - Re-enable notification permissions

---

## Login and Authentication

### Can't Log In

1. **Check credentials**
   - Verify email is correct
   - Passwords are case-sensitive
   - Check for extra spaces

2. **Reset password**
   - Click "Forgot Password"
   - Check email (including spam)
   - Follow reset link

3. **Account locked**
   - After 5 failed attempts, accounts lock for 15 minutes
   - Wait or contact admin

4. **SSO users**
   - Use "Sign in with SSO"
   - Check your identity provider status
   - Contact IT if SSO is down

### Session Expired

1. **Log in again**
   - Sessions expire after 30 days by default
   - Simply log in again

2. **"Remember me" option**
   - Check "Remember me" to extend session
   - Not recommended on shared devices

### Two-Factor Authentication Issues

1. **Authenticator app**
   - Check time is synced on your device
   - Try regenerating the code
   - Use backup codes if available

2. **Lost access to 2FA**
   - Use backup codes provided at setup
   - Contact admin to reset 2FA
   - May require identity verification

### Password Reset Not Working

1. **Check email**
   - Reset emails come from `noreply@oncallshift.com`
   - Check spam folder
   - Wait a few minutes

2. **Link expired**
   - Reset links expire after 1 hour
   - Request a new reset link

3. **Wrong email**
   - Verify you're using the correct email
   - Contact admin if unsure

---

## Schedule Issues

### Schedule Shows Wrong On-Call

1. **Check timezone**
   - Schedule timezone may differ from yours
   - Go to schedule settings to verify

2. **Check layers**
   - Multiple layers may overlap
   - Override layer takes precedence

3. **Check overrides**
   - Someone may have created an override
   - View schedule in calendar mode

4. **Refresh**
   - Schedules cache briefly
   - Refresh the page or pull to refresh

### Missing from Schedule

1. **Check you're added**
   - Contact schedule owner
   - Verify your email matches

2. **Check rotation**
   - You may be later in the rotation
   - View full rotation to see your slot

3. **Deleted by mistake**
   - Contact schedule manager
   - They can re-add you

### Schedule Conflicts

When you're on multiple schedules:

1. **View all schedules**
   - Go to Schedules > My Schedules
   - See overlapping shifts

2. **Create overrides**
   - Have someone cover one schedule
   - Or escalation will page both schedules

3. **Contact manager**
   - Schedule conflicts should be resolved
   - Avoid being on-call for multiple teams

### Override Not Working

1. **Check dates/times**
   - Ensure override covers the right period
   - Check timezone matches schedule

2. **Check layer**
   - Override must be on correct layer
   - Higher layers take precedence

3. **Override not saved**
   - Verify override appears in schedule
   - Check for validation errors

---

## Integration Problems

### Alerts Not Creating Incidents

1. **Check webhook URL**
   - Verify the URL is correct
   - Ensure no typos or extra characters

2. **Check authentication**
   - API key or service key is correct
   - Key has write permissions

3. **Test the integration**
   - Use curl to test:
   ```bash
   curl -X POST "https://oncallshift.com/api/v1/alerts/webhook" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"summary": "Test alert"}'
   ```

4. **Check service status**
   - Service may be disabled
   - Service may be in maintenance mode

5. **View integration logs**
   - Service > Integrations > View Events
   - Check for errors in received events

### Slack Integration Not Working

1. **Reconnect Slack**
   - Settings > Integrations > Slack > Reconnect
   - Re-authorize the app

2. **Bot not in channel**
   - Invite `@OnCallShift` to the channel
   - Bot can only post where invited

3. **Buttons not responding**
   - Slack OAuth may have expired
   - Reconnect the integration

4. **Channel mapping**
   - Verify channel is mapped to service
   - Check severity filter allows the alert

### API Errors

1. **401 Unauthorized**
   - API key is invalid or expired
   - Generate a new key

2. **403 Forbidden**
   - Key doesn't have required permissions
   - Check key scope (read-only vs read-write)

3. **404 Not Found**
   - Resource doesn't exist
   - Check the ID is correct

4. **429 Rate Limited**
   - Slow down requests
   - Implement exponential backoff

5. **500 Server Error**
   - Check [status.oncallshift.com](https://status.oncallshift.com)
   - Retry with backoff
   - Contact support if persists

---

## Incident Management

### Can't Acknowledge Incident

1. **Already acknowledged**
   - Someone else may have acknowledged
   - Check incident timeline

2. **Incident resolved**
   - Resolved incidents can't be acknowledged
   - Check incident status

3. **Permission issue**
   - Verify you're on the escalation path
   - Contact admin if you need access

### Can't Resolve Incident

1. **Not assigned**
   - May need to acknowledge first
   - Or be assigned to the incident

2. **Permission issue**
   - Check your role permissions
   - Contact admin

### Incident Won't Escalate

1. **Already acknowledged**
   - Acknowledged incidents don't auto-escalate
   - Manually escalate if needed

2. **End of escalation policy**
   - All steps completed
   - Incident repeats last step or stops

3. **Escalation policy issue**
   - Check policy has multiple steps
   - Verify timeout settings

### Duplicate Incidents

1. **Deduplication key**
   - Set consistent `dedup_key` in alerts
   - Same key = same incident

2. **Time window**
   - Deduplication window is 24 hours
   - Older alerts create new incidents

3. **Different services**
   - Alerts to different services = different incidents
   - Route to same service for deduplication

---

## Performance Issues

### Dashboard Loading Slowly

1. **Check connection**
   - Test your internet speed
   - Try a different network

2. **Clear browser cache**
   - Clear cache and cookies
   - Try incognito/private mode

3. **Reduce date range**
   - Large date ranges load more data
   - Filter to recent incidents

4. **Check OnCallShift status**
   - Visit [status.oncallshift.com](https://status.oncallshift.com)

### API Response Times

1. **Pagination**
   - Use pagination for large datasets
   - Don't request all records at once

2. **Caching**
   - Cache responses where appropriate
   - Use ETags for conditional requests

3. **Regional latency**
   - API is hosted in US East
   - Consider this for latency calculations

### Mobile App Slow

1. **Update app**
   - Older versions may be slower
   - Update to latest

2. **Clear cache**
   - Settings > Clear Cache

3. **Reduce data**
   - Limit number of items displayed
   - Use filters to narrow results

---

## Still Need Help?

If these solutions didn't resolve your issue:

1. **Check status page**: [status.oncallshift.com](https://status.oncallshift.com)
2. **Search documentation**: Use Ctrl/Cmd + K
3. **Contact support**: [support@oncallshift.com](mailto:support@oncallshift.com)

When contacting support, include:
- Your email address
- Organization name
- Description of the issue
- Steps to reproduce
- Screenshots if applicable
- Any error messages

---

*For urgent issues during incidents, email support@oncallshift.com with "URGENT" in the subject.*
