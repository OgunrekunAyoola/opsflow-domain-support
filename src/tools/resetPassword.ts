import { z } from 'zod';
import crypto from 'crypto';
import { logger, type ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

export const resetPassword: ToolDefinition = {
  name: 'reset_password',
  description: 'Trigger a password reset email for the current customer',
  // No email arg (H2): the account is the conversation's own customer, never a model-supplied address.
  schema: z.object({}),
  execute: async (_args: unknown, { tenantId, customerEmail }) => {
    const { userRepository, emailService } = supportDeps();
    // Fail-closed: only ever reset the authenticated conversation customer's own password.
    if (!customerEmail)
      return { success: false, message: 'Customer identity not verified for this conversation.' };
    const user = (await userRepository.findByEmail(tenantId, customerEmail)) as any;
    if (!user) return { success: false, message: 'User not found' };

    const token = crypto.randomBytes(20).toString('hex');
    await userRepository.updateById(tenantId, user._id.toString(), {
      $set: { resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 3600000) },
    });

    await emailService
      .send({
        to: customerEmail,
        subject: 'Password Reset Request',
        text: `Your password reset token is: ${token}`,
        html: `<p>Your password reset token is: <strong>${token}</strong></p>`,
      })
      .catch(() => logger.error('Failed to send reset email'));

    return { success: true, message: 'Reset link sent' };
  },
};
