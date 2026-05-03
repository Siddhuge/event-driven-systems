const { z } = require('zod');

const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required').max(100),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive').max(1000),
  price: z.number().positive('Price must be positive').max(100000)
});

const CreateOrderSchema = z.object({
  customerId: z.string().min(1).max(100).optional(),
  items: z
    .array(OrderItemSchema)
    .min(1, 'At least one item is required')
    .max(50, 'Maximum 50 items per order')
});

module.exports = { CreateOrderSchema };
