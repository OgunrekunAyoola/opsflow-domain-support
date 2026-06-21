import { z } from 'zod';
import crypto from 'crypto';
import { logger, type ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

export const refundOrder: ToolDefinition = {
  name: 'refund_order',
  description:
    'Submit a refund review request for a customer order. ' +
    'This does NOT process any payment — it flags the order for human review. ' +
    'A human agent must verify the claim against the payment gateway before any funds move.',
  // humanOnly: true — AI agents may never call this tool.
  // Refunds require human authorization + payment webhook verification (ADR-068).
  humanOnly: true,
  schema: z.object({
    orderId: z.string(),
    reason: z.string(),
  }),
  execute: async (args: unknown, { tenantId, ticketId }) => {
    const { orderRepository } = supportDeps();
    const { orderId, reason } = args as { orderId: string; reason: string };
    const order = (await orderRepository.findByOrderId(tenantId, orderId)) as any;
    if (!order) return { success: false, reason: 'Order not found' };
    if (order.status === 'refunded') return { success: false, reason: 'Already refunded' };
    if (order.status === 'pending_refund')
      return { success: false, reason: 'Refund review already in progress' };

    // Generate a cryptographically secure tracking ID for the review request.
    // This is a REQUEST ID, not a refund confirmation — no funds have moved.
    const reviewId = `RRQ-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const updated = await orderRepository.submitRefundReview(tenantId, orderId, reviewId, reason);
    if (!updated) {
      // Raced with a concurrent request that flagged it first
      return { success: false, reason: 'Refund review already in progress' };
    }

    logger.info(
      `[Action] Refund review submitted — order=${orderId} reviewId=${reviewId} ticket=${ticketId ?? 'none'}`,
    );
    return {
      success: true,
      reviewId,
      message: 'Refund review request submitted. A human agent will verify this against the payment gateway.',
      status: 'pending_human_review',
    };
  },
};
