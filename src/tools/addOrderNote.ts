import { z } from 'zod';
import { logger, type ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';
import { ownsOrder } from './ownership';

/**
 * Append an internal note to an order (team-visible, never shown to the customer).
 * Tenant-scoped from context (ADR-002), repository-backed. Mutating but low-risk —
 * registered in MUTATING_TOOLS and audited; never touches status or payment.
 */
export const addOrderNote: ToolDefinition = {
  name: 'add_order_note',
  description:
    'Add an internal note to an order — visible to your team, never to the customer. ' +
    'Use it to record context for the next agent (what the customer asked, what you ' +
    'checked, what you promised). Does not change order status or payment.',
  schema: z.object({
    orderId: z.string().describe('The order ID, e.g. ORD-123'),
    note: z.string().min(1).describe('The internal note to record'),
  }),
  execute: async (args: unknown, { tenantId, ticketId, customerEmail, customerPhone }) => {
    const { orderRepository } = supportDeps();
    const { orderId, note } = args as { orderId: string; note: string };

    // H2 / ADR-002: verify the order belongs to this conversation's customer before mutating.
    const order = (await orderRepository.findByOrderId(tenantId, orderId)) as {
      customerEmail?: string;
      customerPhone?: string;
    } | null;
    if (!order || !ownsOrder(order, { customerEmail, customerPhone }))
      return { success: false, reason: 'Order not found' };

    const updated = await orderRepository.addNote(tenantId, orderId, note);
    if (!updated) return { success: false, reason: 'Order not found' };

    logger.info(`[Action] Order note added — order=${orderId} ticket=${ticketId ?? 'none'}`);
    return { success: true, orderId, message: 'Note added to the order.' };
  },
};
