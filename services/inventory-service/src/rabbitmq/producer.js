const amqp = require("amqplib");

let channel;

const connectRabbit = async () => {
    const conn = await amqp.connect("amqp://localhost");
    channel = await conn.createChannel();

    await channel.assertQueue("retry_queue", {
        durable: true,
        arguments: {
            "x-message-ttl": 5000,
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "retry_processed"
        }
    });

    await channel.assertQueue("retry_processed", {
        durable: true
    });
}

const sendToRetryQueue = async (message, delay = 5000) => {
    channel.sendToQueue(
        "retry_queue",
        Buffer.from(JSON.stringify(message)),
        {
            headers: { "x-delay": delay }
        }
    );
};

module.exports = { connectRabbit, sendToRetryQueue };