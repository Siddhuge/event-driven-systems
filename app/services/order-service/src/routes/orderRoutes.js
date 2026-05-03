const express = require('express');
const { createOrder } = require('../controllers/orderController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { CreateOrderSchema } = require('../validation/orderSchema');

const router = express.Router();

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Create a new order
 *     description: Publishes an order event to Kafka for async inventory processing.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *           example:
 *             customerId: cust-456
 *             items:
 *               - productId: prod-001
 *                 quantity: 2
 *                 price: 29.99
 *     responses:
 *       201:
 *         description: Order created and queued for processing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Missing or invalid JWT token
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticate, validate(CreateOrderSchema), createOrder);

module.exports = router;
