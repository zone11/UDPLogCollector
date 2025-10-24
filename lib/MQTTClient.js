const mqtt = require('mqtt');

class MQTTClient {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  connect() {
    if (!this.config || !this.config.broker) {
      return;
    }

    try {
      const options = {
        clientId: `UDPLogParser_${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
      };

      // Add authentication if provided
      if (this.config.username) {
        options.username = this.config.username;
      }
      if (this.config.password) {
        options.password = this.config.password;
      }

      // Parse broker URL - check if protocol is included
      let brokerUrl = this.config.broker;
      if (!brokerUrl.startsWith('mqtt://') && !brokerUrl.startsWith('mqtts://')) {
        // Backwards compatibility: assume mqtt:// if no protocol specified
        brokerUrl = `mqtt://${brokerUrl}`;
        console.log(`No protocol specified, using: ${brokerUrl}`);
      }

      console.log(`Connecting to MQTT broker: ${brokerUrl}`);
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        console.log(`MQTT connected to ${brokerUrl}`);
      });

      this.client.on('error', (error) => {
        console.error(`MQTT error: ${error.message}`);
      });

      this.client.on('reconnect', () => {
        console.log('MQTT reconnecting...');
      });

      this.client.on('close', () => {
        console.log('MQTT connection closed');
      });

    } catch (error) {
      console.error(`Error initializing MQTT: ${error.message}`);
      this.client = null;
    }
  }

  publish(qsoData) {
    if (!this.client || !this.client.connected) {
      return;
    }

    try {
      const topic = this.config.topic || 'qso/log';
      const payload = JSON.stringify(qsoData);
      
      this.client.publish(topic, payload, { qos: 1, retain: false }, (error) => {
        if (error) {
          console.error(`MQTT publish error: ${error.message}`);
        } else {
          console.log(`QSO published to MQTT topic: ${topic}`);
        }
      });
    } catch (error) {
      console.error(`Error publishing to MQTT: ${error.message}`);
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      console.log('MQTT connection closed');
    }
  }
}

module.exports = MQTTClient;