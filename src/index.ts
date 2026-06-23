/**
 * @opsflow/domain-support — the support-industry capability package.
 * Depends on @opsflow/platform + @opsflow/contracts; carries no host code.
 *
 * Tools are domain-owned (ADR-T1, SoC placement rule): the host registers
 * `supportTools` into the platform ToolRegistry and wires the repositories +
 * services the tools run against via `setSupportDeps` at boot.
 */
export { supportTools } from './tools';
export { setSupportDeps, supportDeps } from './deps';
export type { SupportDeps, EmailSender } from './deps';
export * from './policies/taxonomy';
export * from './policies/commerceIntent';
