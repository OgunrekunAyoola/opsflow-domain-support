/**
 * H2 / ADR-002 — order-level ownership guard.
 *
 * A customer-facing AI tool must NEVER trust a model-supplied identity: the person the AI is
 * chatting with could ask it to look up "jane@x.com"'s orders or "ORD-999". Customer-scoped tools
 * verify the resource belongs to the TRUSTED conversation identity — bound into the tool context
 * from the authenticated ticket, never from tool args — and FAIL-CLOSED when that identity is
 * missing (deny rather than leak another customer's data).
 *
 * Orders are keyed by `customerEmail` today; a phone-only conversation (no resolved email) therefore
 * fails this check and is denied — the correct safe behaviour until identity resolution maps the
 * channel address to a customer (see CONVERSATION_DRIVER_ARCHITECTURE §8.13 / I1–I4).
 */
export function ownsOrder(
  order: { customerEmail?: string } | null | undefined,
  ctx: { customerEmail?: string },
): boolean {
  return Boolean(order && ctx.customerEmail && order.customerEmail === ctx.customerEmail);
}
