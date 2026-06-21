import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

const MAX_ORDERS = 10;

/**
 * Read-only order-history lookup. Tenant-scoped by construction (tenantId comes
 * from the tool context, never from the model's args — ADR-002). Returns only
 * non-sensitive order fields; payment references / paidAt are deliberately NOT
 * surfaced to the AI (ADR-068 — the AI never reasons about payment state from
 * anything but a gateway-verified read).
 */
export const getCustomerOrders: ToolDefinition = {
  name: 'get_customer_orders',
  description:
    "List a customer's recent orders by their email address. Read-only — returns " +
    'order IDs, status, total, and tracking number, most recent first. Use this to ' +
    'see a customer\'s order history. Does not modify anything and never exposes payment details.',
  schema: z.object({
    customerEmail: z.string().email().describe('The customer email address on the order'),
  }),
  execute: async (args: unknown, { tenantId }) => {
    const { orderRepository } = supportDeps();
    const { customerEmail } = args as { customerEmail: string };
    const orders = await orderRepository.findByCustomerEmail(tenantId, customerEmail);
    if (!orders.length) return { found: 0, orders: [] };

    const recent = [...orders]
      .sort(
        (a, b) =>
          new Date((b as { createdAt?: Date }).createdAt ?? 0).getTime() -
          new Date((a as { createdAt?: Date }).createdAt ?? 0).getTime(),
      )
      .slice(0, MAX_ORDERS)
      .map((o) => {
        const order = o as { orderId: string; status: string; total: number; trackingNumber?: string };
        return {
          orderId: order.orderId,
          status: order.status,
          total: order.total,
          tracking: order.trackingNumber ?? null,
        };
      });

    return { found: recent.length, orders: recent };
  },
};
