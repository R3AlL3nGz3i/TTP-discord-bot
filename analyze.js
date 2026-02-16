const fs = require('fs');

// Parse code.md to build nickname -> ticker mapping
function parseCodeMapping(codeContent) {
  const mapping = {};
  const lines = codeContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    
    // Match patterns like "果子爹    AAPL" or "巨软/硬     MSFT"
    const match = line.match(/^(.+?)\s{2,}([A-Z]+)/);
    if (match) {
      const nicknames = match[1].trim();
      const ticker = match[2].trim();
      
      // Handle multiple nicknames separated by / or （）
      const parts = nicknames.split(/[\/（）]/);
      for (const part of parts) {
        const clean = part.trim();
        if (clean) {
          mapping[clean] = ticker;
        }
      }
    }
  }
  
  // Add common abbreviations
  mapping['果子'] = 'AAPL';
  mapping['硬'] = 'MSFT';
  mapping['软'] = 'MSFT';
  mapping['奶'] = 'NVDA';
  mapping['菊花'] = 'NVDA'; // context suggests this
  mapping['舅舅'] = 'META';
  mapping['小姨子'] = 'XYZ';
  mapping['vv'] = 'VSCO';
  mapping['发米'] = 'FRMI';
  mapping['死皮'] = 'SPY';
  mapping['老纳'] = 'QQQ';
  mapping['大饼'] = 'BTC/IBIT';
  mapping['币'] = 'BTC/IBIT';
  mapping['老道'] = 'DJI/DIA';
  mapping['半岛'] = 'RSP';
  mapping['嫩罗'] = 'IWM';
  mapping['渣男'] = 'SPY'; // possibly
  
  return mapping;
}

