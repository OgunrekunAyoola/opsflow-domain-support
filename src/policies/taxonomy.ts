/**
 * Support triage taxonomy — the SINGLE SOURCE OF TRUTH for categories and
 * priorities (audit D-O1). Before this, the categories lived in three places
 * that drifted: the prompt template, the eval dataset labels, and nowhere
 * validated. The classifier prompt is rendered from this list, the LLM output is
 * validated against it (out-of-set ⇒ `other`), and the eval reads the same set —
 * so they cannot disagree again.
 *
 * Domain-owned (varies by industry → domains/), per the SoC placement rule.
 */

export interface SupportCategory {
  id: string;
  /** One-line guidance the classifier sees, so the model knows the boundary. */
  description: string;
}

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: 'billing',
    description:
      'invoices, charges, subscriptions, pricing questions (NOT refund requests — those are returns)',
  },
  { id: 'shipping', description: 'delivery, tracking, order status, "where is my order"' },
  { id: 'returns', description: 'returns, exchanges, refund requests, cancellations of an order' },
  {
    id: 'technical',
    description: 'something is broken, errors, bugs, the product/app not working as expected',
  },
  { id: 'account', description: 'login, password reset, profile, access, account settings' },
  {
    id: 'feature_request',
    description: 'asking for a new capability or product change that does not exist yet',
  },
  {
    id: 'general',
    description: 'a genuine support question that fits none of the above but is clearly in scope',
  },
  { id: 'other', description: 'spam, out-of-scope, unintelligible, or not a support request at all' },
];

export const SUPPORT_CATEGORY_IDS: string[] = SUPPORT_CATEGORIES.map((c) => c.id);

/** The fallback category for anything the model returns that is out of the set. */
export const FALLBACK_CATEGORY = 'other';

export type SupportPriority = 'low' | 'medium' | 'high' | 'emergency';
export const PRIORITY_LEVELS: SupportPriority[] = ['low', 'medium', 'high', 'emergency'];

export function isValidCategory(category: unknown): boolean {
  return typeof category === 'string' && SUPPORT_CATEGORY_IDS.includes(category);
}

/**
 * Coerce a model-produced category to a valid taxonomy id. Anything out of the
 * set (a hallucinated label, a synonym, empty) collapses to `other` so the
 * vocabulary stays closed (D-O1 boundary validation).
 */
export function normalizeCategory(category: unknown): string {
  if (typeof category !== 'string') return FALLBACK_CATEGORY;
  const lower = category.trim().toLowerCase();
  return SUPPORT_CATEGORY_IDS.includes(lower) ? lower : FALLBACK_CATEGORY;
}

export function isValidPriority(priority: unknown): boolean {
  return typeof priority === 'string' && (PRIORITY_LEVELS as string[]).includes(priority);
}

/**
 * D-O2: a triage priority of `emergency` is the top escalation tier (score 1000,
 * 2-minute SLA ack in ESCALATION_HANDOFF_DESIGN). `classifyUrgency` in
 * EscalationService maps priority `emergency` → urgency `emergency`; this helper
 * names the contract so the prompt and the escalation path agree on when the
 * emergency tier fires.
 */
export function isEmergencyPriority(priority: unknown): boolean {
  return priority === 'emergency';
}

/** Renders the category list for injection into the classifier prompt. */
export function renderCategoryGuidance(): string {
  return SUPPORT_CATEGORIES.map((c) => `- "${c.id}": ${c.description}`).join('\n');
}

/** The pipe-delimited id set for the JSON-shape hint in the prompt. */
export function renderCategoryEnum(): string {
  return SUPPORT_CATEGORY_IDS.join('|');
}
