const { randomUUID } = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../logger');

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, _res, err) => `${req.method} ${req.url} - ${err.message}`,
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, remoteAddress: req.remoteAddress };
    }
  }
});

module.exports = httpLogger;
