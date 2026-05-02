// src/app.js
const express = require("express");
const orderRoutes = require("./routes/orderRoutes");
const { isProducerConnected } = require("./kafka/producer");

const app = express();
app.use(express.json());

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/readyz", (req, res) => {
  if (!isProducerConnected()) {
    return res.status(503).json({ status: "not_ready" });
  }

  return res.status(200).json({ status: "ready" });
});

app.use("/orders", orderRoutes);

module.exports = app;
