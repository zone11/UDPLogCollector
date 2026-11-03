const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ADIFHandler = require('../lib/ADIFHandler');
const UDPServer = require('../lib/UDPServer');

const adif = new ADIFHandler();
const check = (fields) => adif.validationError({ call: 'HB9HJQ', ...fields });

// Unusual but real formats that a stricter rule would wrongly reject
const validCalls = [
  'HB9HJQ', 'K4X', 'H2T', 'D9K', 'C6AFO', '2O12', 'I20000X', 'VE9COAL', 'VX7150', 'ZL30ABC',
  '9XB954', 'CD5846', '4X4AAA', '3DA0RS', '4U1UN', 'GB75RD', 'B0A', 'hb9hjq', 'EA6SX/2',
  'F/G3ABC', 'HB9/DL1ABC/P', 'K9CS/KH8S', 'JG8NQJ/JD1', 'IU1FHJ/ASGE', 'N0CALL/QRP', 'VK100MARCONI/P'
];
for (const call of validCalls) {
  assert.strictEqual(check({ call }), null, `should accept ${call}`);
}

const invalidCalls = [
  '<img src=x onerror=alert(1)><', 'AB', 'A1', 'ABCDEF', '12345', '/HB9HJQ', 'HB9HJQ/', 'HB9//HJQ',
  'HB9 HJQ', 'HB9-HJQ', 'HB9HJQ1234567890ABCDE'
];
for (const call of invalidCalls) {
  assert.strictEqual(check({ call }), 'invalid CALL', `should reject ${call}`);
}
assert.strictEqual(adif.validationError({ band: '20m' }), 'missing CALL');
assert.strictEqual(check({ call: '   ' }), 'missing CALL');

// Optional fields, values as produced by parse()
const parsed = (text) => adif.validationError(adif.parse(text));
assert.strictEqual(parsed('<call:6>HB9HJQ<band:3>20M<freq:6>14.074<qso_date:8>20240229<time_on:6>235959<time_off:4>0000<eor>'), null);
assert.strictEqual(parsed('<call:6>HB9HJQ<band:0><freq:0><qso_date:0><time_on:0><eor>'), null);
assert.strictEqual(check({ band: '21m' }), 'invalid BAND');
assert.strictEqual(parsed('<call:6>HB9HJQ<freq:3>abc<eor>'), 'invalid FREQ');
assert.strictEqual(parsed('<call:6>HB9HJQ<freq:1>0<eor>'), 'invalid FREQ');
assert.strictEqual(parsed('<call:6>HB9HJQ<qso_date:8>20230229<eor>'), 'invalid QSO_DATE');
assert.strictEqual(parsed('<call:6>HB9HJQ<qso_date:8>19291231<eor>'), 'invalid QSO_DATE');
assert.strictEqual(parsed('<call:6>HB9HJQ<time_on:6>246000<eor>'), 'invalid TIME_ON');
assert.strictEqual(parsed('<call:6>HB9HJQ<time_off:4>2360<eor>'), 'invalid TIME_OFF');

// Control characters are rejected, multiline text and other languages are not
assert.strictEqual(check({ band: '\x1b[2J' }), 'control characters in BAND');
assert.strictEqual(check({ comment: 'x\x9b2J' }), 'control characters in COMMENT');
assert.strictEqual(check({ notes: 'line one\r\nline two\tend' }), null);
assert.strictEqual(check({ name: 'Grüezi 日本' }), null);
assert.strictEqual(check({ comment: 'x'.repeat(4097) }), 'COMMENT too long');

// Rejected ADIF can be printed safely
assert.strictEqual(ADIFHandler.escapeForLog('a\x1b[2J\x9bb\n'), 'a\\x1b[2J\\x9bb\\x0a');

// Allow list parsing
for (const bad of ['', 'nope', '1.2.3', '1.2.3.4/33', '1.2.3.4/', '1.2.3.4/x', '1.2.3.4/8/8', '::1']) {
  assert.throws(() => UDPServer.parseAllowList([bad]), /Invalid IPv4/, `should reject "${bad}"`);
}
const custom = UDPServer.parseAllowList(['127.0.0.1', '100.64.0.0/10']);
assert.ok(custom.check('127.0.0.1', 'ipv4') && custom.check('100.100.1.1', 'ipv4'));
assert.ok(!custom.check('127.0.0.2', 'ipv4') && !custom.check('192.168.1.1', 'ipv4'));

// Whole message path: only allowed, valid QSOs reach the outputs
const adifPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'udplog-')), 'qso.adi');
const server = new UDPServer({ port: 1, host: '127.0.0.1', adifPath });
server.port = 0; // Any free port, never collide with a running instance

const warnings = [];
const originalWarn = console.warn;
const originalLog = console.log;
console.warn = (message) => warnings.push(message);
console.log = () => {};
server.start();

const send = (text, address) => server.server.emit('message', Buffer.from(`<command:3>Log<parameters:${text.length}>${text}`), { address, port: 1 });
const qso = (call) => `<call:${call.length}>${call}<band:3>20m<eor>`;

send(qso('N1LAN'), '192.168.1.10');
send(qso('N2LOCAL'), '127.0.0.1');
send(qso('N3PUBLIC'), '8.8.8.8');
send(qso('172.32.0.1'), '172.32.0.1');
send(qso('<script>'), '10.0.0.5');
send('<call:5>N4ESC<band:5>\x1b[2Jx<eor>', '10.0.0.6');

console.warn = originalWarn;
console.log = originalLog;

const written = fs.readFileSync(adifPath, 'utf8');
assert.ok(written.includes('N1LAN') && written.includes('N2LOCAL'));
assert.ok(!written.includes('N3PUBLIC') && !written.includes('script') && !written.includes('N4ESC'));

// N1MM's command wrapper stays out of the output, leaving one record per QSO
assert.ok(!/COMMAND|PARAMETERS/i.test(written));
assert.strictEqual((written.match(/<EOR>/gi) || []).length, 2);

// Rejections are visible at the default log level, drops from outside are not
assert.strictEqual(warnings.length, 2);
assert.ok(warnings[0].includes('Rejected QSO from 10.0.0.5: invalid CALL') && warnings[0].includes('<script>'));
assert.ok(warnings[1].includes('control characters in BAND') && warnings[1].includes('\\x1b'));
assert.ok(warnings.every((message) => !message.slice(10).includes('\x1b[2J')));

server.server.on('listening', () => {
  server.stop();
  fs.rmSync(path.dirname(adifPath), { recursive: true });
  console.log('QSOValidation tests passed');
});
