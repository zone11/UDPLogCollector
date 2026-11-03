const assert = require('assert');
const http = require('http');
const LogWebServer = require('../lib/LogWebServer');

function get(port, path) {
  return new Promise((resolve) => http.get({ port, path }, resolve));
}

function readUntil(res, text) {
  return new Promise((resolve) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
      if (body.includes(text)) resolve(body);
    });
  });
}

(async () => {
  const web = new LogWebServer();
  console.log('line before start');
  console.error('<b>line on stderr</b>');
  web.start(0);
  await new Promise((resolve) => web.server.once('listening', resolve));
  const port = web.server.address().port;

  const page = await get(port, '/');
  assert.strictEqual(page.statusCode, 200);
  assert.ok((await readUntil(page, '</html>')).includes("new EventSource('events')"));
  assert.strictEqual((await get(port, '/nope')).statusCode, 404);

  // History is replayed, including stderr and output from before start()
  const events = await get(port, '/events');
  assert.strictEqual(events.headers['content-type'], 'text/event-stream');
  const replay = await readUntil(events, 'line on stderr');
  assert.ok(replay.includes('data: "line before start\\n"\n\n'));

  // New output arrives live
  const live = readUntil(events, 'line after connect');
  console.log('line after connect');
  await live;

  // History stays bounded
  for (let i = 0; i < 6000; i++) web._broadcast('x');
  assert.strictEqual(web.history.length, 5000);

  // Closed clients are forgotten
  assert.strictEqual(web.clients.size, 1);
  events.destroy();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(web.clients.size, 0);

  process.stdout.write('LogWebServer tests passed\n', () => process.exit(0));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
