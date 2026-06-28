import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';
import { ownsOrder } from './ownership';

/**
 * Generate a customer payment link for an existing UNPAID order (CONVERSION_CAPABILITY_DESIGN).
 * Tenant-scoped (ADR-002). It NEVER confirms or records payment — only the processor webhook
 * (confirmPaymentByReference) marks an order paid (ADR-068) — so it is NOT humanOnly and not a
 * mutating tool on our state. If no payment provider is wired it FAIL-CLOSES to a clear
 * "a human will share payment details" message (graceful degrade).
 */
export const paymentLink: ToolDefinition = {
  name: 'payment_link',
  description:
    'Generate a secure payment link for an existing unpaid order so the customer can pay. Use it ' +
    'after create_order. Returns a URL to share. Does NOT confirm payment (only the bank/processor ' +
    'webhook does). If payment links are not set up, it says a human will share payment details.',
  schema: z.object({
    orderId: z.string().min(1).describe('The order ID to collect payment for, e.g. ORD-ABC123'),
  }),
  execute: async (args: unknown, { tenantId, customerEmail }) => {
    const { orderRepository, paymentLinkProvider } = supportDeps();
    const { orderId } = args as { orderId: string };

    const order = (await orderRepository.findByOrderId(tenantId, orderId)) as {
      total: number;
      customerEmail: string;
      paidAt?: Date;
    } | null;
    // H2 / ADR-002: only issue a payment link for THIS customer's order. Fail-closed.
    if (!order || !ownsOrder(order, { customerEmail }))
      return { success: false, reason: `Order "${orderId}" not found.` };
    if (order.paidAt) return { success: false, reason: `Order "${orderId}" is already paid.` };

    if (!paymentLinkProvider) {
      // Fail-closed graceful: no provider wired → don't fake it; hand off to a human.
      return {
        success: false,
        needsHuman: true,
        reason: 'Payment links are not set up for this store yet — a human will share payment details.',
      };
    }

    const link = await paymentLinkProvider.createLink({
      orderId,
      amount: order.total,
      customerEmail: order.customerEmail,
    });
    return { success: true, orderId, amount: order.total, paymentUrl: link.url, reference: link.reference };
  },
};
