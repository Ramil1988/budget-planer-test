# Notification Hook Setup

This hook sends notifications to Slack, Discord, or SMS when Claude Code sends notifications.

## Quick Setup

### Option 1: Slack Notifications

1. **Create a Slack Webhook:**
   - Go to https://api.slack.com/messaging/webhooks
   - Create a new webhook for your workspace
   - Copy the webhook URL

2. **Configure the hook:**
   ```bash
   # Add to your ~/.zshrc or ~/.bashrc
   export NOTIFICATION_TYPE="slack"
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
   ```

3. **Reload your shell:**
   ```bash
   source ~/.zshrc  # or source ~/.bashrc
   ```

### Option 2: Discord Notifications

1. **Create a Discord Webhook:**
   - Open your Discord server settings
   - Go to Integrations → Webhooks
   - Create a new webhook
   - Copy the webhook URL

2. **Configure the hook:**
   ```bash
   # Add to your ~/.zshrc or ~/.bashrc
   export NOTIFICATION_TYPE="discord"
   export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
   ```

3. **Reload your shell:**
   ```bash
   source ~/.zshrc
   ```

### Option 3: SMS Notifications (via Twilio)

1. **Create a Twilio account:**
   - Sign up at https://www.twilio.com/try-twilio
   - Get your Account SID and Auth Token from the console
   - Get a Twilio phone number

2. **Configure the hook:**
   ```bash
   # Add to your ~/.zshrc or ~/.bashrc
   export NOTIFICATION_TYPE="sms"
   export TWILIO_ACCOUNT_SID="your_account_sid"
   export TWILIO_AUTH_TOKEN="your_auth_token"
   export TWILIO_FROM_NUMBER="+1234567890"  # Your Twilio number
   export TWILIO_TO_NUMBER="+1234567890"    # Your phone number
   ```

3. **Reload your shell:**
   ```bash
   source ~/.zshrc
   ```

### Option 4: Multiple Notification Types

You can send to multiple services at once:

```bash
# Add to your ~/.zshrc or ~/.bashrc
export NOTIFICATION_TYPE="slack,discord"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
```

## Configure Claude Code to Use the Hook

Add the following to your `.claude/settings.local.json`:

```json
{
  "hooks": {
    "notification": ".claude/hooks/notification.sh"
  }
}
```

## Testing the Hook

Test the notification hook manually:

```bash
.claude/hooks/notification.sh "Test notification from Claude Code!"
```

You should receive a notification on your configured service(s).

## Troubleshooting

- **No notifications received?**
  - Check that environment variables are set: `echo $NOTIFICATION_TYPE`
  - Verify webhook URLs are correct
  - Check that the script is executable: `ls -l .claude/hooks/notification.sh`

- **Curl command not found?**
  - Install curl: `brew install curl` (macOS)

- **Twilio errors?**
  - Verify your Account SID and Auth Token
  - Make sure phone numbers include country code (e.g., +1 for US)
  - Check that your Twilio account has sufficient credits
