#!/usr/bin/env node

const UDPServer = require('./lib/UDPServer');

// Parse command line arguments
const args = process.argv.slice(2);
let port = 2237; // Default port
let adifPath = null;
let mqttConfig = {};
let wavelogConfig = {};

// Helper function to parse command line arguments
function parseArgument(args, i, argName) {
  const value = args[i + 1];
  if (!value) {
    console.error(`Error: ${argName} requires a value`);
    process.exit(1);
  }
  return value;
}

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
    const portValue = parseArgument(args, i, '--port');
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
    adifPath = parseArgument(args, i, '--adif');
    i++;
    continue;
  }

  if (arg === '--mqtt-broker') {
    mqttConfig.broker = parseArgument(args, i, '--mqtt-broker');
    i++;
    continue;
  }

  if (arg === '--mqtt-topic') {
    mqttConfig.topic = parseArgument(args, i, '--mqtt-topic');
    i++;
    continue;
  }

  if (arg === '--mqtt-username') {
    mqttConfig.username = parseArgument(args, i, '--mqtt-username');
    i++;
    continue;
  }

  if (arg === '--mqtt-password') {
    mqttConfig.password = parseArgument(args, i, '--mqtt-password');
    i++;
    continue;
  }

  if (arg === '--wavelog-url') {
    wavelogConfig.url = parseArgument(args, i, '--wavelog-url');
    i++;
    continue;
  }

  if (arg === '--wavelog-token') {
    wavelogConfig.token = parseArgument(args, i, '--wavelog-token');
    i++;
    continue;
  }

  if (arg === '--wavelog-stationid') {
    wavelogConfig.stationId = parseArgument(args, i, '--wavelog-stationid');
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

// Start server (ADIFHandler is passed to WavelogClient)
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