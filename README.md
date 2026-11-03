# UDPLogCollector
Simple UDP receiver and bridge for QSO data from logging applications like WSJT-X and N1MM Logger+.

UDPLogCollector acts as a centralized hub for amateur radio logging software, receiving QSO data via UDP and distributing it to multiple destinations. The primary use case is multi-operator contest weekends or field day operations where different logging and SDR tools need centralized logging in the background.

![alt text](images/terminal_logging.png)

## Features

- Save QSOs to local ADIF file (simple log collector) ✅
- Send QSOs to MQTT broker (secured) ✅
- Send QSOs to [Wavelog](https://www.wavelog.org) ✅
- View the log output live in a browser, e.g. when running as a service ✅
- Filter packets by sender and validate QSOs before they are saved or forwarded ✅
- Send QSOs to a database (SQLite, MySQL/MariaDB) (planned)
- Send QSOs to REST API (Node-RED) (planned)

## Installation

### Requirements
- **Node.js** >= 15.0.0
- **npm** (included with Node.js)

### Optional requirements for publishing
- **MQTT Broker** - For MQTT publishing (e.g., Mosquitto, HiveMQ, EMQX)
- **Wavelog Instance** - For Wavelog integration (self-hosted or club/cloud)
  - Wavelog API token (v1 keys and v2 tokens are supported)
  - Station profile ID

### Installation Steps
1. **Clone or download the repository**  
   Open a terminal in the project directory (where `package.json` is located).
2. **Install dependencies**  
   This step is mandatory before running the application:
   
    ```bash
    npm install
    ```
3. **Run UDPLogCollector**  
   First, start with no options:
   
    ```bash
    node index.js
    ```

For detailed usage and configuration options, see [USAGE.md](USAGE.md).

## Security

UDP has no authentication, so a well-formed fake QSO from an allowed address cannot be detected. The web log view has no login either. Only run UDPLogCollector on a trusted network and restrict its ports with a firewall. See [Packet Filtering](USAGE.md#packet-filtering) for what is checked.

## Supported applications

Any logging software or SDR application that supports the UDP protocols from:
- **WSJT-X** (binary protocol) - e.g., WSJT-X, JTDX, JS8Call
- **N1MM Logger+** (text-based ADIF protocol) - e.g., N1MM Logger+, compatible contest loggers

### Other tested applications
- SmartSDR for Mac
- RUMLogNG
- MacLoggerDX

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Support

For issues and questions, please open an issue on GitHub.
