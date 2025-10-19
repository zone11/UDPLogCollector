# UDPLogCollector (WORK IN PROGRESS)
Simple receiver for UDP QSO Data (WSJT-X, N1MM)

Goal is an universal UDP receiver for logging tools like N1MM, SmartSDR and more to:
- Save QSO in a local ADI file (Simple log collector) ✅
- Send QSO to MQTT broker (Secured!) 
- Send QSO to Wavelog (https://www.wavelog.org)
- Send QSO to Node-Red based station automation
- Send QSO to Sigange solutions (Contest Displays)


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
