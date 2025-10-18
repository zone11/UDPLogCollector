const dgram = require('dgram');

class UDPLogParser {
  constructor() {
    this.server = dgram.createSocket('udp4');
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
    
    const fieldRegex = /<(\w+):(\d+)(?::(\w))?>/g;
    const matches = adifString.matchAll(fieldRegex);
    
    for (const match of matches) {
      const fieldName = match[1].toLowerCase();
      
      if (!this.allFields.has(fieldName)) {
        continue;
      }
      
      const fieldLength = parseInt(match[2], 10);
      const startPos = match.index + match[0].length;
      
      // Validierung: Prüfe ob genug Daten vorhanden
      if (startPos + fieldLength > adifString.length) {
        continue;
      }
      
      const value = adifString.slice(startPos, startPos + fieldLength);
      
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
        // Bei Parsing-Fehler Feld überspringen
        continue;
      }
    }
    
    // Erstelle QSO-Objekt in fester Reihenfolge
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
    
    // Optionale Felder nur hinzufügen wenn vorhanden
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
      // Nur ersten Teil konvertieren (max 100 Bytes)
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

      // Prüfe auf N1MM Format
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
    this.server.on('error', (err) => {
      console.error(`Server error: ${err.message}`);
    });

    this.server.on('message', (msg, rinfo) => {
      try {
        const parsed = this.parseMessage(msg);
        
        if (parsed.type === 'LoggedADIF') {
          console.log('\n=== QSO Logged (WSJT-X) ===');
          console.log(JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'N1MM') {
          console.log('\n=== QSO Logged (N1MM) ===');
          console.log(JSON.stringify(parsed.data, null, 2));
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

// Start server
const parser = new UDPLogParser();
parser.start(2237, 'localhost');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  parser.stop();
  process.exit(0);
});