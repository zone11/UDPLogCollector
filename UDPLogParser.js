const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

class UDPLogParser {
  constructor(adifPath = null) {
    this.server = dgram.createSocket('udp4');
    this.adifPath = adifPath;
    this.MAGIC_NUMBER = 0xADBCCBDA;
    this.MESSAGE_TYPES = {
      0: 'Heartbeat',
      1: 'Status',
      2: 'Decode',
      3: 'Clear',
      4: 'Reply',
      5: 'QSOLogged',
      6: 'Close',
      7: 'Replay',
      8: 'HaltTx',
      9: 'FreeText',
      10: 'WSPRDecode',
      11: 'Location',
      12: 'LoggedADIF',
      13: 'HighlightCallsign',
      14: 'SwitchConfiguration',
      15: 'Configure'
    };
    
    // Optimization: Set for faster lookup
    this.requiredFields = new Set(['call', 'qso_date', 'time_on', 'time_off', 'band', 'freq', 'mode', 'rst_sent', 'rst_rcvd', 'tx_pwr', 'comment']);
    this.optionalFields = new Set(['sota_ref', 'pota_ref', 'wwff_ref']);
    this.allFields = new Set([...this.requiredFields, ...this.optionalFields]);
  }

  readQString(buffer, offset) {
    if (offset + 4 > buffer.length) {
      return { value: '', newOffset: offset };
    }
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    
    if (length === 0xFFFFFFFF) {
      return { value: null, newOffset: offset };
    }
    
    if (offset + length > buffer.length) {
      return { value: '', newOffset: offset };
    }
    
    const value = buffer.toString('utf8', offset, offset + length);
    return { value, newOffset: offset + length };
  }

  parseADIF(adifString) {
    const fields = {};
    
    // Optimization: matchAll instead of exec loop
    const fieldRegex = /<(\w+):(\d+)(?::(\w))?>/g;
    const matches = adifString.matchAll(fieldRegex);
    
    for (const match of matches) {
      const fieldName = match[1].toLowerCase();
      
      // Optimization: Set lookup is O(1) instead of O(n)
      if (!this.allFields.has(fieldName)) {
        continue;
      }
      
      const fieldLength = parseInt(match[2], 10);
      const startPos = match.index + match[0].length;
      
      // Validation: Check if enough data is available
      if (startPos + fieldLength > adifString.length) {
        continue;
      }
      
      // Optimization: slice instead of substr (deprecated)
      const value = adifString.slice(startPos, startPos + fieldLength);
      
      // Convert fields with validation
      try {
        switch(fieldName) {
          case 'qso_date':
            if (value.length === 8) {
              fields.qso_date = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
            } else {
              fields.qso_date = value;
            }
            break;
          case 'time_on':
          case 'time_off':
            if (value.length === 6) {
              fields[fieldName] = `${value.slice(0,2)}:${value.slice(2,4)}:${value.slice(4,6)}`;
            } else {
              fields[fieldName] = value;
            }
            break;
          case 'freq':
            const freq = parseFloat(value);
            fields[fieldName] = isNaN(freq) ? null : freq;
            break;
          case 'tx_pwr':
            const pwr = parseInt(value, 10);
            fields[fieldName] = isNaN(pwr) ? null : pwr;
            break;
          case 'rst_sent':
          case 'rst_rcvd':
            const rst = parseInt(value, 10);
            fields[fieldName] = isNaN(rst) ? null : rst;
            break;
          default:
            fields[fieldName] = value;
        }
      } catch (error) {
        // Skip field on parsing error
        continue;
      }
    }
    
    // Create QSO object in fixed order
    const qso = {
      call: fields.call || null,
      qso_date: fields.qso_date || null,
      time_on: fields.time_on || null,
      time_off: fields.time_off || null,
      band: fields.band || null,
      freq: fields.freq !== undefined ? fields.freq : null,
      mode: fields.mode || null,
      rst_sent: fields.rst_sent !== undefined ? fields.rst_sent : null,
      rst_rcvd: fields.rst_rcvd !== undefined ? fields.rst_rcvd : null,
      tx_pwr: fields.tx_pwr !== undefined ? fields.tx_pwr : null,
      comment: fields.comment || null
    };
    
    // Add optional fields only if present
    if (fields.sota_ref) {
      qso.sota_ref = fields.sota_ref;
    }
    if (fields.pota_ref) {
      qso.pota_ref = fields.pota_ref;
    }
    if (fields.wwff_ref) {
      qso.wwff_ref = fields.wwff_ref;
    }
    
    return qso;
  }

