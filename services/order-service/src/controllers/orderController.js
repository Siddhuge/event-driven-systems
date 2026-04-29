// src/controllers/orderController.js
const { v4: uuidv4 } = require("uuid");
const { sendEvent } = require("../kafka/producer");

const createOrder = async (req, res) => {
  try {
    const order = {
      orderId: uuidv4(),
      items: req.body.items,
      status: "CREATED",
      createdAt: new Date()
    };

    await sendEvent("orders", order);

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
};

module.exports = { createOrder };