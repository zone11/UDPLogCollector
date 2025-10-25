const https = require('https');
const http = require('http');
const Logger = require('./Logger');

class WavelogClient {
  constructor(config, adifHandler) {
    this.logger = new Logger('WavelogClient');
    this.config = config;
    this.adifHandler = adifHandler;
    this.validateConfig();
  }

  validateConfig() {
    this.logger.debug('Validating Wavelog configuration');

    if (!this.config || !this.config.url) {
      throw new Error('Wavelog URL is required');
    }
    if (!this.config.token) {
      throw new Error('Wavelog API token is required');
    }
    if (!this.config.stationId) {
      throw new Error('Wavelog station ID is required');
    }

    // Ensure URL has no trailing slash
    this.config.url = this.config.url.replace(/\/$/, '');

    // Convert station ID to integer
    this.config.stationId = parseInt(this.config.stationId, 10);
    if (isNaN(this.config.stationId)) {
      throw new Error('Wavelog station ID must be a valid number');
    }

    // Parse URL to determine protocol
    this.isHttps = this.config.url.startsWith('https://');

    this.logger.debug(`Wavelog configured for ${this.isHttps ? 'HTTPS' : 'HTTP'}: ${this.config.url}`);
  }

  upload(qsoData) {
    if (!this.config) {
      return Promise.reject(new Error('Wavelog not configured'));
    }

    return new Promise((resolve, reject) => {
      try {
        this.logger.debug(`Uploading QSO for ${qsoData.call}`);

        // Use ADIFHandler to convert QSO data to ADIF string
        const adifString = this.adifHandler.toADIF(qsoData, 'api');

        // Prepare API payload
        const payload = {
          key: this.config.token,
          station_profile_id: this.config.stationId,
          type: 'adif',
          string: adifString
        };

        const payloadString = JSON.stringify(payload);

        // Parse URL
        const apiUrl = `${this.config.url}/index.php/api/qso`;
        const urlObj = new URL(apiUrl);

        // Prepare request options
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (this.isHttps ? 443 : 80),
          path: urlObj.pathname,
          method: 'POST',
          timeout: 30000, // 30 second timeout
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(payloadString)
          }
        };

        const httpModule = this.isHttps ? https : http;

        this.logger.trace(`Sending ${this.isHttps ? 'HTTPS' : 'HTTP'} request to ${urlObj.hostname}`);

        const req = httpModule.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const response = JSON.parse(data);
                this.logger.success('QSO uploaded to Wavelog');
                this.logger.trace('Response:', response);
                resolve(response);
              } catch (error) {
                this.logger.success('QSO uploaded to Wavelog');
                resolve(data);
              }
            } else {
              this.logger.error(`Upload failed: HTTP ${res.statusCode}`);
              this.logger.debug(`Response: ${data}`);
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          this.logger.error(`Upload error: ${error.message}`);
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          const error = new Error('Request timeout');
          this.logger.error('Upload timeout after 30 seconds');
          reject(error);
        });

        req.write(payloadString);
        req.end();

      } catch (error) {
        this.logger.error(`Error preparing upload: ${error.message}`);
        reject(error);
      }
    });
  }
}

module.exports = WavelogClient;