import { z } from 'zod';
import crypto from 'crypto';
import { logger, type ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

export const resetPassword: ToolDefinition = {
  name: 'reset_password',
  description: 'Trigger a password reset email for a user',
  schema: z.object({
    email: z.string().email(),
  }),
  execute: async (args: unknown, { tenantId }) => {
    const { userRepository, emailService } = supportDeps();
    const { email } = args as { email: string };
    const user = (await userRepository.findByEmail(tenantId, email)) as any;
    if (!user) return { success: false, message: 'User not found' };

    const token = crypto.randomBytes(20).toString('hex');
    await userRepository.updateById(tenantId, user._id.toString(), {
      $set: { resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 3600000) },
    });

    await emailService
      .send({
        to: email,
        subject: 'Password Reset Request',
        text: `Your password reset token is: ${token}`,
        html: `<p>Your password reset token is: <strong>${token}</strong></p>`,
      })
      .catch(() => logger.error('Failed to send reset email'));

    return { success: true, message: 'Reset link sent' };
  },
};
