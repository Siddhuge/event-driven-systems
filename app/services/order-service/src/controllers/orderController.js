const { v4: uuidv4 } = require('uuid');
const { sendEvent } = require('../kafka/producer');
const { ordersCreatedTotal, orderCreationDuration, kafkaProduceErrorsTotal } = require('../metrics');

const createOrder = async (req, res) => {
  const { items, customerId } = req.validatedBody;
  const timer = orderCreationDuration.startTimer();

  const resolvedCustomerId = customerId || req.user?.sub;
  if (!resolvedCustomerId) {
    timer({ status: 'rejected' });
    return res.status(401).json({ error: 'Authenticated user or customerId required' });
  }

  try {
    const order = {
      orderId: uuidv4(),
      customerId: resolvedCustomerId,
      items,
      status: 'CREATED',
      createdAt: new Date().toISOString()
    };

    await sendEvent('orders', order);

    ordersCreatedTotal.inc({ status: 'success' });
    timer({ status: 'success' });
    req.log.info({ orderId: order.orderId, itemCount: items.length }, 'Order created');

    res.status(201).json(order);
  } catch (err) {
    kafkaProduceErrorsTotal.inc();
    ordersCreatedTotal.inc({ status: 'error' });
    timer({ status: 'error' });
    req.log.error({ error: err.message }, 'Order creation failed');
    res.status(500).json({ error: 'Order creation failed' });
  }
};

module.exports = { createOrder };
