/**
 * H2 / ADR-002 — order-level ownership guard.
 *
 * A customer-facing AI tool must NEVER trust a model-supplied identity: the person the AI is
 * chatting with could ask it to look up "jane@x.com"'s orders or "ORD-999". Customer-scoped tools
 * verify the resource belongs to the TRUSTED conversation identity — bound into the tool context
 * from the authenticated ticket, never from tool args — and FAIL-CLOSED when that identity is
 * missing (deny rather than leak another customer's data).
 *
 * Ownership matches on ANY trusted contact key: an email customer by `customerEmail`, a WhatsApp/voice
 * customer by `customerPhone` (orders carry both — slice 2 / I2). Fails closed when neither the order nor
 * the context carries a matching key (see CONVERSATION_DRIVER_ARCHITECTURE §8.13 / I1–I4).
 */
export function ownsOrder(
  order: { customerEmail?: string; customerPhone?: string } | null | undefined,
  ctx: { customerEmail?: string; customerPhone?: string },
): boolean {
  if (!order) return false;
  const emailMatch = Boolean(ctx.customerEmail && order.customerEmail === ctx.customerEmail);
  const phoneMatch = Boolean(ctx.customerPhone && order.customerPhone === ctx.customerPhone);
  return emailMatch || phoneMatch;
}
