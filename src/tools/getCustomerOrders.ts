import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

const MAX_ORDERS = 10;

/**
 * Read-only order-history lookup. Tenant-scoped AND customer-scoped by construction: both the
 * tenantId and the customer identity come from the tool context, never from the model's args
 * (ADR-002 / H2). Returns only non-sensitive order fields; payment references / paidAt are
 * deliberately NOT surfaced to the AI (ADR-068 — the AI never reasons about payment state from
 * anything but a gateway-verified read).
 */
export const getCustomerOrders: ToolDefinition = {
  name: 'get_customer_orders',
  description:
    "List the CURRENT customer's recent orders. Read-only — returns order IDs, status, total, and " +
    'tracking number, most recent first. The customer is taken from the conversation, not from you — ' +
    'you cannot look up another person. Never exposes payment details.',
  // No identity arg (H2): the customer is bound from the authenticated conversation, never the model.
  schema: z.object({}),
  execute: async (_args: unknown, { tenantId, customerEmail }) => {
    const { orderRepository } = supportDeps();
    // Fail-closed: without a trusted conversation identity we cannot scope to one customer.
    if (!customerEmail) {
      return { found: 0, orders: [], reason: 'Customer identity not verified for this conversation.' };
    }
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
