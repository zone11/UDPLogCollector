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

### With Web View and Allowed Sources

```bash
node index.js --web-port 8080 --allow-source 192.168.1.0/24
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
| `--web-port` | Show the log output on a web page at this port | none |
| `--allow-source` | Comma-separated IPv4 addresses or CIDR ranges to accept packets from | loopback and private LAN ranges |
| `--help` | Show help message | - |

## Logging

By default, the application runs in quiet mode (`NONE` log level), showing only the startup banner, important success messages (like "Server listening", "Connected to MQTT", etc.) and rejected QSOs.

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `NONE` | Only success messages and rejected QSOs (default) | Production use, quiet operation |
| `ERROR` | Only errors | Production monitoring |
| `WARN` | Errors and warnings | Production with issue tracking |
| `INFO` | General information | Development, testing |
| `DEBUG` | Detailed debugging information, including packets from senders that are not allowed | Troubleshooting |
| `TRACE` | Very verbose output (includes raw packets) | Deep debugging |

### Examples

```bash
# Quiet mode (default) - only success messages and rejected QSOs
node index.js

# Show errors only
node index.js --log-level ERROR
```

### Web View

When running as a service there is no terminal to watch. With `--web-port`, the same output is available live in a browser, including the startup banner and colors:

```bash
node index.js --web-port 8080 --log-level INFO
```

Then open `http://<host>:8080`. A new page shows the last 5000 log lines and reconnects by itself after a service restart. `--log-level` applies to the web view as well.

**Note:** The web view has no authentication and listens on all network interfaces. Only use it on a trusted network, or restrict the port with a firewall.

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

## Packet Filtering

UDP has no authentication, and logging applications cannot sign their packets. UDPLogCollector therefore limits what it accepts in two ways. This blocks junk and outside traffic, but **a well-formed fake QSO from an allowed address is still accepted**. Addresses can also be spoofed on the same network, so only use it on a trusted network and restrict UDP port 2237 with a firewall.

### Allowed Sources

By default, packets are accepted from loopback and private LAN addresses (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`). `--allow-source` replaces this list:

```bash
# This computer only
node index.js --allow-source 127.0.0.1

# LAN and a VPN such as Tailscale
node index.js --allow-source 192.168.1.0/24,100.64.0.0/10
```

Packets from other addresses are dropped and only logged at `DEBUG`. VPN stations often use addresses outside the default ranges, so if a station's QSOs do not arrive, check this first. The allowed list is shown at startup.

### QSO Validation

| Field | Rule |
|-------|------|
| `CALL` (required) | 3-20 letters, digits and `/`, with at least one letter and one digit |
| `BAND` | ADIF 3.1.4 band name |
| `FREQ` | Positive number |
| `QSO_DATE` | Real date in `YYYYMMDD`, from 1930 |
| `TIME_ON`, `TIME_OFF` | `HHMMSS` or `HHMM` |
| All fields | At most 4096 characters, no control characters except tab and line breaks |

The check covers the format only, it does not confirm that a callsign exists. A rejected QSO is not saved or forwarded. It is always logged with the sender, the reason and its ADIF, so it can be entered by hand if needed.

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
   - API v2 tokens (starting with `wl2_`) are fully supported and need the `qso:write` scope

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
- The API version is detected from the token

### Troubleshooting

**401 Unauthorized:** API token is invalid or expired  
**403 Forbidden:** API v2 token lacks the `qso:write` scope  
**404 Not Found:** Check Wavelog URL (don't include `/index.php/api/qso` or `/index.php/api/v2/qso`)  
**500 Server Error:** Check Wavelog server logs for database or configuration issues  
**Connection timeout:** Verify network connectivity to Wavelog instance

## Development

### Module Overview

- `index.js` - Entry point & CLI parsing
- `lib/UDPServer.js` - UDP server, sender allow list & message routing
- `lib/ProtocolParser.js` - WSJT-X & N1MM protocol parsing
- `lib/ADIFHandler.js` - ADIF parsing, QSO validation & file I/O
- `lib/MQTTClient.js` - MQTT connection & publishing
- `lib/WavelogClient.js` - Wavelog API integration
- `lib/Logger.js` - Console logging with different levels
- `lib/LogWebServer.js` - Web view of the log output
- `test/` - Automated tests

### Tests

```bash
npm test
```

