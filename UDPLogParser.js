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
    const requiredFields = ['call', 'qso_date', 'time_on', 'time_off', 'band', 'freq', 'mode', 'rst_sent', 'rst_rcvd', 'tx_pwr', 'comment'];
    const optionalFields = ['sota_ref', 'pota_ref', 'wwff_ref'];
    
    // Extrahiere alle ADIF-Felder
    const fieldRegex = /<(\w+):(\d+)(?::(\w))?>(.*?)(?=<|$)/gs;
    let match;
    
    while ((match = fieldRegex.exec(adifString)) !== null) {
      const fieldName = match[1].toLowerCase();
      const fieldLength = parseInt(match[2]);
      const startPos = match.index + match[0].length - match[4].length;
      const value = adifString.substr(startPos, fieldLength);
      
      // Nur benötigte und optionale Felder verarbeiten
      if (!requiredFields.includes(fieldName) && !optionalFields.includes(fieldName)) {
        continue;
      }
      
      // Konvertiere Felder
      switch(fieldName) {
        case 'qso_date':
          if (value.length === 8) {
            fields.qso_date = `${value.substr(0,4)}-${value.substr(4,2)}-${value.substr(6,2)}`;
          } else {
            fields.qso_date = value;
          }
          break;
        case 'time_on':
        case 'time_off':
          if (value.length === 6) {
            fields[fieldName] = `${value.substr(0,2)}:${value.substr(2,2)}:${value.substr(4,2)}`;
          } else {
            fields[fieldName] = value;
          }
          break;
        case 'freq':
          fields[fieldName] = parseFloat(value);
          break;
        case 'tx_pwr':
          fields[fieldName] = parseInt(value);
          break;
        case 'rst_sent':
        case 'rst_rcvd':
          fields[fieldName] = parseInt(value);
          break;
        default:
          fields[fieldName] = value;
      }
    }
    
    // Erstelle QSO-Objekt in fester Reihenfolge
    const qso = {
      call: fields.call || null,
      qso_date: fields.qso_date || null,
      time_on: fields.time_on || null,
      time_off: fields.time_off || null,
      band: fields.band || null,
      freq: fields.freq || null,
      mode: fields.mode || null,
      rst_sent: fields.rst_sent || null,
      rst_rcvd: fields.rst_rcvd || null,
      tx_pwr: fields.tx_pwr || null,
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
      const text = buffer.toString('utf8');
      
      // Prüfe auf exakte N1MM Command-Struktur
      const commandMatch = text.match(/^.{0,20}<command:3>Log/i);
      if (!commandMatch) {
        return false;
      }
      
      // Prüfe auf Parameters-Tag mit numerischer Länge
      const parametersMatch = text.match(/<parameters:\d+>/i);
      if (!parametersMatch) {
        return false;
      }
      
      return true;
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