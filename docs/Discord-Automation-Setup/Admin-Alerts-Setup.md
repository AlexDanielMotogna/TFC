# Discord Admin Alerts Setup Guide

**For: Adam (Discord Server Administrator)**
**Purpose:** Configure Discord webhooks for automated admin alerts from TFC backend
**Status:** To be implemented

---

## Overview

We need to set up automated alerts from our backend system to notify admins about critical issues with:
- Referral payouts (failed transactions, processing issues)
- Treasury balance (low USDC/SOL alerts)
- System health (cron jobs not running)

All alerts will be sent via Discord webhooks to dedicated channels.

---

## Step 1: Create Alert Channels

Create **3 new text channels** in the TFC Discord server:

### Channel 1: Critical Alerts
- **Name:** `#admin-alerts-critical`
- **Category:** Admin (or create new "System Alerts" category)
- **Permissions:**
  - Visible only to `@admin` role
  - Only admins can read/write
  - Disable `@everyone` permissions
- **Purpose:** Immediate critical alerts that need instant attention
- **Example alerts:**
  - 🔴 Failed payouts
  - 🔴 Treasury SOL critically low
  - 🔴 Payout processor down

### Channel 2: Daily Warnings
- **Name:** `#admin-alerts-daily`
- **Category:** Admin (or "System Alerts")
- **Permissions:** Same as critical (admins only)
- **Purpose:** Daily digest of warnings that need attention within 24h
- **Example alerts:**
  - 🟡 Many pending payouts (>10)
  - 🟡 Treasury USDC low (<$50)

### Channel 3: Weekly Notices
- **Name:** `#admin-alerts-weekly`
- **Category:** Admin (or "System Alerts")
- **Permissions:** Same as critical (admins only)
- **Purpose:** Weekly notices about things to plan for
- **Example alerts:**
  - ⚠️ Treasury USDC below recommended (<$100)
  - ⚠️ Maintenance reminders

---

## Step 2: Create Webhooks for Each Channel

For **each of the 3 channels** created above, follow these steps:

### 2.1 Access Channel Settings
1. Right-click on the channel (e.g., `#admin-alerts-critical`)
2. Select **"Edit Channel"**
3. Go to **"Integrations"** tab
4. Click **"Webhooks"**

### 2.2 Create New Webhook
1. Click **"New Webhook"** button
2. **Name the webhook** (important for clarity):
   - For `#admin-alerts-critical` → Name: `TFC Critical Alerts`
   - For `#admin-alerts-daily` → Name: `TFC Daily Warnings`
   - For `#admin-alerts-weekly` → Name: `TFC Weekly Notices`
3. **Optional:** Upload a custom avatar (can use TFC logo)
4. Click **"Copy Webhook URL"** button
5. **Save the URL securely** - you'll need to give this to Paul/Lian

### 2.3 Webhook URLs to Collect

You should end up with **3 webhook URLs** that look like this:

```
https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz...
```

**Important:**
- Each URL is unique to its channel
- Keep these URLs **private** - anyone with the URL can send messages to that channel
- Send these URLs to Paul/Lian via secure method (password-protected file, encrypted message, etc.)

---

## Step 3: Get Admin Role ID (for @mentions)

We want critical alerts to mention the `@admin` role so admins get notified.

### 3.1 Enable Developer Mode
1. In Discord, click your profile picture (bottom left)
2. Go to **User Settings** → **Advanced**
3. Enable **"Developer Mode"** toggle
4. Close settings

### 3.2 Copy Admin Role ID
1. Go to **Server Settings** → **Roles**
2. Find the `@admin` role in the list
3. **Right-click** on the `@admin` role
4. Select **"Copy ID"**
5. Save this ID - it will be a long number like: `123456789012345678`

**Send this ID to Paul/Lian** along with the webhook URLs.

---

## Step 4: Test Webhooks (Optional but Recommended)

You can test that webhooks are working before giving them to the dev team:

### Using curl (Command Line):
```bash
curl -X POST "YOUR_WEBHOOK_URL_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "embeds": [{
      "title": "🧪 Test Alert",
      "description": "This is a test message from Adam to verify webhook is working!",
      "color": 65280,
      "timestamp": "2024-02-05T12:00:00.000Z"
    }]
  }'
```

### Using Online Tool:
1. Go to https://discohook.org/
2. Paste your webhook URL
3. Create a test message
4. Click "Send"
5. Check if message appears in Discord channel

**If the test message appears in Discord, the webhook is working!**

---

## Step 5: Deliver Credentials to Dev Team

Send the following information to **Paul** and **Lian** (use secure method):

### Information Package:
```
=== TFC DISCORD WEBHOOK CREDENTIALS ===

1. CRITICAL ALERTS CHANNEL
   Channel: #admin-alerts-critical
   Webhook URL: https://discord.com/api/webhooks/...

2. DAILY WARNINGS CHANNEL
   Channel: #admin-alerts-daily
   Webhook URL: https://discord.com/api/webhooks/...

3. WEEKLY NOTICES CHANNEL
   Channel: #admin-alerts-weekly
   Webhook URL: https://discord.com/api/webhooks/...

4. ADMIN ROLE ID
   Role ID: 123456789012345678

=== SETUP COMPLETE ===
Date: [Today's date]
Setup by: Adam
```

