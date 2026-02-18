require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');

// Configuration from .env
const GOOGLE_CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || 'credentials.json';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Trading Signals';

async function authorize() {
  // Check for service account credentials
  if (!fs.existsSync(GOOGLE_CREDENTIALS_PATH)) {
    console.error(`\nCredentials file not found: ${GOOGLE_CREDENTIALS_PATH}`);
    console.log(`
To set up Google Sheets API:

1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "Google Sheets API"
4. Create credentials:
   - Go to "Credentials" > "Create Credentials" > "Service Account"
   - Download the JSON key file
   - Rename it to "credentials.json" and place in this folder
5. Share your Google Sheet with the service account email
   (found in credentials.json as "client_email")
6. Add the following to your .env file:
   GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
   GOOGLE_SHEET_NAME=Trading Signals
   
The Spreadsheet ID is in the URL:
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth;
}

function flattenTradeData(tradeSummary) {
  const rows = [];
  
  // Header row
  rows.push([
    'Ticker',
    'Date',
    'Time',
    'User',
    'Channel',
    'Action',
    'Action Details',
    'Position Type',
    'Expiry',
    'Lower Strike',
    'Upper Strike',
    'Spread Type',
    'Price',
    'Raw Content',
    'Reference Message'
  ]);

  for (const [ticker, trades] of Object.entries(tradeSummary)) {
    for (const trade of trades) {
      rows.push([
        ticker,
        trade.date,
        trade.time,
        trade.username || '',
        trade.channel || '',
        trade.action,
        trade.details ? trade.details.join(', ') : '',
        trade.position ? trade.position.join(', ') : '',
        trade.spread ? trade.spread.expiry : (trade.option ? trade.option.expiry : ''),
        trade.spread ? trade.spread.lowerStrike : (trade.option ? trade.option.strike : ''),
        trade.spread ? trade.spread.upperStrike : '',
        trade.spread ? trade.spread.type : (trade.option ? trade.option.type : ''),
        trade.spread ? trade.spread.price : (trade.option ? trade.option.price : (trade.price ? JSON.stringify(trade.price) : '')),
        trade.raw.substring(0, 500), // Limit raw content length
        trade.referenceMessage?.content ? trade.referenceMessage.content.substring(0, 500) : ''
      ]);
    }
  }

  return rows;
}

async function uploadToGoogleSheets() {
  // Check if analysis exists
  if (!fs.existsSync('trading_analysis.json')) {
    console.error('trading_analysis.json not found. Run "node analyze.js" first.');
    process.exit(1);
  }

  if (!SPREADSHEET_ID) {
    console.error('GOOGLE_SPREADSHEET_ID not set in .env file');
    process.exit(1);
  }

  const analysisData = JSON.parse(fs.readFileSync('trading_analysis.json', 'utf8'));
  const rows = flattenTradeData(analysisData.summary);

  console.log(`Preparing ${rows.length - 1} rows for upload...`);

  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Clear existing data
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    });

    // Write new data
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`\nSuccess! Uploaded ${response.data.updatedRows} rows to Google Sheets.`);
    console.log(`View at: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 13,
              },
            },
          },
        ],
      },
    });

    console.log('Formatting applied.');

  } catch (error) {
    console.error('Error uploading to Google Sheets:', error.message);
    if (error.code === 403) {
      console.log('\nMake sure you have shared the spreadsheet with your service account email.');
    }
    if (error.code === 404) {
      console.log('\nSpreadsheet not found. Check your GOOGLE_SPREADSHEET_ID in .env');
    }
  }
}

// Run if called directly
if (require.main === module) {
  uploadToGoogleSheets();
}

module.exports = { uploadToGoogleSheets, flattenTradeData };
