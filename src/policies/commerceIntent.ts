/**
 * Commerce-intent taxonomy — the customer's stage in the buying relationship, the dimension that
 * lets the pipeline route to CONVERT vs RESOLVE vs RECOVER (VENDOR_SUPPORT_DOMAIN_CAPABILITY_MAP).
 * Orthogonal to the support `category` (taxonomy.ts): category = "what topic", intent = "what stage".
 *
 * The vocabulary (the id set) is owned by @opsflow/contracts so every repo agrees; the DESCRIPTIONS
 * (the classifier guidance) are domain-owned and live here. Out-of-set collapses to `noise`.
 */
import { COMMERCE_INTENTS, type CommerceIntent } from '@opsflow/contracts';

export interface CommerceIntentDef {
  id: CommerceIntent;
  /** One-line guidance the classifier sees, so the model knows the boundary. */
  description: string;
}

export const COMMERCE_INTENT_DEFS: CommerceIntentDef[] = [
  {
    id: 'discovery',
    description:
      'pre-purchase browsing — availability, price, specs, colours, "do you have X", "how much", comparisons',
  },
  {
    id: 'purchase',
    description:
      'intent to buy NOW — "I want 2", "how do I pay", "send your account", placing/confirming an order',
  },
  {
    id: 'payment',
    description:
      'a payment or refund matter — "I have paid", "payment failed", "refund me", billing disputes (money)',
  },
  {
    id: 'fulfillment',
    description:
      'after an order exists — order status/tracking, "where is my order", delivery timing, change address',
  },
  {
    id: 'problem',
    description: 'service recovery — broken/wrong/fake item, returns, exchanges, complaints about a purchase',
  },
  {
    id: 'relationship',
    description:
      'greetings, business hours/location/coverage, thanks, reviews, general rapport (no specific ask)',
  },
  { id: 'compliance', description: 'opt-out / unsubscribe / "stop messaging me" / data-deletion requests' },
  {
    id: 'noise',
    description:
      'genuine junk ONLY — spam, gibberish, or not a real request. NOTE: a real product question for ' +
      'something we do not sell (wrong shop) keeps its true intent (usually "discovery"); the separate ' +
      'requestScope="out" flag marks "not us" — never label a real-but-out-of-scope customer as noise.',
  },
];

export const COMMERCE_INTENT_IDS: string[] = COMMERCE_INTENTS.slice();

/** The fallback intent for anything out of the set (hallucinated, synonym, empty). */
export const FALLBACK_COMMERCE_INTENT: CommerceIntent = 'noise';

export function isValidCommerceIntent(intent: unknown): intent is CommerceIntent {
  return typeof intent === 'string' && COMMERCE_INTENT_IDS.includes(intent);
}

/** Coerce a model-produced intent to a valid id; out-of-set collapses to `noise` (closed vocab). */
export function normalizeCommerceIntent(intent: unknown): CommerceIntent {
  if (typeof intent !== 'string') return FALLBACK_COMMERCE_INTENT;
  const lower = intent.trim().toLowerCase();
  return (COMMERCE_INTENT_IDS.includes(lower) ? lower : FALLBACK_COMMERCE_INTENT) as CommerceIntent;
}

/** Renders the intent list for injection into the classifier prompt. */
export function renderCommerceIntentGuidance(): string {
  return COMMERCE_INTENT_DEFS.map((c) => `- "${c.id}": ${c.description}`).join('\n');
}

/** The pipe-delimited id set for the JSON-shape hint in the prompt. */
export function renderCommerceIntentEnum(): string {
  return COMMERCE_INTENT_IDS.join('|');
}