  convertToADIF(qsoData) {
    const adifFields = [];
    
    // Convert date back to YYYYMMDD
    if (qsoData.qso_date) {
      const date = qsoData.qso_date.replace(/-/g, '');
      adifFields.push(`<QSO_DATE:8>${date}`);
    }
    
    // Convert time back to HHMMSS
    if (qsoData.time_on) {
      const timeOn = qsoData.time_on.replace(/:/g, '');
      adifFields.push(`<TIME_ON:6>${timeOn}`);
    }
    if (qsoData.time_off) {
      const timeOff = qsoData.time_off.replace(/:/g, '');
      adifFields.push(`<TIME_OFF:6>${timeOff}`);
    }
    
    // All other fields
    if (qsoData.call) {
      adifFields.push(`<CALL:${qsoData.call.length}>${qsoData.call}`);
    }
    if (qsoData.band) {
      adifFields.push(`<BAND:${qsoData.band.length}>${qsoData.band}`);
    }
    if (qsoData.freq !== null) {
      const freq = qsoData.freq.toString();
      adifFields.push(`<FREQ:${freq.length}>${freq}`);
    }
    if (qsoData.mode) {
      adifFields.push(`<MODE:${qsoData.mode.length}>${qsoData.mode}`);
    }
    if (qsoData.rst_sent !== null) {
      const rstSent = qsoData.rst_sent.toString();
      adifFields.push(`<RST_SENT:${rstSent.length}>${rstSent}`);
    }
    if (qsoData.rst_rcvd !== null) {
      const rstRcvd = qsoData.rst_rcvd.toString();
      adifFields.push(`<RST_RCVD:${rstRcvd.length}>${rstRcvd}`);
    }
    if (qsoData.tx_pwr !== null) {
      const txPwr = qsoData.tx_pwr.toString();
      adifFields.push(`<TX_PWR:${txPwr.length}>${txPwr}`);
    }
    if (qsoData.comment) {
      adifFields.push(`<COMMENT:${qsoData.comment.length}>${qsoData.comment}`);
    }
    
    // Optional fields
    if (qsoData.sota_ref) {
      adifFields.push(`<SOTA_REF:${qsoData.sota_ref.length}>${qsoData.sota_ref}`);
    }
    if (qsoData.pota_ref) {
      adifFields.push(`<POTA_REF:${qsoData.pota_ref.length}>${qsoData.pota_ref}`);
    }
    if (qsoData.wwff_ref) {
      adifFields.push(`<WWFF_REF:${qsoData.wwff_ref.length}>${qsoData.wwff_ref}`);
    }
    
    return adifFields.join(' ') + ' <EOR>\n';
  }

