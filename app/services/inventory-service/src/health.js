const http = require('http');
const logger = require('./logger');
const { register } = require('./metrics');

const state = { kafka: false, rabbit: false, redis: false };

const setReady = (key, value) => { state[key] = value; };

const isReady = () => Object.values(state).every(Boolean);

const startHealthServer = (port = 8080) => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'alive' }));
    } else if (req.url === '/readyz') {
      const ready = isReady();
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready', connections: { ...state } }));
    } else if (req.url === '/metrics') {
      try {
        res.writeHead(200, { 'Content-Type': register.contentType });
        res.end(await register.metrics());
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    logger.info({ port }, 'Health server listening');
  });

  return server;
};

module.exports = { startHealthServer, setReady };
