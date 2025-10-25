## Usage

### Basic Usage

```bash
node index.js
```

### With ADIF Logging

```bash
node index.js --adif ./logs/qso.adi
```

### With MQTT

```bash
# Unencrypted
node index.js --mqtt-broker mqtt://broker.hivemq.com:1883 --mqtt-topic ham/qso

# Encrypted with authentication
node index.js \
  --mqtt-broker mqtts://broker.example.com:8883 \
  --mqtt-username myuser \
  --mqtt-password mypass \
  --mqtt-topic qso/log
```

### With Wavelog

```bash
node index.js \
  --wavelog-url https://log.example.com \
  --wavelog-token YOUR_API_KEY \
  --wavelog-stationid 1
```

### Combined Configuration

```bash
node index.js \
  --port 2237 \
  --adif ./logs/qso.adi \
  --mqtt-broker mqtts://broker.example.com:8883 \
  --mqtt-username myuser \
  --mqtt-password mypass \
  --wavelog-url https://log.example.com \
  --wavelog-token YOUR_API_KEY \
  --wavelog-stationid 1
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port` | UDP port to listen on | 2237 |
| `--adif` | Path to ADIF log file | none |
| `--mqtt-broker` | MQTT broker URL (mqtt:// or mqtts://) | none |
| `--mqtt-topic` | MQTT topic | qso/log |
| `--mqtt-username` | MQTT username | none |
| `--mqtt-password` | MQTT password | none |
| `--wavelog-url` | Wavelog instance URL | none |
| `--wavelog-token` | Wavelog API token | none |
| `--wavelog-stationid` | Wavelog station profile ID | none |
| `--log-level` | Log level: NONE, ERROR, WARN, INFO, DEBUG, TRACE | NONE |
| `--help` | Show help message | - |

## Logging

By default, the application runs in quiet mode (`NONE` log level), showing only the startup banner and important success messages (like "Server listening", "Connected to MQTT", etc.).

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `NONE` | Only success messages (default) | Production use, quiet operation |
| `ERROR` | Only errors | Production monitoring |
| `WARN` | Errors and warnings | Production with issue tracking |
| `INFO` | General information | Development, testing |
| `DEBUG` | Detailed debugging information | Troubleshooting |
| `TRACE` | Very verbose output (includes raw packets) | Deep debugging |

### Examples

```bash
# Quiet mode (default) - only success messages
node index.js

# Show errors only
node index.js --log-level ERROR
```

## Application Setup

### Single Computer Setup

Configure your logging software to send UDP data to `localhost` or `127.0.0.1` on port `2237`.

**WSJT-X:**
1. Go to **File → Settings → Reporting**
2. Enable **UDP Server**
3. Set **UDP Server** to `127.0.0.1`
4. Set **UDP Server Port** to `2237`

**N1MM Logger+:**
1. Go to **Config → Configure Ports, Mode Control...**
2. Enable **Broadcast Data**
3. Set port to `2237`

### Multi-Station Network Setup

For multi-operator contests or field day setups, run UDPLogCollector on one computer in your network and configure all logging applications to send UDP data to that computer's IP address.

**Example:** UDPLogCollector runs on computer with IP `192.168.1.100`

**WSJT-X on other stations:**
1. Set **UDP Server** to `192.168.1.100`
2. Set **UDP Server Port** to `2237`

**N1MM Logger+ on other stations:**
1. Configure **Broadcast Data** to `192.168.1.100:2237`

**Note:** Ensure firewall rules allow UDP traffic on port 2237 between stations.

## MQTT Integration

When MQTT is configured, each QSO is published as JSON to the specified topic.

**Configuration:**
- QoS 1 (at least once delivery)
- Message format: JSON with complete QSO data
- Protocol: Automatically detected from URL (`mqtt://` or `mqtts://`)

**Example topics:**
- `ham/qso` - General QSO logging
- `contest/qso` - Contest QSOs
- `field-day/qso` - Field day operations

## Wavelog Integration

Automatically upload QSOs to your Wavelog instance.

### Setup

1. **Generate API Token:**
   - Log into Wavelog
   - Navigate to **Account → API**
   - Create a new API token (read+write permissions required)

2. **Find Station Profile ID:**
   - Go to **Station Profiles**
   - Edit your station profile
   - The ID is in the URL: `.../station/edit/1` (ID = 1)

3. **Start with Wavelog:**
   ```bash
   node index.js \
     --wavelog-url https://your-wavelog.com \
     --wavelog-token YOUR_API_TOKEN \
     --wavelog-stationid 1
   ```

### Notes

- QSOs are uploaded immediately after logging
- Both HTTP and HTTPS are supported
- Failed uploads are logged but don't stop the application
- All three parameters (URL, token, station ID) are required

### Troubleshooting

**401 Unauthorized:** API token is invalid or expired  
**404 Not Found:** Check Wavelog URL (don't include `/index.php/api/qso`)  
**500 Server Error:** Check Wavelog server logs for database or configuration issues  
**Connection timeout:** Verify network connectivity to Wavelog instance

## Development

### Module Overview

- `index.js` - Entry point & CLI parsing
- `lib/UDPServer.js` - UDP server & message routing
- `lib/ProtocolParser.js` - WSJT-X & N1MM protocol parsing
- `lib/ADIFHandler.js` - ADIF parsing & file I/O
- `lib/MQTTClient.js` - MQTT connection & publishing
- `lib/WavelogClient.js` - Wavelog API integration
- `lib/Logger.js` - Console logging with different levels

