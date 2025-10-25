/**
 * Simple yet powerful logging system for UDPLogCollector
 * Supports multiple log levels and module-based logging
 */
class Logger {
  static LOG_LEVELS = {
    NONE: -1,    // No logging (only success messages and raw output)
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
  };

  static COLORS = {
    ERROR: '\x1b[31m',   // Red
    WARN: '\x1b[33m',    // Yellow
    INFO: '\x1b[36m',    // Cyan
    DEBUG: '\x1b[35m',   // Magenta
    TRACE: '\x1b[90m',   // Gray
    RESET: '\x1b[0m',
    MODULE: '\x1b[34m',  // Blue
    SUCCESS: '\x1b[32m'  // Green
  };

  // Global log level (default: NONE - only success messages)
  static currentLevel = Logger.LOG_LEVELS.NONE;

  // Color output enabled/disabled
  static useColors = true;

  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  /**
   * Set global log level
   * @param {string} level - ERROR, WARN, INFO, DEBUG, or TRACE
   */
  static setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (Logger.LOG_LEVELS.hasOwnProperty(upperLevel)) {
      Logger.currentLevel = Logger.LOG_LEVELS[upperLevel];
      return true;
    }
    return false;
  }

  /**
   * Get current log level name
   */
  static getLevelName() {
    for (const [name, value] of Object.entries(Logger.LOG_LEVELS)) {
      if (value === Logger.currentLevel) {
        return name;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Disable colors (useful for file output or CI/CD)
   */
  static disableColors() {
    Logger.useColors = false;
  }

  /**
   * Format timestamp
   */
  _getTimestamp() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  /**
   * Apply color to text
   */
  _colorize(text, colorCode) {
    if (!Logger.useColors) {
      return text;
    }
    return `${colorCode}${text}${Logger.COLORS.RESET}`;
  }

  /**
   * Core logging method
   */
  _log(level, message, ...args) {
    if (Logger.LOG_LEVELS[level] > Logger.currentLevel) {
      return; // Skip if below current level
    }

    const timestamp = this._getTimestamp();
    const levelStr = this._colorize(level.padEnd(5), Logger.COLORS[level]);
    const moduleStr = this._colorize(this.moduleName, Logger.COLORS.MODULE);

    // Format: [timestamp] LEVEL ModuleName: message
    const formattedMessage = `[${timestamp}] ${levelStr} ${moduleStr}: ${message}`;

    // Use appropriate console method
    switch (level) {
      case 'ERROR':
        console.error(formattedMessage, ...args);
        break;
      case 'WARN':
        console.warn(formattedMessage, ...args);
        break;
      default:
        console.log(formattedMessage, ...args);
    }
  }

  /**
   * Public logging methods
   */
  error(message, ...args) {
    this._log('ERROR', message, ...args);
  }

  warn(message, ...args) {
    this._log('WARN', message, ...args);
  }

  info(message, ...args) {
    this._log('INFO', message, ...args);
  }

  debug(message, ...args) {
    this._log('DEBUG', message, ...args);
  }

  trace(message, ...args) {
    this._log('TRACE', message, ...args);
  }

  /**
   * Success message (always visible, with green checkmark)
   * Success events are important and should always be shown regardless of log level
   */
  success(message, ...args) {
    const timestamp = this._getTimestamp();
    const checkmark = this._colorize('✓', Logger.COLORS.SUCCESS);
    const moduleStr = this._colorize(this.moduleName, Logger.COLORS.MODULE);

    console.log(`[${timestamp}] ${checkmark} ${moduleStr}: ${message}`, ...args);
  }

  /**
   * Raw output (no formatting, no filtering)
   * Useful for banners, help text, etc.
   */
  raw(...args) {
    console.log(...args);
  }
}

module.exports = Logger;
