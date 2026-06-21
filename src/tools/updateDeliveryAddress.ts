import { z } from 'zod';
import { logger, type ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

/**
 * Change an order's delivery address — PRE-DISPATCH ONLY. Tenant-scoped from context
 * (ADR-002), repository-backed, idempotent. The authoritative guard is the repo's
 * conditional update (status must still be `pending`); the pre-read here only yields a
 * clearer message. Not humanOnly: this is operational, not money — but it mutates, so
 * it's registered in MUTATING_TOOLS and audited.
 */
export const updateDeliveryAddress: ToolDefinition = {
  name: 'update_delivery_address',
  description:
    "Change the delivery address on a customer's order. Only allowed BEFORE the order " +
    'has shipped — if it has already shipped, this fails and you must tell the customer ' +
    'the address can no longer be changed. Does not touch payment.',
  schema: z.object({
    orderId: z.string().describe('The order ID, e.g. ORD-123'),
    address: z.string().min(5).describe('The new full delivery address'),
  }),
  execute: async (args: unknown, { tenantId, ticketId }) => {
    const { orderRepository } = supportDeps();
    const { orderId, address } = args as { orderId: string; address: string };

    const order = await orderRepository.findByOrderId(tenantId, orderId);
    if (!order) return { success: false, reason: 'Order not found' };

    const status = (order as { status: string }).status;
    if (status !== 'pending') {
      return {
        success: false,
        reason: `The delivery address can no longer be changed — this order is already ${status}.`,
        status,
      };
    }

    const updated = await orderRepository.updateShippingAddress(tenantId, orderId, address);
    if (!updated) {
      // Raced with dispatch between the read and the write — pre-dispatch guard lost.
      return {
        success: false,
        reason: 'The address could not be changed — the order just moved to dispatch.',
      };
    }

    logger.info(`[Action] Delivery address updated — order=${orderId} ticket=${ticketId ?? 'none'}`);
    return { success: true, orderId, shippingAddress: address, message: 'Delivery address updated.' };
  },
};
