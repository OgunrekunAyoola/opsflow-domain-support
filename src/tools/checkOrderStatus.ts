import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';
import { ownsOrder } from './ownership';

export const checkOrderStatus: ToolDefinition = {
  name: 'check_order_status',
  description: "Check the status of the current customer's order by its Order ID",
  schema: z.object({
    orderId: z.string().describe('The order ID (e.g., ORD-123)'),
  }),
  execute: async (args: unknown, { tenantId, customerEmail }) => {
    const { orderRepository } = supportDeps();
    const { orderId } = args as { orderId: string };
    const order = (await orderRepository.findOne(tenantId, { orderId } as any)) as {
      status?: string;
      trackingNumber?: string;
      total?: number;
      customerEmail?: string;
    } | null;
    // H2 / ADR-002: only surface the order if it belongs to THIS conversation's customer.
    // Fail-closed (don't reveal existence) when identity is missing or doesn't match.
    if (!order || !ownsOrder(order, { customerEmail }))
      return { status: 'not_found', reason: 'Order not found' };
    return {
      status: order.status,
      tracking: order.trackingNumber,
      total: order.total,
    };
  },
};
