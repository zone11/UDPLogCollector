const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');
const pkg = require('../package.json');

class ADIFHandler {
  constructor(filePath = null) {
    this.logger = new Logger('ADIFHandler');
    this.filePath = filePath;

    if (filePath) {
      this.logger.debug(`ADIF file path set to: ${filePath}`);
    }
  }

  /**
   * Convert field value based on ADIF field type
   * Applies type conversions only where needed
   */
  convertFieldValue(fieldName, value) {
    if (!value) {
      return value;
    }

    try {
      // Date conversion: YYYYMMDD -> YYYY-MM-DD
      if (fieldName === 'qso_date' && value.length === 8) {
        return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
      }

      // Time conversion: HHMMSS -> HH:MM:SS
      if ((fieldName === 'time_on' || fieldName === 'time_off') && value.length === 6) {
        return `${value.slice(0,2)}:${value.slice(2,4)}:${value.slice(4,6)}`;
      }

      // Float fields (frequency)
      if (['freq', 'freq_rx'].includes(fieldName)) {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }

      // Integer fields
      if (['tx_pwr', 'rx_pwr', 'rst_sent', 'rst_rcvd', 'srx', 'stx', 'srx_string', 'stx_string'].includes(fieldName)) {
        const num = parseInt(value, 10);
        return isNaN(num) ? value : num;
      }

      // Default: return as string
      return value;
    } catch (error) {
      // On error, return original value
      return value;
    }
  }

  /**
   * Parse ADIF string and extract all fields
   * Generic parser that handles all ADIF fields automatically
   */
  parse(adifString) {
    const fields = {};

    // Parse all ADIF fields using regex
    const fieldRegex = /<(\w+):(\d+)(?::(\w))?>/g;
    const matches = adifString.matchAll(fieldRegex);

    for (const match of matches) {
      const fieldName = match[1].toLowerCase();
      const fieldLength = parseInt(match[2], 10);
      const startPos = match.index + match[0].length;

      // Validation: Check if enough data is available
      if (startPos + fieldLength > adifString.length) {
        continue;
      }

      const value = adifString.slice(startPos, startPos + fieldLength);

      // Convert field value based on type
      fields[fieldName] = this.convertFieldValue(fieldName, value);
    }

    return fields;
  }

  /**
   * Validate QSO data - only critical fields are checked
   * According to ADIF 3.1.4, there are no mandatory fields,
   * but CALL is practically required for a meaningful QSO
   */
  validate(qsoData) {
    if (!qsoData || typeof qsoData !== 'object') {
      this.logger.warn('Invalid QSO data: not an object');
      return false;
    }

    // Only check for callsign - the most critical field
    if (!qsoData.call || qsoData.call.trim() === '') {
      this.logger.warn('QSO missing critical field: CALL');
      return false;
    }

    this.logger.trace('QSO data validation passed');
    return true;
  }

  /**
   * Convert QSO data object to ADIF format string
   * Generic converter that handles all fields automatically
   */
  toADIF(qsoData, format = 'file') {
    const adifFields = [];
    const separator = format === 'api' ? '' : ' ';
    const eorTag = format === 'api' ? '<eor>' : '<EOR>\n';

    // Field order preference for readability (optional)
    const preferredOrder = [
      'call', 'qso_date', 'time_on', 'time_off', 'band', 'freq', 'mode',
      'rst_sent', 'rst_rcvd', 'tx_pwr', 'gridsquare', 'name', 'comment'
    ];

    /**
     * Format a single field to ADIF format
     */
    const formatField = (name, value) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }

      let adifValue = value.toString();

      // Convert formatted dates/times back to ADIF format
      if (name === 'qso_date' && adifValue.includes('-')) {
        adifValue = adifValue.replace(/-/g, '');
      } else if ((name === 'time_on' || name === 'time_off') && adifValue.includes(':')) {
        adifValue = adifValue.replace(/:/g, '');
      }

      return `<${name.toUpperCase()}:${adifValue.length}>${adifValue}`;
    };

    // Process preferred fields first (for readable output)
    for (const fieldName of preferredOrder) {
      if (qsoData[fieldName] !== undefined) {
        const field = formatField(fieldName, qsoData[fieldName]);
        if (field) {
          adifFields.push(field);
        }
      }
    }

    // Then process all other fields
    for (const [fieldName, value] of Object.entries(qsoData)) {
      if (!preferredOrder.includes(fieldName)) {
        const field = formatField(fieldName, value);
        if (field) {
          adifFields.push(field);
        }
      }
    }

    return adifFields.join(separator) + separator + eorTag;
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
          this.logger.debug(`Creating directory: ${dir}`);
          fs.mkdirSync(dir, { recursive: true });
        }

        // Create file with ADIF header
        const programId = pkg.name;
        const programVersion = pkg.version;
        const adifVersion = '3.1.4';

        this.logger.debug(`Creating ADIF file with version ${adifVersion}`);

        const header = `ADIF Export from ${programId}
<ADIF_VER:${adifVersion.length}>${adifVersion}
<PROGRAMID:${programId.length}>${programId}
<PROGRAMVERSION:${programVersion.length}>${programVersion}
<EOH>\n`;

        fs.writeFileSync(this.filePath, header, 'utf8');
        this.logger.success(`ADIF file created: ${this.filePath}`);
      } else {
        this.logger.success(`Using existing ADIF file: ${this.filePath}`);
      }
    } catch (error) {
      this.logger.error(`Error initializing ADIF file: ${error.message}`);
      this.filePath = null; // Disable ADIF logging on error
    }
  }

  append(qsoData) {
    if (!this.filePath) {
      return false;
    }

    try {
      const adifRecord = this.toADIF(qsoData, 'file');
      fs.appendFileSync(this.filePath, adifRecord, 'utf8');
      this.logger.success(`QSO appended to ADIF file`);
      return true;
    } catch (error) {
      this.logger.error(`Error writing to ADIF file: ${error.message}`);
      return false;
    }
  }
}

module.exports = ADIFHandler;