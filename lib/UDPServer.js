const dgram = require('dgram');
const net = require('net');
const Logger = require('./Logger');
const ProtocolParser = require('./ProtocolParser');
const ADIFHandler = require('./ADIFHandler');
const MQTTClient = require('./MQTTClient');
const WavelogClient = require('./WavelogClient');

// Loopback, private LAN ranges and link-local
const DEFAULT_ALLOWED_SOURCES = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16'];

class UDPServer {
  // Build an allow list from IPv4 addresses and CIDR ranges, the UDP socket is IPv4 only
  static parseAllowList(entries) {
    const allowList = new net.BlockList();
    for (const entry of entries) {
      const [address, prefix, ...rest] = entry.split('/');
      const validPrefix = prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) <= 32);
      if (!net.isIPv4(address) || !validPrefix || rest.length > 0) {
        throw new Error(`Invalid IPv4 address or CIDR range "${entry}"`);
      }
      if (prefix === undefined) {
        allowList.addAddress(address, 'ipv4');
      } else {
        allowList.addSubnet(address, Number(prefix), 'ipv4');
      }
    }
    return allowList;
  }

  constructor(config = {}) {
    this.logger = new Logger('UDPServer');
    this.server = dgram.createSocket('udp4');
    this.port = config.port || 2237;
    this.host = config.host || 'localhost';
    this.allowedSources = config.allowedSources || DEFAULT_ALLOWED_SOURCES;
    this.allowList = UDPServer.parseAllowList(this.allowedSources);

    this.logger.debug(`Initializing UDP Server on ${this.host}:${this.port}`);

    // Initialize handlers
    this.protocolParser = new ProtocolParser();
    this.adifHandler = new ADIFHandler(config.adifPath || null);
    this.mqttClient = config.mqttConfig ? new MQTTClient(config.mqttConfig) : null;
    this.wavelogClient = null;

    // Initialize Wavelog client if configured
    if (config.wavelogConfig) {
      try {
        this.wavelogClient = new WavelogClient(config.wavelogConfig, this.adifHandler);
        this.logger.success(`Wavelog integration enabled: ${config.wavelogConfig.url} (API v${this.wavelogClient.apiVersion})`);
      } catch (error) {
        this.logger.error(`Wavelog initialization error: ${error.message}`);
        this.wavelogClient = null;
      }
    }
  }

  start() {
    this.logger.info('Starting UDP Server');

    // Initialize ADIF file if configured
    if (this.adifHandler && this.adifHandler.filePath) {
      this.adifHandler.initializeFile();
    }

    // Connect to MQTT if configured
    if (this.mqttClient) {
      this.mqttClient.connect();
    }

    this.server.on('error', (err) => {
      this.logger.error(`Server error: ${err.message}`);
    });

    this.server.on('message', (msg, rinfo) => {
      // DEBUG only, so a flood from outside cannot fill the log
      if (!this.allowList.check(rinfo.address, 'ipv4')) {
        this.logger.debug(`Dropped ${msg.length} bytes from ${rinfo.address}: not an allowed source`);
        return;
      }

      try {
        this.logger.trace(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        const parsed = this.protocolParser.parse(msg);

        if (parsed.type === 'LoggedADIF' || parsed.type === 'N1MM') {
          // Parse ADIF text to QSO data
          const qsoData = this.adifHandler.parse(parsed.adifText);

          // Validate QSO data
          const invalidReason = this.adifHandler.validationError(qsoData);
          if (invalidReason) {
            this.logger.notice(`Rejected QSO from ${rinfo.address}: ${invalidReason} - ADIF: ${ADIFHandler.escapeForLog(parsed.adifText)}`);
            return;
          }

          // Log QSO
          const sourceLabel = parsed.type === 'N1MM' ? 'N1MM' : 'WSJT-X';
          this.logger.success(`QSO logged from ${sourceLabel}: ${qsoData.call} on ${qsoData.band || qsoData.freq}`);
          this.logger.debug('QSO data:', JSON.stringify(qsoData, null, 2));

          // Write to ADIF file
          if (this.adifHandler && this.adifHandler.filePath) {
            const success = this.adifHandler.append(qsoData);
            if (!success) {
              this.logger.error('Failed to write QSO to ADIF file');
            }
          }

          // Publish to MQTT
          if (this.mqttClient) {
            this.mqttClient.publish(qsoData).catch(error => {
              // Error already logged in MQTTClient
            });
          }

          // Upload to Wavelog
          if (this.wavelogClient) {
            this.wavelogClient.upload(qsoData).catch(error => {
              // Error already logged in WavelogClient
            });
          }
        } else {
          this.logger.debug(`Ignored message type ${parsed.messageType} (${parsed.type})`);
        }
      } catch (error) {
        this.logger.error(`Parse error: ${error.message}`);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.logger.success(`Listening on ${address.address}:${address.port}`);
      this.logger.success(`Accepting packets from ${this.allowedSources.join(', ')}`);
    });

    this.server.bind(this.port, this.host);
  }

  stop() {
    this.logger.info('Stopping UDP Server');
    if (this.mqttClient) {
      this.mqttClient.disconnect();
    }
    this.server.close();
    this.logger.info('Server stopped');
  }
}

module.exports = UDPServer;