**Recommended delivery methods:**
- Encrypted email
- Password-protected document
- Secure messaging app (Signal, encrypted DM)
- **NOT via public Discord channels or unencrypted email**

---

## Step 6: Configure Channel Settings (Recommended)

### Pin Important Information
In each alert channel, consider pinning a message with:
- What this channel is for
- Severity level (Critical/Warning/Notice)
- Who to contact if alerts stop coming
- Link to this documentation

**Example pinned message for #admin-alerts-critical:**
```
🔴 CRITICAL ALERTS CHANNEL

This channel receives automated alerts for critical issues:
- Failed payouts requiring immediate attention
- Treasury balance critically low
- System components down

Response time: IMMEDIATE (within 15 minutes)

If you stop seeing alerts for >1 hour, contact Paul/Lian.

Documentation: docs/Discord-Automation-Setup/Admin-Alerts-Setup.md
```

### Enable Notifications
Make sure admins get notified:
1. Right-click channel → **Notification Settings**
2. Set to **"All Messages"** (for critical channel at minimum)
3. Ensure **role mentions** are enabled

### Mobile Notifications (Optional)
Admins can enable mobile push notifications for critical alerts:
1. On mobile Discord app, go to channel
2. Tap channel name → Notifications
3. Enable push notifications
4. Set to "All Messages" for critical channel

---

## Maintenance & Troubleshooting

### If Webhooks Stop Working:
1. **Check if webhook was deleted** (Integrations → Webhooks in channel settings)
2. **Regenerate webhook** if URL was compromised
3. **Send new URL to dev team** immediately

### If Too Many Alerts:
- Contact dev team to adjust alert thresholds
- Don't delete webhooks - let devs tune the system

### If Webhook URL Leaked:
1. **Delete the compromised webhook immediately**
2. **Create a new webhook** following Step 2
3. **Send new URL to dev team**
4. Monitor channel for spam

---

## Expected Alert Frequency

Once configured, expect:

**Critical Channel (#admin-alerts-critical):**
- Normal: 0 alerts (only when issues occur)
- If issues: 1-5 alerts per day
- **If >10 alerts/day:** Major system issues, escalate

**Daily Channel (#admin-alerts-daily):**
- Normal: 1 message per day (daily digest)
- **If 0 messages for 2+ days:** Alert system may be down

**Weekly Channel (#admin-alerts-weekly):**
- Normal: 1 message per week
- **If 0 messages for 2+ weeks:** Alert system may be down

---

## Example Alert Messages

Here's what alerts will look like:

### Critical Alert Example:
```
🔴 CRITICAL: 3 Failed Referral Payout(s)
@admin

3 payout(s) failed and need immediate attention!

Processed: 10
Succeeded: 7
Failed: 3

[Timestamp: 2024-02-05 14:30:00 UTC]
```

### Daily Warning Example:
```
🟡 WARNING: Treasury USDC Low

Treasury USDC is below minimum threshold.

Current Balance: $45.50
Minimum Required: $50.00
Action: Fund treasury within 24 hours

[Timestamp: 2024-02-05 09:00:00 UTC]
```

### Weekly Notice Example:
```
⚠️ NOTICE: Treasury USDC Below Recommended

Treasury USDC below recommended level for operational buffer.

Current Balance: $85.00
Recommended: >$100.00
Action: Plan to fund treasury this week

[Timestamp: 2024-02-05 12:00:00 UTC]
```

---

## Security Best Practices

1. **Never share webhook URLs publicly** (GitHub, Discord public channels, etc.)
2. **Regenerate webhooks** if you suspect they've been compromised
3. **Audit webhook access** periodically (check who has the URLs)
4. **Monitor channels** for unexpected messages (could indicate leaked webhook)
5. **Document changes** - if you regenerate webhooks, notify dev team immediately

---

## Checklist for Adam

Before marking as complete, verify:

- [ ] Created 3 alert channels in Discord
- [ ] Set permissions (admins only)
- [ ] Created webhook for #admin-alerts-critical
- [ ] Created webhook for #admin-alerts-daily
- [ ] Created webhook for #admin-alerts-weekly
- [ ] Copied all 3 webhook URLs
- [ ] Enabled Developer Mode in Discord
- [ ] Copied Admin Role ID
- [ ] Tested at least one webhook (optional)
- [ ] Sent credentials to Paul/Lian securely
- [ ] Pinned info messages in each channel (optional)
- [ ] Configured mobile notifications for critical channel (optional)

---

## Contact Information

**If you have questions or issues:**
- Contact: Paul / Lian
- Documentation: `docs/Discord-Automation-Setup/Admin-Alerts-Setup.md`
- Technical details: `ADMIN_REFERRAL_PAYOUTS_TASKS.md` (Task 4)

---

## Completion

**Setup completed by:** ___________________
**Date:** ___________________
**Credentials delivered to:** Paul / Lian
**Delivery method:** ___________________

**Notes:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
