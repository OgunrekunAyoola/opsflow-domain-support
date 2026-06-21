import { z } from 'zod';
import { logger, type ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

export const escalateTicket: ToolDefinition = {
  name: 'escalate_ticket',
  description: 'Escalate the current ticket to high priority and add an internal note.',
  schema: z.object({
    reason: z.string().describe('The reason for escalation'),
  }),
  execute: async (args: unknown, { tenantId, ticketId, userId }) => {
    const { ticketRepository, ticketReplyRepository } = supportDeps();
    const { reason } = args as { reason: string };
    if (!ticketId || !tenantId) {
      throw new Error('Missing ticketId or tenantId context for escalation');
    }

    logger.info(`[Action] Escalating ticket ${ticketId}`);

    // 1. Update Ticket Priority
    await ticketRepository.updateById(tenantId, ticketId, {
      $set: { priority: 'urgent', status: 'triaged' },
    });

    // 2. Add Internal Note
    await ticketReplyRepository.addReply(tenantId, {
      ticketId: ticketId as any,
      authorType: 'ai',
      authorId: userId as any,
      body: `[Escalation] Ticket escalated by AI.\nReason: ${reason}`,
      isInternalNote: true,
      type: 'note',
    } as any);

    return { success: true, message: 'Ticket escalated to high priority' };
  },
};
