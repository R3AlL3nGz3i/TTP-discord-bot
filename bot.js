require('dotenv').config();
const { Client } = require('./src/index');
const fs = require('fs');

const client = new Client();

// Load config from .env
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_ID = process.env.DISCORD_SERVER_ID;
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;

// Collect all CHANNEL_* and TARGET_USER_* entries from .env
const channelIds = Object.entries(process.env)
  .filter(([key, val]) => key.startsWith('CHANNEL_') && val)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, val]) => ({ label: key, id: val }));

const targetUsers = Object.entries(process.env)
  .filter(([key, val]) => key.startsWith('TARGET_USER_') && val)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, val]) => ({ label: key, id: val }));

if (!TOKEN || channelIds.length === 0 || targetUsers.length === 0) {
  console.error('Missing required env vars. Need DISCORD_TOKEN, at least one CHANNEL_*, and one TARGET_USER_*.');
  process.exit(1);
}

// Scrape a single channel for a single target user
async function scrapeChannel(channel, targetUserId, startMs, endMs) {
  const scrapedData = [];
  let lastId;
  let totalScanned = 0;

  try {
    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      totalScanned += messages.size;
      process.stdout.write(`\r  [#${channel.name}] Scanned ${totalScanned} messages... Found ${scrapedData.length} matches.`);

      for (const [id, msg] of messages) {
        lastId = id;
        const createdMs = msg.createdAt.getTime();

        if (startMs && createdMs < startMs) {
          lastId = null;
          break;
        }

        if (endMs && createdMs > endMs) {
          continue;
        }

        if (msg.author.id === targetUserId) {
          let referencedMessage = null;
          if (msg.reference && msg.reference.messageId) {
            try {
              const original = await msg.fetchReference();
              referencedMessage = {
                messageId: original.id,
                content: original.content,
                username: original.author?.username ?? null,
                displayName: original.author?.globalName || original.author?.username || null,
                date: original.createdAt.toLocaleDateString('en-GB'),
                time: original.createdAt.toLocaleTimeString('en-GB', { hour12: false }),
              };
            } catch (err) {
              console.warn(`\n  Could not fetch referenced message ${msg.reference.messageId}: ${err.message}`);
              referencedMessage = {
                messageId: msg.reference.messageId,
                error: err.message,
              };
            }
          }

          scrapedData.push({
            date: msg.createdAt.toLocaleDateString('en-GB'),
            time: msg.createdAt.toLocaleTimeString('en-GB', { hour12: false }),
            content: msg.content,
            username: msg.author.username,
            displayName: msg.author.globalName || msg.author.username,
            channelName: channel.name,
            channelId: channel.id,
            attachments: msg.attachments.map(a => a.url),
            replyTo: referencedMessage,
          });
        }
      }

      if (!lastId) break;

      // Rate limit delay
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (err) {
    console.error(`\n  Error during scraping #${channel.name}:`, err.message);
  }

  scrapedData.reverse();
  return { scrapedData, totalScanned };
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`Server ID: ${SERVER_ID}`);
  console.log(`Channels: ${channelIds.map(c => `${c.label}=${c.id}`).join(', ')}`);
  console.log(`Target Users: ${targetUsers.map(u => `${u.label}=${u.id}`).join(', ')}`);

  const yesterdayUtc = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const effectiveStart = START_DATE || yesterdayUtc;
  const effectiveEnd = END_DATE || yesterdayUtc;
  console.log(`Start Date (UTC): ${effectiveStart}`);
  console.log(`End Date (UTC): ${effectiveEnd}`);

  const startMs = Date.parse(`${effectiveStart}T00:00:00.000Z`);
  const endMs = Date.parse(`${effectiveEnd}T23:59:59.999Z`);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    console.error('Invalid START_DATE or END_DATE. Use format YYYY-MM-DD.');
    process.exit(1);
  }

  const allScrapedData = [];
  let grandTotalScanned = 0;

  // Run every user × every channel
  for (const chEntry of channelIds) {
    let channel;
    try {
      channel = client.channels.cache.get(chEntry.id) || await client.channels.fetch(chEntry.id);
    } catch (err) {
      console.error(`Failed to fetch channel ${chEntry.label} (${chEntry.id}): ${err.message}`);
      continue;
    }

    for (const userEntry of targetUsers) {
      console.log(`\n--- Scraping #${channel.name} for ${userEntry.label} (${userEntry.id}) ---`);
      const { scrapedData, totalScanned } = await scrapeChannel(channel, userEntry.id, startMs, endMs);
      console.log(`\n  Done: ${scrapedData.length} messages from ${totalScanned} scanned.`);
      grandTotalScanned += totalScanned;
      allScrapedData.push(...scrapedData);
    }
  }

  console.log(`\n\nAll done! Found ${allScrapedData.length} messages from ${grandTotalScanned} total scanned.`);

  const outputFile = 'scraped_messages.json';
  let existingData = [];

  if (fs.existsSync(outputFile)) {
    try {
      const raw = fs.readFileSync(outputFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existingData = parsed;
      }
    } catch (err) {
      console.error(`Failed to read existing ${outputFile}:`, err.message);
    }
  }

  const mergedData = existingData.concat(allScrapedData);
  fs.writeFileSync(outputFile, JSON.stringify(mergedData, null, 2));
  console.log(`Saved ${allScrapedData.length} new messages to ${outputFile}`);

  process.exit(0);
});

client.login(TOKEN);
