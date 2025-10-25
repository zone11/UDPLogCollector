const mqtt = require('mqtt');
const Logger = require('./Logger');

class MQTTClient {
  constructor(config) {
    this.logger = new Logger('MQTTClient');
    this.config = config;
    this.client = null;
  }

  connect() {
    if (!this.config || !this.config.broker) {
      this.logger.warn('MQTT not configured');
      return;
    }

    try {
      const options = {
        clientId: `UDPLogCollector_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
      };

      // Add authentication if provided
      if (this.config.username) {
        options.username = this.config.username;
        this.logger.debug('Using MQTT authentication');
      }
      if (this.config.password) {
        options.password = this.config.password;
      }

      // Parse broker URL - check if protocol is included
      let brokerUrl = this.config.broker;
      if (!brokerUrl.startsWith('mqtt://') && !brokerUrl.startsWith('mqtts://')) {
        // Backwards compatibility: assume mqtt:// if no protocol specified
        brokerUrl = `mqtt://${brokerUrl}`;
        this.logger.warn(`No protocol specified, assuming: ${brokerUrl}`);
      }

      this.logger.info(`Connecting to MQTT broker: ${brokerUrl}`);
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.logger.success(`Connected to ${brokerUrl}`);
      });

      this.client.on('error', (error) => {
        this.logger.error(`Connection error: ${error.message}`);
      });

      this.client.on('reconnect', () => {
        this.logger.info('Reconnecting to MQTT broker...');
      });

      this.client.on('close', () => {
        this.logger.info('Connection closed');
      });

    } catch (error) {
      this.logger.error(`Initialization error: ${error.message}`);
      this.client = null;
    }
  }

  publish(qsoData) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        const error = new Error('MQTT client not connected');
        this.logger.error('Publish failed: Client not connected');
        reject(error);
        return;
      }

      try {
        const topic = this.config.topic || 'qso/log';
        const payload = JSON.stringify(qsoData);

        this.logger.debug(`Publishing to topic: ${topic}`);

        this.client.publish(topic, payload, { qos: 1, retain: false }, (error) => {
          if (error) {
            this.logger.error(`Publish error: ${error.message}`);
            reject(error);
          } else {
            this.logger.success(`Published to ${topic}`);
            resolve();
          }
        });
      } catch (error) {
        this.logger.error(`Error preparing publish: ${error.message}`);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.client) {
      this.logger.info('Disconnecting from MQTT broker');
      this.client.end();
      this.logger.debug('MQTT client disconnected');
    }
  }
}

module.exports = MQTTClient;