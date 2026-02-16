#!/bin/bash

ENV_FILE=".env"

echo "=== Discord Message Scraper Setup ==="
echo ""

# Read existing values if .env exists
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
  echo "Existing .env found. Press Enter to keep current values."
  echo ""
fi

read -p "Discord Token [$( [ -n "$DISCORD_TOKEN" ] && echo '****' || echo 'none' )]: " input
[ -n "$input" ] && DISCORD_TOKEN="$input"

read -p "Your Discord User ID [${DISCORD_USER_ID:-none}]: " input
[ -n "$input" ] && DISCORD_USER_ID="$input"

read -p "Discord Server ID [${DISCORD_SERVER_ID:-none}]: " input
[ -n "$input" ] && DISCORD_SERVER_ID="$input"

read -p "Channel ID [${CHANNEL_ID:-none}]: " input
[ -n "$input" ] && CHANNEL_ID="$input"

read -p "Target User ID to scrape [${TARGET_USER_ID:-none}]: " input
[ -n "$input" ] && TARGET_USER_ID="$input"

read -p "Start Date (YYYY-MM-DD) [${START_DATE:-none}]: " input
[ -n "$input" ] && START_DATE="$input"

read -p "End Date (YYYY-MM-DD) [${END_DATE:-none}]: " input
[ -n "$input" ] && END_DATE="$input"

if [ -z "$START_DATE" ] || [ -z "$END_DATE" ]; then
  # Default to yesterday UTC if missing
  YESTERDAY_UTC=$(date -u -v-1d +%Y-%m-%d)
  [ -z "$START_DATE" ] && START_DATE="$YESTERDAY_UTC"
  [ -z "$END_DATE" ] && END_DATE="$YESTERDAY_UTC"
fi

echo ""
echo ".env updated:"
echo "  DISCORD_USER_ID = $DISCORD_USER_ID"
echo "  DISCORD_SERVER_ID = $DISCORD_SERVER_ID"
echo "  CHANNEL_ID = $CHANNEL_ID"
echo "  TARGET_USER_ID = $TARGET_USER_ID"
echo "  START_DATE = ${START_DATE}"
echo "  END_DATE = ${END_DATE}"
echo ""

read -p "Run the scraper now? (y/n) [y]: " run
run=${run:-y}

if [ "$run" = "y" ] || [ "$run" = "Y" ]; then
  echo ""
  node bot.js
fi
