/**
 * Stress test — drives the system past normal load to exercise retry/DLQ paths.
 * Intentionally sends bursts that exceed rate limits to observe 429 behaviour.
 * Run: k6 run --env BASE_URL=http://localhost:3000 --env JWT_TOKEN=<token> load-tests/stress.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 500 },  // spike — exercises retry
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    // Stress test: we expect some errors; verify system recovers
    http_req_failed: ['rate<0.30'],
    http_req_duration: ['p(95)<3000']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const rateLimitHits = new Counter('rate_limit_hits');
const serverErrors = new Counter('server_errors');

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JWT_TOKEN}`
};

export default function () {
  const payload = JSON.stringify({
    customerId: `stress-user-${__VU}`,
    items: [{ productId: 'stress-prod', quantity: 1, price: 9.99 }]
  });

  const res = http.post(`${BASE_URL}/orders`, payload, { headers });

  if (res.status === 429) rateLimitHits.add(1);
  if (res.status >= 500) serverErrors.add(1);

  check(res, {
    'not a hard crash': (r) => r.status !== 0,
    'acceptable response': (r) => [201, 400, 429].includes(r.status)
  });

  sleep(0.1);
}
