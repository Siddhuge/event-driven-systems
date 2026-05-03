const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Order Service API',
      version: '1.0.0',
      description: 'Event-driven order processing API. Orders are published to Kafka for async inventory processing with automatic retry and dead-letter queue handling.'
    },
    servers: [
      { url: process.env.API_BASE_URL || 'http://localhost:3000', description: 'Current server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        OrderItem: {
          type: 'object',
          required: ['productId', 'quantity', 'price'],
          properties: {
            productId: { type: 'string', example: 'prod-123' },
            quantity: { type: 'integer', minimum: 1, maximum: 1000, example: 2 },
            price: { type: 'number', minimum: 0.01, example: 29.99 }
          }
        },
        CreateOrderRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            customerId: { type: 'string', example: 'cust-456' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
              minItems: 1,
              maxItems: 50
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            orderId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            customerId: { type: 'string', example: 'cust-456' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            status: { type: 'string', enum: ['CREATED'], example: 'CREATED' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