  initializeADIFFile() {
    if (!this.adifPath) {
      return;
    }
    
    try {
      // Check if file exists
      if (!fs.existsSync(this.adifPath)) {
        // Create directory if needed
        const dir = path.dirname(this.adifPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create file with ADIF header
        const header = `ADIF Export from UDPLogParser
<ADIF_VER:5>3.1.4
<PROGRAMID:13>UDPLogParser
<PROGRAMVERSION:5>1.0.0
<EOH>\n`;
        
        fs.writeFileSync(this.adifPath, header, 'utf8');
        console.log(`ADIF file created: ${this.adifPath}`);
      } else {
        console.log(`Using existing ADIF file: ${this.adifPath}`);
      }
    } catch (error) {
      console.error(`Error initializing ADIF file: ${error.message}`);
      this.adifPath = null; // Disable ADIF logging on error
    }
  }

  appendToADIF(qsoData) {
    if (!this.adifPath) {
      return;
    }
    
    try {
      const adifRecord = this.convertToADIF(qsoData);
      fs.appendFileSync(this.adifPath, adifRecord, 'utf8');
      console.log(`QSO appended to ADIF file`);
    } catch (error) {
      console.error(`Error writing to ADIF file: ${error.message}`);
    }
  }

  parseLoggedADIF(buffer, offset) {
    // ID String
    let result = this.readQString(buffer, offset);
    offset = result.newOffset;

    // ADIF Text
    result = this.readQString(buffer, offset);
    const adifText = result.value;

    return this.parseADIF(adifText);
  }

  isN1MMPacket(buffer) {
    try {
      // Optimierung: Nur ersten Teil konvertieren (max 100 Bytes)
      const checkLength = Math.min(100, buffer.length);
      const text = buffer.toString('utf8', 0, checkLength);
      
      // Prüfe auf exakte N1MM Command-Struktur
      if (!text.includes('<command:3>Log')) {
        return false;
      }
      
      // Prüfe auf Parameters-Tag (könnte außerhalb der ersten 100 Bytes sein)
      const fullText = checkLength < buffer.length ? buffer.toString('utf8') : text;
      return /<parameters:\d+>/i.test(fullText);
      
    } catch (error) {
      return false;
    }
  }

  parseN1MM(buffer) {
    const text = buffer.toString('utf8');
    return this.parseADIF(text);
  }

  parseMessage(buffer) {
    try {
      if (buffer.length < 8) {
        throw new Error('Buffer too short');
      }

      // Check for N1MM format
      if (this.isN1MMPacket(buffer)) {
        const qsoData = this.parseN1MM(buffer);
        return {
          type: 'N1MM',
          data: qsoData
        };
      }

      let offset = 0;
      const magic = buffer.readUInt32BE(offset);
      offset += 4;

      if (magic !== this.MAGIC_NUMBER) {
        throw new Error(`Invalid magic number: 0x${magic.toString(16)}`);
      }

      const schema = buffer.readUInt32BE(offset);
      offset += 4;

      if (schema > 3) {
        throw new Error(`Unsupported schema version: ${schema}`);
      }

      const messageType = buffer.readUInt32BE(offset);
      offset += 4;

      const messageTypeName = this.MESSAGE_TYPES[messageType] || 'Unknown';

      if (messageType === 12) { // LoggedADIF
        const qsoData = this.parseLoggedADIF(buffer, offset);
        return {
          type: 'LoggedADIF',
          schema,
          data: qsoData
        };
      }

      return {
        type: messageTypeName,
        schema,
        messageType,
        note: 'Message type not parsed (only LoggedADIF implemented)'
      };

    } catch (error) {
      throw error;
    }
  }

  start(port = 2237, host = 'localhost') {
    // Initialize ADIF file if path provided
    this.initializeADIFFile();
    
    this.server.on('error', (err) => {
      console.error(`Server error: ${err.message}`);
    });

    this.server.on('message', (msg, rinfo) => {
      try {
        const parsed = this.parseMessage(msg);
        
        if (parsed.type === 'LoggedADIF') {
          console.log('\n=== QSO Logged (WSJT-X) ===');
          console.log(JSON.stringify(parsed.data, null, 2));
          this.appendToADIF(parsed.data);
        } else if (parsed.type === 'N1MM') {
          console.log('\n=== QSO Logged (N1MM) ===');
          console.log(JSON.stringify(parsed.data, null, 2));
          this.appendToADIF(parsed.data);
        } else {
          console.log(`Ignored: Message type ${parsed.messageType} (${parsed.type}) received`);
        }
      } catch (error) {
        console.error(`Parse error: ${error.message}`);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`UDPLogParser listening on ${address.address}:${address.port}`);
    });

    this.server.bind(port, host);
  }

  stop() {
    this.server.close();
    console.log('Server stopped');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let port = 2237; // Default port
let adifPath = null;

// Parse named arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    console.log(`Usage: node UDPLogParser.js [options]
  
Options:
  --port <number>      UDP port to listen on (default: 2237)
  --adif <path>        Path to ADIF log file (optional)
  -h, --help           Show this help message
  
Examples:
  node UDPLogParser.js
  node UDPLogParser.js --port 12345
  node UDPLogParser.js --port 2237 --adif ./logs/qso.adi
  node UDPLogParser.js --adif ./logs/qso.adi --port 2237
`);
    process.exit(0);
  }
  
  if (arg === '--port' || arg === '-p') {
    const portValue = args[i + 1];
    if (!portValue) {
      console.error('Error: --port requires a value');
      process.exit(1);
    }
    const parsedPort = parseInt(portValue, 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      console.error(`Error: Invalid port number "${portValue}"`);
      process.exit(1);
    }
    port = parsedPort;
    i++; // Skip next argument
    continue;
  }
  
  if (arg === '--adif' || arg === '-a') {
    const adifValue = args[i + 1];
    if (!adifValue) {
      console.error('Error: --adif requires a value');
      process.exit(1);
    }
    adifPath = adifValue;
    i++; // Skip next argument
    continue;
  }
  
  // Unknown argument
  console.error(`Error: Unknown option "${arg}"`);
  console.log('Use --help for usage information');
  process.exit(1);
}

// Start server
const parser = new UDPLogParser(adifPath);
parser.start(port, 'localhost');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  parser.stop();
  process.exit(0);
});