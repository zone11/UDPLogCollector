class ProtocolParser {
  constructor() {
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

  isN1MMPacket(buffer) {
    try {
      // Optimization: Only convert first part (max 100 bytes)
      const checkLength = Math.min(100, buffer.length);
      const text = buffer.toString('utf8', 0, checkLength);
      
      // Check for exact N1MM command structure
      if (!text.includes('<command:3>Log')) {
        return false;
      }
      
      // Check for Parameters tag (might be outside first 100 bytes)
      const fullText = checkLength < buffer.length ? buffer.toString('utf8') : text;
      return /<parameters:\d+>/i.test(fullText);
      
    } catch (error) {
      return false;
    }
  }

  parseN1MM(buffer) {
    const text = buffer.toString('utf8');
    return { type: 'N1MM', adifText: text };
  }

  parseWSJTX(buffer) {
    try {
      if (buffer.length < 8) {
        throw new Error('Buffer too short');
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
        // ID String
        let result = this.readQString(buffer, offset);
        offset = result.newOffset;

        // ADIF Text
        result = this.readQString(buffer, offset);
        const adifText = result.value;

        return {
          type: 'LoggedADIF',
          schema,
          adifText
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

  parse(buffer) {
    // Check for N1MM format first
    if (this.isN1MMPacket(buffer)) {
      return this.parseN1MM(buffer);
    }

    // Try WSJT-X format
    return this.parseWSJTX(buffer);
  }
}

module.exports = ProtocolParser;