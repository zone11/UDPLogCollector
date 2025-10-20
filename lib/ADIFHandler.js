const fs = require('fs');
const path = require('path');

class ADIFHandler {
  constructor(filePath = null) {
    this.filePath = filePath;
    
    // Optimization: Set for faster lookup
    this.requiredFields = new Set(['call', 'qso_date', 'time_on', 'time_off', 'band', 'freq', 'mode', 'rst_sent', 'rst_rcvd', 'tx_pwr', 'comment']);
    this.optionalFields = new Set(['sota_ref', 'pota_ref', 'wwff_ref']);
    this.allFields = new Set([...this.requiredFields, ...this.optionalFields]);
  }

  parse(adifString) {
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

  toADIF(qsoData) {
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

  initializeFile() {
    if (!this.filePath) {
      return;
    }
    
    try {
      // Check if file exists
      if (!fs.existsSync(this.filePath)) {
        // Create directory if needed
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create file with ADIF header
        const header = `ADIF Export from UDPLogParser
<ADIF_VER:5>3.1.4
<PROGRAMID:13>UDPLogParser
<PROGRAMVERSION:5>1.0.0
<EOH>\n`;
        
        fs.writeFileSync(this.filePath, header, 'utf8');
        console.log(`ADIF file created: ${this.filePath}`);
      } else {
        console.log(`Using existing ADIF file: ${this.filePath}`);
      }
    } catch (error) {
      console.error(`Error initializing ADIF file: ${error.message}`);
      this.filePath = null; // Disable ADIF logging on error
    }
  }

  append(qsoData) {
    if (!this.filePath) {
      return;
    }
    
    try {
      const adifRecord = this.toADIF(qsoData);
      fs.appendFileSync(this.filePath, adifRecord, 'utf8');
      console.log(`QSO appended to ADIF file`);
    } catch (error) {
      console.error(`Error writing to ADIF file: ${error.message}`);
    }
  }
}

module.exports = ADIFHandler;