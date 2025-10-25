# UDPLogCollector (WORK IN PROGRESS)
Simple UDP receiver and bridge for QSO data from logging applications like WSJT-X and N1MM Logger+.

UDPLogCollector acts as a centralized hub for amateur radio logging software, receiving QSO data via UDP and distributing it to multiple destinations. The primary use case is multi-operator contest weekends or field day operations where different logging and SDR tools need centralized logging in the background.

## Features

- Save QSOs to local ADIF file (simple log collector) ✅
- Send QSOs to MQTT broker (secured) ✅
- Send QSOs to Wavelog (https://www.wavelog.org) ✅
- Send QSOs to Node-Red based station automation with REST (planned)
- Send QSOs to signage solutions and contest displays (planned)

## Supported Applications

Any logging software or SDR application that supports the UDP protocols from:
- **WSJT-X** (binary protocol) - e.g., WSJT-X, JTDX, JS8Call
- **N1MM Logger+** (text-based ADIF protocol) - e.g., N1MM Logger+, compatible contest loggers

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Support

For issues and questions, please open an issue on GitHub.
