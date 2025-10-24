const https = require('https');
const http = require('http');

class WavelogClient {
  constructor(config, adifHandler) {
    this.config = config;
    this.adifHandler = adifHandler;
    this.validateConfig();
  }

  validateConfig() {
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
    
    // Parse URL to determine protocol
    this.isHttps = this.config.url.startsWith('https://');
  }

  upload(qsoData) {
    if (!this.config) {
      return Promise.reject(new Error('Wavelog not configured'));
    }

    return new Promise((resolve, reject) => {
      try {
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
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(payloadString)
          }
        };

        const httpModule = this.isHttps ? https : http;
        
        const req = httpModule.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const response = JSON.parse(data);
                console.log('QSO uploaded to Wavelog');
                resolve(response);
              } catch (error) {
                console.log('QSO uploaded to Wavelog (non-JSON response)');
                resolve(data);
              }
            } else {
              console.error(`Wavelog upload failed: HTTP ${res.statusCode}`);
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          console.error(`Wavelog upload error: ${error.message}`);
          reject(error);
        });

        req.write(payloadString);
        req.end();

      } catch (error) {
        console.error(`Error preparing Wavelog upload: ${error.message}`);
        reject(error);
      }
    });
  }
}

module.exports = WavelogClient;