require('dotenv').config();
const { Client } = require('./src/index');
const fs = require('fs');

const client = new Client();

// Load config from .env
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_ID = process.env.DISCORD_SERVER_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TARGET_USER_ID = process.env.TARGET_USER_ID;
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;

if (!TOKEN || !CHANNEL_ID || !TARGET_USER_ID) {
  console.error('Missing required env vars. Check your .env file.');
  process.exit(1);
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`Server ID: ${SERVER_ID}`);
  console.log(`Channel ID: ${CHANNEL_ID}`);
  console.log(`Target User ID: ${TARGET_USER_ID}`);
  const yesterdayUtc = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const effectiveStart = START_DATE || yesterdayUtc;
  const effectiveEnd = END_DATE || yesterdayUtc;
  console.log(`Start Date (UTC): ${effectiveStart}`);
  console.log(`End Date (UTC): ${effectiveEnd}`);

  // Fetch the channel
  let channel;
  try {
    channel = client.channels.cache.get(CHANNEL_ID) || await client.channels.fetch(CHANNEL_ID);
  } catch (err) {
    console.error(`Failed to fetch channel ${CHANNEL_ID}:`, err.message);
    process.exit(1);
  }

  console.log(`\nChannel found: #${channel.name} (${channel.id})`);
  console.log(`Scraping messages from user ID ${TARGET_USER_ID}...\n`);

  const scrapedData = [];
  let lastId;
  let totalScanned = 0;
  const startMs = Date.parse(`${effectiveStart}T00:00:00.000Z`);
  const endMs = Date.parse(`${effectiveEnd}T23:59:59.999Z`);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    console.error('Invalid START_DATE or END_DATE. Use format YYYY-MM-DD.');
    process.exit(1);
  }

  try {
    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      totalScanned += messages.size;
      process.stdout.write(`\rScanned ${totalScanned} messages... Found ${scrapedData.length} matches.`);

      for (const [id, msg] of messages) {
        lastId = id;
        const createdMs = msg.createdAt.getTime();

        if (startMs && createdMs < startMs) {
          // We are past the start date (older messages). Stop scanning.
          lastId = null;
          break;
        }

        if (endMs && createdMs > endMs) {
          continue;
        }

        if (msg.author.id === TARGET_USER_ID) {
          scrapedData.push({
            date: msg.createdAt.toLocaleDateString('en-GB'),
            time: msg.createdAt.toLocaleTimeString('en-GB', { hour12: false }),
            content: msg.content,
            username: msg.author.username,
            displayName: msg.author.globalName || msg.author.username,
            channelName: channel.name,
            channelId: channel.id,
            attachments: msg.attachments.map(a => a.url),
          });
        }
      }

      if (!lastId) {
        break;
      }

      // Rate limit delay
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (err) {
    console.error('\nError during scraping:', err.message);
  }

  // Sort oldest first
  scrapedData.reverse();

  console.log(`\n\nDone! Found ${scrapedData.length} messages from ${totalScanned} total.`);

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

  const mergedData = existingData.concat(scrapedData);
  fs.writeFileSync(outputFile, JSON.stringify(mergedData, null, 2));
  console.log(`Saved ${scrapedData.length} new messages to ${outputFile}`);

  process.exit(0);
});

client.login(TOKEN);
