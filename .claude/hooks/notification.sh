#!/bin/bash

# Notification Hook for Claude Code
# Sends notifications to Slack, Discord, or SMS when Claude sends notifications
#
# Configuration: Set environment variables in your shell profile
# - NOTIFICATION_TYPE: "slack", "discord", or "sms" (or multiple: "slack,discord")
# - SLACK_WEBHOOK_URL: Your Slack webhook URL
# - DISCORD_WEBHOOK_URL: Your Discord webhook URL
# - TWILIO_ACCOUNT_SID: Your Twilio Account SID
# - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
# - TWILIO_FROM_NUMBER: Your Twilio phone number
# - TWILIO_TO_NUMBER: Your phone number to receive SMS

# Get the notification message from Claude
MESSAGE="$1"

# Exit if no message provided
if [ -z "$MESSAGE" ]; then
    exit 0
fi

# Default notification type
NOTIFICATION_TYPE="${NOTIFICATION_TYPE:-slack}"

# Function to send Slack notification
send_slack() {
    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        echo "⚠️  SLACK_WEBHOOK_URL not set. Skipping Slack notification."
        return
    fi

    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"🤖 Claude Code Notification\n\n$MESSAGE\"}" \
        --silent --output /dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Slack notification sent"
    else
        echo "❌ Failed to send Slack notification"
    fi
}

# Function to send Discord notification
send_discord() {
    if [ -z "$DISCORD_WEBHOOK_URL" ]; then
        echo "⚠️  DISCORD_WEBHOOK_URL not set. Skipping Discord notification."
        return
    fi

    curl -X POST "$DISCORD_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"content\":\"🤖 **Claude Code Notification**\n\n$MESSAGE\"}" \
        --silent --output /dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Discord notification sent"
    else
        echo "❌ Failed to send Discord notification"
    fi
}

# Function to send SMS via Twilio
send_sms() {
    if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ] || [ -z "$TWILIO_FROM_NUMBER" ] || [ -z "$TWILIO_TO_NUMBER" ]; then
        echo "⚠️  Twilio credentials not set. Skipping SMS notification."
        return
    fi

    # Truncate message to 160 characters for SMS
    SMS_MESSAGE=$(echo "$MESSAGE" | cut -c1-160)

    curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
        --data-urlencode "From=$TWILIO_FROM_NUMBER" \
        --data-urlencode "To=$TWILIO_TO_NUMBER" \
        --data-urlencode "Body=Claude Code: $SMS_MESSAGE" \
        -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
        --silent --output /dev/null

    if [ $? -eq 0 ]; then
        echo "✅ SMS notification sent"
    else
        echo "❌ Failed to send SMS notification"
    fi
}

# Send notifications based on configured types
IFS=',' read -ra TYPES <<< "$NOTIFICATION_TYPE"
for TYPE in "${TYPES[@]}"; do
    case "$TYPE" in
        slack)
            send_slack
            ;;
        discord)
            send_discord
            ;;
        sms)
            send_sms
            ;;
        *)
            echo "⚠️  Unknown notification type: $TYPE"
            ;;
    esac
done
