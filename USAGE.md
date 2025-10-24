## Installation

```bash
npm install
```

## Usage

### Basic Usage

```bash
node index.js
```

### With ADIF Logging

```bash
node index.js --port 2237 --adif ./logs/qso.adi
```

### With MQTT (Unencrypted)

```bash
node index.js --mqtt-broker mqtt://broker.hivemq.com:1883 --mqtt-topic ham/qso
```

### With MQTT (Encrypted + Auth)

```bash
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

### Full Configuration

```bash
node index.js \
  --port 2237 \
  --adif ./logs/qso.adi \
  --mqtt-broker mqtt://localhost:1883 \
  --mqtt-topic qso/log \
  --wavelog-url https://log.example.com \
  --wavelog-token YOUR_API_KEY \
  --wavelog-stationid 1
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--port` | `-p` | UDP port to listen on | 2237 |
| `--adif` | `-a` | Path to ADIF log file | none |
| `--mqtt-broker` | - | MQTT broker URL (mqtt://host:port or mqtts://host:port) | none |
| `--mqtt-topic` | - | MQTT topic | qso/log |
| `--mqtt-username` | - | MQTT username | none |
| `--mqtt-password` | - | MQTT password | none |
| `--wavelog-url` | - | Wavelog instance URL | none |
| `--wavelog-token` | - | Wavelog API token | none |
| `--wavelog-stationid` | - | Wavelog station profile ID | none |
| `--help` | `-h` | Show help message | - |

**Note:** The MQTT broker URL must include the protocol (`mqtt://` for unencrypted or `mqtts://` for encrypted connections). If no protocol is specified, `mqtt://` is assumed for backwards compatibility.

**Note:** For Wavelog integration, all three parameters (URL, token, and station ID) are required. The station profile ID can be found in the URL when editing a station profile in Wavelog.

## Project Structure

```
UDPLogParser/
├── index.js              # Entry point & CLI parsing
├── lib/
│   ├── UDPServer.js      # UDP server & message routing
│   ├── ProtocolParser.js # WSJT-X & N1MM protocol parsing
│   ├── ADIFHandler.js    # ADIF parsing & file I/O
│   ├── MQTTClient.js     # MQTT connection & publishing
│   └── WavelogClient.js  # Wavelog API integration
├── package.json
└── README.md
```

## Configuration in WSJT-X / N1MM

### WSJT-X
1. Go to **File → Settings → Reporting**
2. Enable **UDP Server**
3. Set **UDP Server Port** to `2237`
4. Set **UDP Server** to `localhost` or `127.0.0.1`

### N1MM Logger+
1. Go to **Config → Configure Ports, Mode Control...**
2. Enable **Broadcast Data**
3. Set port to `2237`

## QSO Data Format

JSON output includes:

```json
{
  "call": "DL1TEST",
  "qso_date": "2025-10-18",
  "time_on": "15:17:06",
  "time_off": "15:17:06",
  "band": "20M",
  "freq": 14.075,
  "mode": "FT8",
  "rst_sent": -1,
  "rst_rcvd": -2,
  "tx_pwr": 100,
  "comment": "UDP test submission",
  "sota_ref": "HB/SG-001",
  "pota_ref": "HB-0123",
  "wwff_ref": "HBFF-0001"
}
```

Optional fields (`sota_ref`, `pota_ref`, `wwff_ref`) are only included if present.

## MQTT Publishing

When MQTT is configured, each QSO is published as JSON to the specified topic with:
- **QoS**: 1 (at least once delivery)
- **Retain**: false
- **Payload**: Complete QSO data in JSON format
- **Protocol**: Automatically detected from broker URL (`mqtt://` or `mqtts://`)

## Development

### Module Overview

#### `ProtocolParser.js`
Handles binary protocol parsing for WSJT-X and N1MM Logger+.

**Methods:**
- `parse(buffer)` - Auto-detects and parses incoming UDP packets
- `parseWSJTX(buffer)` - Parses WSJT-X binary protocol
- `parseN1MM(buffer)` - Parses N1MM text-based protocol

#### `ADIFHandler.js`
Manages ADIF parsing, conversion, and file operations.

**Methods:**
- `parse(adifString)` - Converts ADIF string to JSON
- `toADIF(qsoData, format)` - Converts JSON to ADIF format ('file' or 'api')
- `initializeFile()` - Creates ADIF file with header
- `append(qsoData)` - Appends QSO to file

#### `MQTTClient.js`
Handles MQTT connection and publishing.

**Methods:**
- `connect()` - Establishes MQTT connection (protocol auto-detected from URL)
- `publish(qsoData)` - Publishes QSO to MQTT topic
- `disconnect()` - Closes MQTT connection

#### `WavelogClient.js`
Handles Wavelog API integration.

**Methods:**
- `upload(qsoData)` - Uploads QSO to Wavelog instance (uses ADIFHandler for conversion)
- `validateConfig()` - Validates configuration parameters

#### `UDPServer.js`
Orchestrates all components and handles UDP communication.

**Methods:**
- `start()` - Starts UDP server and initializes handlers
- `stop()` - Gracefully shuts down all connections