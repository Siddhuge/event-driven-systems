/**
 * Smoke test — 1 VU for 30s, verifies the happy path works at all.
 * Run: k6 run --env BASE_URL=http://localhost:3000 --env JWT_TOKEN=<token> load-tests/smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JWT_TOKEN}`
};

export default function () {
  const payload = JSON.stringify({
    customerId: 'smoke-test-user',
    items: [
      { productId: 'prod-001', quantity: 2, price: 29.99 }
    ]
  });

  const res = http.post(`${BASE_URL}/orders`, payload, { headers });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response has orderId': (r) => JSON.parse(r.body).orderId !== undefined,
    'response has CREATED status': (r) => JSON.parse(r.body).status === 'CREATED',
    'response time < 500ms': (r) => r.timings.duration < 500
  });

  sleep(1);
}
