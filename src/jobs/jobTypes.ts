/**
 * Job-type registry for the vendor/shop domain (CONVERSATION_ENGINE_DESIGN §4/§7). Data-driven on
 * purpose: each job type declares the slots it must fill before its skill can execute, so the Job
 * engine (jobMachine.ts) pauses/resumes generically. A different industry (a bank) ships a different
 * registry — same engine — which is what makes the registry "data-driven from day one" (§10).
 *
 * Job types map from the commerce intents/flows: order←purchase, fulfillment←fulfillment,
 * recovery←problem. inform/discovery are single-turn (no slots) — they answer and close, but are
 * modelled here so every flow is a Job uniformly.
 */

export interface JobTypeDef {
  /** Stable job type id. */
  id: string;
  /** Required slots, in the order we'd ask for them. Empty ⇒ single-turn (no pause). */
  slots: string[];
  description: string;
}

export const JOB_TYPE_DEFS: JobTypeDef[] = [
  {
    id: 'inform',
    slots: [],
    description: 'answer a relationship/overview question (what do you sell, hours) — single turn',
  },
  {
    id: 'discovery',
    slots: [],
    description: 'pre-purchase product question (availability, price, specs) — single turn',
  },
  {
    id: 'order',
    slots: ['items', 'deliveryAddress', 'paymentMethod'],
    description: 'take an order — needs what to buy, where to deliver, and how to pay',
  },
  {
    id: 'fulfillment',
    slots: ['orderRef'],
    description: 'order status / tracking / address change — needs which order',
  },
  {
    id: 'recovery',
    slots: ['orderRef', 'issue'],
    description: 'service recovery (broken/wrong item, return) — needs which order and what went wrong',
  },
];

export const JOB_TYPE_IDS: string[] = JOB_TYPE_DEFS.map((d) => d.id);

const BY_ID = new Map<string, JobTypeDef>(JOB_TYPE_DEFS.map((d) => [d.id, d]));

export function isJobType(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Required slots for a job type (empty for unknown types — they simply never pause). */
export function requiredSlotsFor(type: string): string[] {
  return BY_ID.get(type)?.slots ?? [];
}