// Analyze a single message for trading signals
function analyzeMessage(msg, tickerMap) {
  const content = msg.content;
  
  if (!content || content.trim() === '') return null;
  
  // Detect action type
  let action = 'UNKNOWN';
  let actionKeywords = [];
  
  // Sell/Exit signals
  if (/走|出了|出一半|止盈|止损|纪律止损/.test(content)) {
    action = 'SELL';
    if (/走一半|出一半/.test(content)) actionKeywords.push('PARTIAL_EXIT');
    if (/止盈/.test(content)) actionKeywords.push('TAKE_PROFIT');
    if (/止损|纪律止损/.test(content)) actionKeywords.push('STOP_LOSS');
    if (/走完/.test(content)) actionKeywords.push('FULL_EXIT');
  }
  
  // Buy/Entry signals
  if (/加仓|加了|接回|挂|抄底|闭眼/.test(content)) {
    action = 'BUY';
    if (/加仓|加了/.test(content)) actionKeywords.push('ADD_POSITION');
    if (/接回/.test(content)) actionKeywords.push('RE-ENTRY');
    if (/抄底/.test(content)) actionKeywords.push('BOTTOM_FISH');
  }
  
  // Hold signals
  if (/过夜|拿着|留|还在/.test(content)) {
    if (action === 'UNKNOWN') action = 'HOLD';
    actionKeywords.push('OVERNIGHT');
  }
  
  // Position type detection
  let positionType = [];
  
  // Call Spread (cs)
  if (/\d+\/\d+\s*cs/i.test(content)) {
    positionType.push('CALL_SPREAD');
  }
  
  // Put Spread (ps)
  if (/\d+\/\d+\s*ps/i.test(content)) {
    positionType.push('PUT_SPREAD');
  }
  
  // Single call/put (cp = call position, c = call, p = put)
  if (/\d+c\s|cp\s|cp$|\sc\s/.test(content)) {
    positionType.push('CALL');
  }
  if (/\d+p\s|\sp\s/.test(content)) {
    positionType.push('PUT');
  }
  
  // Options spread pattern: "M/D strike1/strike2 cs/ps price"
  const spreadMatch = content.match(/(\d+\/\d+)\s+(\d+)\/(\d+)\s+(cs|ps)\s+([\d.]+)/i);
  
  // Single option pattern: "M/D strikeC/P price"
  const optionMatch = content.match(/(\d+\/\d+)\s+(\d+)(c|p)\s+(cp\s+)?([\d.]+)?/i);
  
  // Ticker detection
  let detectedTickers = [];
  
  // 1. First check for direct ticker mentions (case-insensitive)
  const tickerPatterns = /\b([A-Za-z]{2,5})\b/g;
  let tickerMatch;
  const knownTickers = new Set([
    'AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'AMD', 'NFLX', 'AVGO',
    'ABT', 'ALGN', 'AMPX', 'AMC', 'ASAN', 'ANF', 'RL', 'AEO', 'BMY', 'BOWL', 'BYND',
    'CAT', 'CHWY', 'CMG', 'CVGW', 'DASH', 'DDOG', 'DE', 'DIS', 'DOLE', 'DPZ', 'DXCM',
    'DFLI', 'FSLR', 'GNRC', 'GILD', 'HNST', 'HTZ', 'IONQ', 'JPM', 'KMB', 'LMND', 'LVS',
    'LW', 'MDB', 'MELI', 'MLKN', 'MTCH', 'OKLO', 'OSCR', 'OUST', 'PANW', 'PTON', 'PDYN',
    'RTX', 'SBUX', 'SG', 'SFM', 'SHW', 'SJM', 'TME', 'TEVA', 'TOL', 'UUUU', 'UBER',
    'VFC', 'VITL', 'VSCO', 'WHR', 'WING', 'WYNN', 'XYZ', 'ZBRA', 'CRSP', 'CRCL', 'NCLH',
    'NAK', 'AEVA', 'CRM', 'MRK', 'IREN', 'SLDP', 'EOSE', 'CFLT', 'BULL', 'FCX', 'SMR',
    'UNH', 'OPEN', 'XOM', 'ANET', 'COHR', 'NET', 'FIGMA', 'ZETA', 'FLY', 'VOYG', 'AVAV',
    'LMT', 'CCCX', 'CCJ', 'APLD', 'FLNC', 'TWST', 'POET', 'AMTM', 'QS', 'USAR', 'KTOS', 'TEM',
    'CRWV', 'CLSK', 'AS', 'SPY', 'QQQ', 'IWM', 'RSP', 'DIA', 'IBIT', 'FRMI',
    // Additional common tickers found in messages
    'VKTX', 'AEP', 'COHU', 'ONDS', 'RDW', 'PCT', 'DNA', 'WTTR', 'ENPH', 'RR', 'AEHR',
    'CRML', 'IBIT', 'PATH', 'NBIS', 'VNET', 'OKTA', 'LUMN', 'NXE', 'LAES', 'SSYS',
    'PENN', 'SKYX', 'LUNR', 'RXRX', 'PLUG', 'GFS', 'PFE', 'NKTX', 'PACB', 'DYN',
    'APLS', 'TSHA', 'CNTX', 'SHOP', 'PLTR', 'RKLB', 'RGTI', 'KVUE', 'GEVO', 'NIO',
    'RIVN', 'LCID', 'SOFI', 'HOOD', 'COIN', 'MARA', 'RIOT', 'HUT', 'BITF', 'HIVE',
    'DPRO', 'EVLV'
  ]);
  
  while ((tickerMatch = tickerPatterns.exec(content)) !== null) {
    const potential = tickerMatch[1].toUpperCase();
    // Filter out common non-tickers and short words
    if (!['CS', 'PS', 'CP', 'QR', 'MD', 'DG', 'GA', 'SP', 'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT'].includes(potential)) {
      if (knownTickers.has(potential)) {
        detectedTickers.push(potential);
      }
    }
  }
  
  // 2. Check for nickname mentions and map to tickers
  for (const [nickname, ticker] of Object.entries(tickerMap)) {
    if (content.includes(nickname)) {
      if (!detectedTickers.includes(ticker)) {
        detectedTickers.push(`${ticker} (${nickname})`);
      }
    }
  }
  
  // Remove duplicates
  detectedTickers = [...new Set(detectedTickers)];
  
  // Extract price levels
  const priceMatch = content.match(/([\d.]+)[-~]([\d.]+)/);
  const singlePrice = content.match(/\b(\d+\.\d+)\b/g);
  
  // Build signal object
  const signal = {
    date: msg.date,
    time: msg.time,
    username: msg.username || msg.displayName || 'Unknown',
    channel: msg.channelName || 'Unknown',
    channelId: msg.channelId || 'Unknown',
    rawContent: content,
    action: action,
    actionDetails: actionKeywords,
    tickers: detectedTickers,
    positionType: positionType.length > 0 ? positionType : ['UNKNOWN'],
    spreadDetails: null,
    optionDetails: null,
    priceInfo: null
  };
  
  if (spreadMatch) {
    signal.spreadDetails = {
      expiry: spreadMatch[1],
      lowerStrike: spreadMatch[2],
      upperStrike: spreadMatch[3],
      type: spreadMatch[4].toUpperCase(),
      price: spreadMatch[5]
    };
  }
  
  if (optionMatch && !spreadMatch) {
    signal.optionDetails = {
      expiry: optionMatch[1],
      strike: optionMatch[2],
      type: optionMatch[3].toUpperCase() === 'C' ? 'CALL' : 'PUT',
      price: optionMatch[5] || null
    };
  }
  
  if (priceMatch) {
    signal.priceInfo = {
      range: `${priceMatch[1]} - ${priceMatch[2]}`
    };
  } else if (singlePrice && singlePrice.length > 0) {
    signal.priceInfo = {
      levels: singlePrice
    };
  }
  
  return signal;
}

