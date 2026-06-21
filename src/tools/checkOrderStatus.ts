import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

export const checkOrderStatus: ToolDefinition = {
  name: 'check_order_status',
  description: 'Check the status of a customer order by Order ID',
  schema: z.object({
    orderId: z.string().describe('The order ID (e.g., ORD-123)'),
  }),
  execute: async (args: unknown, { tenantId }) => {
    const { orderRepository } = supportDeps();
    const { orderId } = args as { orderId: string };
    const order = await orderRepository.findOne(tenantId, { orderId } as any);
    if (!order) return { status: 'not_found', reason: 'Order not found' };
    return { status: (order as any).status, tracking: (order as any).trackingNumber, total: (order as any).total };
  },
};
