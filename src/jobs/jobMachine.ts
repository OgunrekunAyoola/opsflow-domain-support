/**
 * Job state machine — the stateful, multi-turn unit of work the Conversation Engine was missing
 * (CONVERSATION_ENGINE_DESIGN §4). A Job opens, PAUSES when it needs a slot it doesn't have (and the
 * manager asks one question), then RESUMES on the next turn when the customer supplies it — instead
 * of re-triaging from scratch. This is the engine that makes "I want 2 chargers" → "what address?"
 * → "Lekki" one continuing order.
 *
 * Pure + generic: ZERO I/O, no domain knowledge baked in. `requiredSlots` is passed by the caller
 * (from the domain JOB registry — see jobTypes.ts), so the same engine serves any industry.
 *
 * NOTE (slice 1): lives in domain-support for a contained, tested first cut. The `Job` type lifts to
 * @opsflow/contracts when persistence + graph wiring land (slice 2), so platform can store it.
 */

export type JobState = 'active' | 'paused' | 'completed' | 'failed' | 'handed_off';

export interface Job {
  /** Data-driven job type id (e.g. 'order', 'fulfillment') — see JOB_TYPE_DEFS. */
  type: string;
  state: JobState;
  /** Filled inputs. A slot is "filled" when present and non-empty. */
  slots: Record<string, unknown>;
  /** The slot we paused for — non-null iff `state === 'paused'`. */
  awaiting: string | null;
}

const TERMINAL: ReadonlySet<JobState> = new Set<JobState>(['completed', 'failed', 'handed_off']);

export function isTerminal(state: JobState): boolean {
  return TERMINAL.has(state);
}

function filled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== ''; // a blank/whitespace reply isn't an answer
  return true;
}

/** First required slot that isn't filled yet, or null when the job has everything it needs. */
export function nextMissingSlot(job: Job, requiredSlots: readonly string[]): string | null {
  for (const slot of requiredSlots) {
    if (!filled(job.slots[slot])) return slot;
  }
  return null;
}

/** A job is READY (to execute its skill) when no required slot is missing. */
export function isReady(job: Job, requiredSlots: readonly string[]): boolean {
  return !isTerminal(job.state) && nextMissingSlot(job, requiredSlots) === null;
}

/**
 * Reconcile a non-terminal job against its required slots: pause (awaiting the first missing slot)
 * or mark it active+ready (awaiting:null). The single place pause/ready is decided.
 */
export function reconcile(job: Job, requiredSlots: readonly string[]): Job {
  if (isTerminal(job.state)) return job;
  const missing = nextMissingSlot(job, requiredSlots);
  return missing ? { ...job, state: 'paused', awaiting: missing } : { ...job, state: 'active', awaiting: null };
}

/** Open a new job, optionally pre-filling slots extracted from the opening turn. */
export function startJob(type: string, initialSlots: Record<string, unknown> = {}, requiredSlots: readonly string[] = []): Job {
  return reconcile({ type, state: 'active', slots: { ...initialSlots }, awaiting: null }, requiredSlots);
}

/** Fill one slot, then reconcile (may pause for the next missing slot or become ready). */
export function fillSlot(job: Job, slot: string, value: unknown, requiredSlots: readonly string[]): Job {
  return reconcile({ ...job, slots: { ...job.slots, [slot]: value } }, requiredSlots);
}

/**
 * Resume a PAUSED job with the customer's reply: fill the slot it was awaiting, then reconcile.
 * This is the "continuation = resume" path — the next turn supplies what we asked for.
 */
export function resumeWith(job: Job, value: unknown, requiredSlots: readonly string[]): Job {
  if (job.state !== 'paused' || !job.awaiting) {
    throw new Error(`resumeWith: job is not paused/awaiting (state=${job.state}, awaiting=${job.awaiting})`);
  }
  return fillSlot(job, job.awaiting, value, requiredSlots);
}

export function complete(job: Job): Job {
  return { ...job, state: 'completed', awaiting: null };
}
export function fail(job: Job): Job {
  return { ...job, state: 'failed', awaiting: null };
}
export function handOff(job: Job): Job {
  return { ...job, state: 'handed_off', awaiting: null };
}