// Main analysis
function main() {
  // Read code mapping
  const codeContent = fs.readFileSync('code.md', 'utf8');
  const tickerMap = parseCodeMapping(codeContent);
  
  // Read scraped messages
  const messages = JSON.parse(fs.readFileSync('scraped_messages.json', 'utf8'));
  
  console.log(`Analyzing ${messages.length} messages...`);
  
  const analysis = [];
  const tradeSummary = {};
  
  for (const msg of messages) {
    const signal = analyzeMessage(msg, tickerMap);
    
    // Only include if there's meaningful content
    if (signal && (signal.tickers.length > 0 || signal.spreadDetails || signal.optionDetails || signal.action !== 'UNKNOWN')) {
      analysis.push(signal);
      
      // Build trade summary by ticker
      if (signal.tickers.length > 0) {
        for (const ticker of signal.tickers) {
          const baseTicker = ticker.split(' ')[0];
          if (!tradeSummary[baseTicker]) {
            tradeSummary[baseTicker] = [];
          }
          tradeSummary[baseTicker].push({
            date: signal.date,
            time: signal.time,
            username: signal.username,
            channel: signal.channel,
            action: signal.action,
            details: signal.actionDetails,
            position: signal.positionType,
            spread: signal.spreadDetails,
            option: signal.optionDetails,
            price: signal.priceInfo,
            raw: signal.rawContent
          });
        }
      } else {
        // No ticker identified - put in UNKNOWN section
        if (!tradeSummary['UNKNOWN']) {
          tradeSummary['UNKNOWN'] = [];
        }
        tradeSummary['UNKNOWN'].push({
          date: signal.date,
          time: signal.time,
          username: signal.username,
          channel: signal.channel,
          action: signal.action,
          details: signal.actionDetails,
          position: signal.positionType,
          spread: signal.spreadDetails,
          option: signal.optionDetails,
          price: signal.priceInfo,
          raw: signal.rawContent
        });
      }
    }
  }
  
  // Generate readable report
  let report = `# Trading Analysis Report\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Total Messages Analyzed: ${messages.length}\n`;
  report += `Signals Extracted: ${analysis.length}\n\n`;
  
  report += `---\n\n`;
  report += `## Summary by Ticker\n\n`;
  
  // Sort tickers by activity count
  const sortedTickers = Object.entries(tradeSummary)
    .sort((a, b) => b[1].length - a[1].length);
  
  for (const [ticker, trades] of sortedTickers) {
    report += `### ${ticker} (${trades.length} signals)\n\n`;
    report += `| Date | Time | User | Channel | Action | Type | Details |\n`;
    report += `|------|------|------|---------|--------|------|---------|`;
    report += `\n`;
    
    for (const trade of trades) {
      const typeStr = trade.position.join(', ');
      let details = '';
      
      if (trade.spread) {
        details = `${trade.spread.expiry} ${trade.spread.lowerStrike}/${trade.spread.upperStrike} ${trade.spread.type} @${trade.spread.price}`;
      } else if (trade.option) {
        details = `${trade.option.expiry} ${trade.option.strike}${trade.option.type === 'CALL' ? 'C' : 'P'}${trade.option.price ? ' @' + trade.option.price : ''}`;
      } else if (trade.price) {
        details = trade.price.range || (trade.price.levels ? trade.price.levels.join(', ') : '');
      }
      
      if (trade.details.length > 0) {
        details += details ? ` [${trade.details.join(', ')}]` : `[${trade.details.join(', ')}]`;
      }
      
      // Truncate raw content for table
      const shortRaw = trade.raw.length > 50 ? trade.raw.substring(0, 47) + '...' : trade.raw;
      
      report += `| ${trade.date} | ${trade.time} | ${trade.username} | ${trade.channel} | ${trade.action} | ${typeStr} | ${details || shortRaw} |\n`;
    }
    report += `\n`;
  }
  
  report += `---\n\n`;
  report += `## Chronological Trade Log\n\n`;
  
  for (const signal of analysis) {
    report += `### ${signal.date} ${signal.time}\n`;
    report += `- **User**: ${signal.username}\n`;
    report += `- **Channel**: ${signal.channel}\n`;
    report += `- **Tickers**: ${signal.tickers.join(', ') || 'N/A'}\n`;
    report += `- **Action**: ${signal.action} ${signal.actionDetails.length > 0 ? `(${signal.actionDetails.join(', ')})` : ''}\n`;
    report += `- **Position Type**: ${signal.positionType.join(', ')}\n`;
    
    if (signal.spreadDetails) {
      report += `- **Spread**: ${signal.spreadDetails.expiry} exp, ${signal.spreadDetails.lowerStrike}/${signal.spreadDetails.upperStrike} ${signal.spreadDetails.type} @ ${signal.spreadDetails.price}\n`;
    }
    if (signal.optionDetails) {
      report += `- **Option**: ${signal.optionDetails.expiry} exp, ${signal.optionDetails.strike} ${signal.optionDetails.type}${signal.optionDetails.price ? ' @ ' + signal.optionDetails.price : ''}\n`;
    }
    if (signal.priceInfo) {
      report += `- **Price Info**: ${JSON.stringify(signal.priceInfo)}\n`;
    }
    report += `- **Raw**: ${signal.rawContent}\n`;
    report += `\n`;
  }
  
  // Write outputs
  fs.writeFileSync('trading_analysis.md', report);
  fs.writeFileSync('trading_analysis.json', JSON.stringify({
    summary: tradeSummary,
    signals: analysis
  }, null, 2));
  
  console.log(`\nAnalysis complete!`);
  console.log(`- trading_analysis.md (readable report)`);
  console.log(`- trading_analysis.json (structured data)`);
  console.log(`\nTickers found: ${Object.keys(tradeSummary).length}`);
  console.log(`Top 10 most mentioned:`);
  sortedTickers.slice(0, 10).forEach(([ticker, trades]) => {
    console.log(`  ${ticker}: ${trades.length} signals`);
  });
}

main();
