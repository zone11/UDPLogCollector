const dgram = require('dgram');
const Logger = require('./Logger');
const ProtocolParser = require('./ProtocolParser');
const ADIFHandler = require('./ADIFHandler');
const MQTTClient = require('./MQTTClient');
const WavelogClient = require('./WavelogClient');

class UDPServer {
  constructor(config = {}) {
    this.logger = new Logger('UDPServer');
    this.server = dgram.createSocket('udp4');
    this.port = config.port || 2237;
    this.host = config.host || 'localhost';

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
        this.logger.info(`Wavelog integration enabled: ${config.wavelogConfig.url}`);
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
      try {
        this.logger.trace(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        const parsed = this.protocolParser.parse(msg);

        if (parsed.type === 'LoggedADIF' || parsed.type === 'N1MM') {
          // Parse ADIF text to QSO data
          const qsoData = this.adifHandler.parse(parsed.adifText);

          // Validate QSO data
          if (!this.adifHandler.validate(qsoData)) {
            this.logger.warn('Invalid QSO data received - skipping');
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