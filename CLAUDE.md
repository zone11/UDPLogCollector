# UDPLogCollector

Node.js bridge that receives QSO data over UDP (WSJT-X binary protocol, N1MM text) and forwards it to an ADIF file, MQTT and Wavelog. User docs are in `README.md` and `USAGE.md`.

## Commands

```bash
npm install
npm test                                  # plain Node scripts using assert, no test framework
node index.js --help
node index.js --web-port 8080 --log-level INFO
```

Tests create a temporary ADIF file and bind a free port, so they can run next to a live instance. A real service usually holds UDP 2237, so use `--port` and `--web-port` with other values for a second instance.

## Structure

- `index.js` - CLI parsing and startup. Options are parsed by hand, there is no argument library.
- `lib/UDPServer.js` - Message pipeline: allow list, then parse, then validate, then outputs.
- `lib/ProtocolParser.js` - WSJT-X and N1MM packet parsing.
- `lib/ADIFHandler.js` - ADIF parsing, `validationError()`, file output.
- `lib/MQTTClient.js`, `lib/WavelogClient.js` - Outputs.
- `lib/Logger.js` - Levels and colors. `success()` and `notice()` print at every level, the others are hidden at the default `NONE`.
- `lib/LogWebServer.js` - Mirrors stdout and stderr to a browser with server-sent events.

## Rules

- Everything in a packet is untrusted. Check it in `validationError()` before it reaches an output, and never put raw field values in a log message. Use `ADIFHandler.escapeForLog()` for raw ADIF.
- A wrongly rejected QSO is lost data, so keep validation permissive and log every rejection with `notice()`. Before tightening a rule, test it on real callsign lists (`MASTER.SCP`, `cty.dat`). Valid calls can end in a digit (`9XB954`), be 3 characters long (`K4X`) or have several `/` parts (`HB9/DL1ABC/P`).
- `parse()` returns converted values: dates as `YYYY-MM-DD`, 6-digit times as `HH:MM:SS`, some fields as numbers. ADIF also allows `HHMM`. Empty fields are valid.
- N1MM packets wrap the ADIF in `COMMAND` and `PARAMETERS` fields. `parseN1MM()` removes them, so they must not reach validation or the outputs.
- The web view must stay a 1:1 copy of the output. Log text only goes into the page through `textContent`.
- Do not send test QSOs to an instance with `--adif`, `--mqtt-broker` or `--wavelog-url` set. They would be saved or uploaded for real.
- Never log `--wavelog-token` or `--mqtt-password`, because the log can be read over the network through the web view.

## Conventions

- Keep dependencies minimal, `mqtt` is the only one. Prefer Node built-ins. Minimum is Node 15 (`net.BlockList`).
- Classes in `lib/` with a `this.logger = new Logger('Name')`, CommonJS, 2-space indent.
- Output failures are logged and must not stop QSO handling.
- New options go in `index.js` (parsing and `--help`) and the options table in `USAGE.md`.
- Work on `dev`, merge to `main` by pull request. Version tags are plain (`0.3.0`).
