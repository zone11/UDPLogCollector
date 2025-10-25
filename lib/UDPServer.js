const dgram = require('dgram');
const ProtocolParser = require('./ProtocolParser');
const ADIFHandler = require('./ADIFHandler');
const MQTTClient = require('./MQTTClient');
const WavelogClient = require('./WavelogClient');

class UDPServer {
  constructor(config = {}) {
    this.server = dgram.createSocket('udp4');
    this.port = config.port || 2237;
    this.host = config.host || 'localhost';
    
    // Initialize handlers
    this.protocolParser = new ProtocolParser();
    this.adifHandler = new ADIFHandler(config.adifPath || null);
    this.mqttClient = config.mqttConfig ? new MQTTClient(config.mqttConfig) : null;
    this.wavelogClient = null;
    
    // Initialize Wavelog client if configured
    if (config.wavelogConfig) {
      try {
        this.wavelogClient = new WavelogClient(config.wavelogConfig, this.adifHandler);
        console.log(`Wavelog integration enabled: ${config.wavelogConfig.url}`);
      } catch (error) {
        console.error(`Wavelog initialization error: ${error.message}`);
        this.wavelogClient = null;
      }
    }
  }

  start() {
    // Initialize ADIF file if configured
    if (this.adifHandler && this.adifHandler.filePath) {
      this.adifHandler.initializeFile();
    }
    
    // Connect to MQTT if configured
    if (this.mqttClient) {
      this.mqttClient.connect();
    }
    
    this.server.on('error', (err) => {
      console.error(`Server error: ${err.message}`);
    });

    this.server.on('message', (msg, rinfo) => {
      try {
        const parsed = this.protocolParser.parse(msg);
        
        if (parsed.type === 'LoggedADIF' || parsed.type === 'N1MM') {
          // Parse ADIF text to QSO data
          const qsoData = this.adifHandler.parse(parsed.adifText);

          // Validate QSO data
          if (!this.adifHandler.validate(qsoData)) {
            console.error('Invalid QSO data received - skipping');
            return;
          }

          // Log to console
          const sourceLabel = parsed.type === 'N1MM' ? 'N1MM' : 'WSJT-X';
          console.log(`\n=== QSO Logged (${sourceLabel}) ===`);
          console.log(JSON.stringify(qsoData, null, 2));

          // Write to ADIF file
          if (this.adifHandler && this.adifHandler.filePath) {
            const success = this.adifHandler.append(qsoData);
            if (!success) {
              console.error('Failed to write QSO to ADIF file');
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

    this.server.bind(this.port, this.host);
  }

  stop() {
    if (this.mqttClient) {
      this.mqttClient.disconnect();
    }
    this.server.close();
    console.log('Server stopped');
  }
}

module.exports = UDPServer;