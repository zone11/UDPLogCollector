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

## Wavelog Publishing

When Wavelog is configured, each QSO is automatically uploaded to your Wavelog instance via the REST API.

### Requirements
- Wavelog instance URL (e.g., `https://log.example.com`)
- API token (generated in Wavelog settings)
- Station profile ID (found in Wavelog station profile URL)

### Configuration

1. **Get your API token:**
   - Log into your Wavelog instance
   - Go to **Account → API** or **Settings → API**
   - Generate a new API token if you don't have one

2. **Find your station profile ID:**
   - Go to **Station Profiles**
   - Edit the station profile you want to use
   - The ID is visible in the URL: `https://log.example.com/index.php/station/edit/1` (ID = 1)

3. **Start UDPLogCollector with Wavelog:**
   ```bash
   node index.js \
     --wavelog-url https://log.example.com \
     --wavelog-token YOUR_API_TOKEN \
     --wavelog-stationid 1
   ```

### Features
- **Automatic upload**: QSOs are uploaded immediately after being logged
- **HTTPS support**: Both HTTP and HTTPS Wavelog instances are supported
- **Timeout protection**: 30-second timeout prevents hanging requests
- **Error handling**: Failed uploads are logged but don't stop the application
- **ADIF format**: QSOs are converted to ADIF format before uploading

### API Details
- **Endpoint**: `/index.php/api/qso`
- **Method**: POST
- **Format**: JSON with ADIF string
- **Timeout**: 30 seconds
- **Protocol**: HTTP or HTTPS (automatically detected from URL)

### Example Configuration
```bash
# Upload to Wavelog and also save to local ADIF file
node index.js \
  --adif ./logs/qso.adi \
  --wavelog-url https://wavelog.example.com \
  --wavelog-token abc123def456 \
  --wavelog-stationid 1
```

### Troubleshooting
- **401 Unauthorized**: Check your API token is correct
- **404 Not Found**: Verify the Wavelog URL is correct (should not include `/index.php/api/qso`)
- **Timeout errors**: Check network connection to your Wavelog instance
- **Invalid station ID**: Ensure the station profile ID exists in your Wavelog instance