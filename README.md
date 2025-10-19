# UDPLogCollector (WORK IN PROGRESS)
Simple receiver for UDP QSO Data (WSJT-X, N1MM)

For now, its a simple solution to receive UDP QSO in the formats N1MM/Log4OM and WSJT-X and store it in a ADIF file.

Goal is an universal UDP receiver for logging tools like N1MM, POLO, SmartSDR etc. to:
- Save QSO in a local file (Simple log collector)
- Send QSO to Wavelog for storage (MAIN function)
- Send QSO to Node-Red based station automation
- Send QSO to Sigange solutions (Contest Displays)
- Send QSO to MQTT broker (Secured!)

```
Usage: node UDPLogParser.js [options]
  
Options:
  --port <number>      UDP port to listen on (default: 2237)
  --adif <path>        Path to ADIF log file (optional)
  -h, --help           Show this help message
  
Examples:
  node UDPLogParser.js
  node UDPLogParser.js --port 12345
  node UDPLogParser.js --port 2237 --adif ./logs/qso.adi
  node UDPLogParser.js --adif ./logs/qso.adi --port 2237
```
