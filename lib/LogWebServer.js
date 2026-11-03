const http = require('http');
const Logger = require('./Logger');

const MAX_HISTORY = 5000;      // Chunks replayed to a new client (roughly one per log line)
const MAX_CLIENT_BACKLOG = 1024 * 1024; // Bytes queued for a stalled client before dropping it

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UDPLogCollector</title>
<style>
  html, body { margin: 0; background: #111; color: #ddd; }
  pre { margin: 0; padding: 8px; font: 13px/1.4 monospace; white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body>
<pre id="log"></pre>
<script>
  const COLORS = { 31: '#f55', 32: '#5d5', 33: '#dd5', 34: '#68f', 35: '#d6d', 36: '#5dd', 90: '#888' };
  const log = document.getElementById('log');
  const events = new EventSource('events');

  // The server replays its history on every connect, so start over after a reconnect
  events.onopen = () => { log.textContent = ''; };

  events.onmessage = (event) => {
    const atBottom = innerHeight + scrollY >= document.body.scrollHeight - 20;
    // split() with a capture group yields text at even and ANSI color codes at odd positions
    const parts = JSON.parse(event.data).split(/\\x1b\\[([\\d;]*)m/);
    let color = '';
    parts.forEach((part, i) => {
      if (i % 2) {
        color = COLORS[part] || '';
      } else if (part) {
        const span = document.createElement('span');
        span.style.color = color;
        span.textContent = part; // Log lines contain data from UDP packets, never treat as HTML
        log.appendChild(span);
      }
    });
    while (log.childNodes.length > 50000) log.removeChild(log.firstChild);
    if (atBottom) scrollTo(0, document.body.scrollHeight);
  };
</script>
</body>
</html>
`;

class LogWebServer {
  constructor() {
    this.logger = new Logger('LogWebServer');
    this.history = [];
    this.clients = new Set();
    this.server = null;

    // Capture at the stream level so the banner and every console call are mirrored as-is
    for (const stream of [process.stdout, process.stderr]) {
      const write = stream.write;
      stream.write = (chunk, ...rest) => {
        this._broadcast(String(chunk));
        return write.call(stream, chunk, ...rest);
      };
    }
  }

  _broadcast(text) {
    this.history.push(text);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    for (const client of this.clients) {
      if (client.writableLength > MAX_CLIENT_BACKLOG) {
        client.destroy();
      } else {
        client.write(this._toEvent(text));
      }
    }
  }

  _toEvent(text) {
    return `data: ${JSON.stringify(text)}\n\n`;
  }

  _handleRequest(req, res) {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
    } else if (req.url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(this.history.map(this._toEvent).join(''));
      this.clients.add(res);
      res.on('close', () => this.clients.delete(res));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found\n');
    }
  }

  start(port) {
    this.server = http.createServer((req, res) => this._handleRequest(req, res));

    this.server.on('error', (err) => {
      // console.error: must stay visible at the default log level. QSO handling keeps running.
      console.error(`Log web server error: ${err.message}`);
    });

    this.server.listen(port, () => {
      this.logger.success(`Log output available on web port ${this.server.address().port}`);
    });
  }
}

module.exports = LogWebServer;
