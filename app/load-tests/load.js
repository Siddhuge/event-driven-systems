/**
 * Load test — ramp to 50 VUs over 5 minutes, validates SLO targets.
 * Run: k6 run --env BASE_URL=https://orders.example.com --env JWT_TOKEN=<token> load-tests/load.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // ramp up
    { duration: '3m', target: 50 },  // sustain
    { duration: '1m', target: 0 }    // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% error rate
    http_req_duration: ['p(95)<800', 'p(99)<1500'],  // SLO latency targets
    order_creation_success_rate: ['rate>0.99']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const orderSuccessRate = new Rate('order_creation_success_rate');
const orderDuration = new Trend('order_creation_duration', true);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JWT_TOKEN}`
};

const PRODUCTS = ['prod-001', 'prod-002', 'prod-003', 'prod-004'];

export default function () {
  const itemCount = Math.floor(Math.random() * 3) + 1;
  const items = Array.from({ length: itemCount }, (_, i) => ({
    productId: PRODUCTS[i % PRODUCTS.length],
    quantity: Math.floor(Math.random() * 5) + 1,
    price: parseFloat((Math.random() * 100 + 1).toFixed(2))
  }));

  const payload = JSON.stringify({
    customerId: `load-test-user-${__VU}`,
    items
  });

  const res = http.post(`${BASE_URL}/orders`, payload, { headers });

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'response has orderId': (r) => {
      try { return JSON.parse(r.body).orderId !== undefined; } catch { return false; }
    }
  });

  orderSuccessRate.add(success);
  orderDuration.add(res.timings.duration);

  sleep(Math.random() * 0.5 + 0.5); // 0.5–1s think time
}
