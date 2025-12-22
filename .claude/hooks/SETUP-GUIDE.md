# Quick Setup Guide for Notification Hook

## Choose Your Notification Method

### 🔵 Slack (Recommended - Easiest)

**Step 1:** Create a Slack webhook
1. Go to https://api.slack.com/messaging/webhooks
2. Click "Create New App" → "From scratch"
3. Name it "Claude Code Notifications"
4. Select your workspace
5. Click "Incoming Webhooks" → Enable
6. Click "Add New Webhook to Workspace"
7. Choose a channel (e.g., #claude-notifications)
8. Copy the webhook URL

**Step 2:** Add to your shell config
```bash
# Open your shell config file
nano ~/.zshrc   # or ~/.bashrc if using bash

# Add these lines at the end:
export NOTIFICATION_TYPE="slack"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Save and exit (Ctrl+X, then Y, then Enter)

# Reload your shell
source ~/.zshrc
```

**Step 3:** Test it
```bash
cd ~/Desktop/Budget\ planner
.claude/hooks/notification.sh "Test notification!"
```

You should see "✅ Slack notification sent" and receive a message in Slack!

---

### 💜 Discord

**Step 1:** Create a Discord webhook
1. Open your Discord server
2. Go to Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Name it "Claude Code"
5. Choose a channel
6. Copy the webhook URL

**Step 2:** Add to your shell config
```bash
# Open your shell config
nano ~/.zshrc

# Add these lines:
export NOTIFICATION_TYPE="discord"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"

# Save and reload
source ~/.zshrc
```

**Step 3:** Test it
```bash
.claude/hooks/notification.sh "Test from Claude!"
```

---

### 📱 SMS (via Twilio)

**Step 1:** Sign up for Twilio
1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial gives you credit for testing)
3. Get a phone number
4. Find your Account SID and Auth Token in the console

**Step 2:** Add to your shell config
```bash
# Open your shell config
nano ~/.zshrc

# Add these lines (replace with your actual values):
export NOTIFICATION_TYPE="sms"
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your_auth_token_here"
export TWILIO_FROM_NUMBER="+12125551234"  # Your Twilio number
export TWILIO_TO_NUMBER="+19175551234"    # Your phone number

# Save and reload
source ~/.zshrc
```

**Step 3:** Test it
```bash
.claude/hooks/notification.sh "Test SMS from Claude!"
```

---

### 🌟 Multiple Services at Once

Want notifications on both Slack AND Discord?

```bash
# In your ~/.zshrc
export NOTIFICATION_TYPE="slack,discord"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

---

## Troubleshooting

**No notifications?**
- Check environment variables: `echo $NOTIFICATION_TYPE`
- Make sure you reloaded your shell: `source ~/.zshrc`
- Test the script manually first

**Script permission denied?**
```bash
chmod +x .claude/hooks/notification.sh
```

**Webhook URL not working?**
- Copy-paste carefully (no extra spaces)
- Make sure the webhook is still active in Slack/Discord

---

## What Gets Notified?

The hook will send you notifications when Claude Code:
- Completes a long-running task
- Encounters an error that needs attention
- Finishes a build or test run
- And other important events!

You can customize when notifications are sent by editing `.claude/settings.local.json`.
