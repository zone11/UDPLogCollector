#!/usr/bin/env node

const UDPServer = require('./lib/UDPServer');

// Parse command line arguments
const args = process.argv.slice(2);
let port = 2237; // Default port
let adifPath = null;
let mqttConfig = {};
let wavelogConfig = {};

// Parse named arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    console.log(`Usage: node index.js [options]
  
Options:
  --port <number>          UDP port to listen on (default: 2237)
  --adif <path>            Path to ADIF log file (optional)
  --mqtt-broker <url>      MQTT broker URL (mqtt://host:port or mqtts://host:port)
  --mqtt-topic <topic>     MQTT topic (default: qso/log)
  --mqtt-username <user>   MQTT username (optional)
  --mqtt-password <pass>   MQTT password (optional)
  --wavelog-url <url>      Wavelog instance URL (e.g., https://log.example.com)
  --wavelog-token <token>  Wavelog API token
  --wavelog-stationid <id> Wavelog station profile ID
  -h, --help               Show this help message
  
Examples:
  node index.js
  node index.js --port 2237 --adif ./logs/qso.adi
  node index.js --mqtt-broker mqtt://broker.hivemq.com:1883 --mqtt-topic ham/qso
  node index.js --mqtt-broker mqtts://broker.example.com:8883 --mqtt-username user --mqtt-password pass
  node index.js --wavelog-url https://log.example.com --wavelog-token YOUR_API_KEY --wavelog-stationid 1
  node index.js --port 2237 --adif ./logs/qso.adi --mqtt-broker mqtt://localhost:1883 --mqtt-topic qso/log
`);
    process.exit(0);
  }
  
  if (arg === '--port' || arg === '-p') {
    const portValue = args[i + 1];
    if (!portValue) {
      console.error('Error: --port requires a value');
      process.exit(1);
    }
    const parsedPort = parseInt(portValue, 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      console.error(`Error: Invalid port number "${portValue}"`);
      process.exit(1);
    }
    port = parsedPort;
    i++;
    continue;
  }
  
  if (arg === '--adif' || arg === '-a') {
    const adifValue = args[i + 1];
    if (!adifValue) {
      console.error('Error: --adif requires a value');
      process.exit(1);
    }
    adifPath = adifValue;
    i++;
    continue;
  }
  
  if (arg === '--mqtt-broker') {
    const brokerValue = args[i + 1];
    if (!brokerValue) {
      console.error('Error: --mqtt-broker requires a value');
      process.exit(1);
    }
    mqttConfig.broker = brokerValue;
    i++;
    continue;
  }
  
  if (arg === '--mqtt-topic') {
    const topicValue = args[i + 1];
    if (!topicValue) {
      console.error('Error: --mqtt-topic requires a value');
      process.exit(1);
    }
    mqttConfig.topic = topicValue;
    i++;
    continue;
  }
  
  if (arg === '--mqtt-username') {
    const usernameValue = args[i + 1];
    if (!usernameValue) {
      console.error('Error: --mqtt-username requires a value');
      process.exit(1);
    }
    mqttConfig.username = usernameValue;
    i++;
    continue;
  }
  
  if (arg === '--mqtt-password') {
    const passwordValue = args[i + 1];
    if (!passwordValue) {
      console.error('Error: --mqtt-password requires a value');
      process.exit(1);
    }
    mqttConfig.password = passwordValue;
    i++;
    continue;
  }
  
  if (arg === '--wavelog-url') {
    const urlValue = args[i + 1];
    if (!urlValue) {
      console.error('Error: --wavelog-url requires a value');
      process.exit(1);
    }
    wavelogConfig.url = urlValue;
    i++;
    continue;
  }
  
  if (arg === '--wavelog-token') {
    const tokenValue = args[i + 1];
    if (!tokenValue) {
      console.error('Error: --wavelog-token requires a value');
      process.exit(1);
    }
    wavelogConfig.token = tokenValue;
    i++;
    continue;
  }
  
  if (arg === '--wavelog-stationid') {
    const stationIdValue = args[i + 1];
    if (!stationIdValue) {
      console.error('Error: --wavelog-stationid requires a value');
      process.exit(1);
    }
    wavelogConfig.stationId = stationIdValue;
    i++;
    continue;
  }
  
  // Unknown argument
  console.error(`Error: Unknown option "${arg}"`);
  console.log('Use --help for usage information');
  process.exit(1);
}

// Validate MQTT config
const mqttEnabled = Object.keys(mqttConfig).length > 0;
if (mqttEnabled && !mqttConfig.broker) {
  console.error('Error: --mqtt-broker is required when using MQTT options');
  process.exit(1);
}

// Validate Wavelog config
const wavelogEnabled = Object.keys(wavelogConfig).length > 0;
if (wavelogEnabled) {
  if (!wavelogConfig.url || !wavelogConfig.token || !wavelogConfig.stationId) {
    console.error('Error: --wavelog-url, --wavelog-token, and --wavelog-stationid are all required when using Wavelog');
    process.exit(1);
  }
}

// Start server (ADIFHandler wird an WavelogClient übergeben)
const server = new UDPServer({
  port,
  host: 'localhost',
  adifPath,
  mqttConfig: mqttEnabled ? mqttConfig : null,
  wavelogConfig: wavelogEnabled ? wavelogConfig : null
});

server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.stop();
  process.exit(0);
});