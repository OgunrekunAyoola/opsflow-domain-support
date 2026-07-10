import {
  startJob,
  fillSlot,
  resumeWith,
  reconcile,
  nextMissingSlot,
  isReady,
  isTerminal,
  complete,
  fail,
  handOff,
  requiredSlotsFor,
  isJobType,
  JOB_TYPE_IDS,
} from '../jobs';

describe('Job machine — stateful multi-turn slot filling', () => {
  const orderSlots = requiredSlotsFor('order'); // ['items','deliveryAddress','paymentMethod']

  it('THE multi-turn order: open → pause(address) → resume(Lekki) → pause(pay) → resume(card) → ready', () => {
    // Turn 1: "I want 2 chargers" — opens the order with the items slot pre-filled.
    let job = startJob('order', { items: '2 chargers' }, orderSlots);
    expect(job.state).toBe('paused');
    expect(job.awaiting).toBe('deliveryAddress'); // → asks "what address?"

    // Turn 2: "Lekki" — resumes, fills the address, pauses for payment.
    job = resumeWith(job, 'Lekki', orderSlots);
    expect(job.state).toBe('paused');
    expect(job.awaiting).toBe('paymentMethod'); // → asks "pay how?"
    expect(job.slots.deliveryAddress).toBe('Lekki');

    // Turn 3: "card" — resumes, fills payment, now READY for the skill to place the order.
    job = resumeWith(job, 'card', orderSlots);
    expect(job.state).toBe('active');
    expect(job.awaiting).toBeNull();
    expect(isReady(job, orderSlots)).toBe(true);
    expect(job.slots).toEqual({ items: '2 chargers', deliveryAddress: 'Lekki', paymentMethod: 'card' });
  });

  it('startJob with all slots present → ready immediately (no pause)', () => {
    const job = startJob('order', { items: 'x', deliveryAddress: 'y', paymentMethod: 'z' }, orderSlots);
    expect(job.state).toBe('active');
    expect(job.awaiting).toBeNull();
    expect(isReady(job, orderSlots)).toBe(true);
  });

  it('single-turn job types (inform/discovery) have no slots → ready at once', () => {
    const job = startJob('inform', {}, requiredSlotsFor('inform'));
    expect(job.state).toBe('active');
    expect(job.awaiting).toBeNull();
    expect(requiredSlotsFor('inform')).toEqual([]);
  });

  it('empty / blank slot values do not count as filled (re-pauses)', () => {
    let job = startJob('fulfillment', {}, requiredSlotsFor('fulfillment')); // needs orderRef
    expect(job.awaiting).toBe('orderRef');
    job = fillSlot(job, 'orderRef', '   ', requiredSlotsFor('fulfillment')); // blank
    expect(nextMissingSlot(job, requiredSlotsFor('fulfillment'))).toBe('orderRef');
    expect(job.state).toBe('paused');
  });

  it('resumeWith throws when the job is not paused/awaiting', () => {
    const ready = startJob('order', { items: 'x', deliveryAddress: 'y', paymentMethod: 'z' }, orderSlots);
    expect(() => resumeWith(ready, 'oops', orderSlots)).toThrow(/not paused/);
  });

  it('terminal transitions are terminal; reconcile is a no-op on them', () => {
    const ready = startJob('order', { items: 'x', deliveryAddress: 'y', paymentMethod: 'z' }, orderSlots);
    const done = complete(ready);
    expect(done.state).toBe('completed');
    expect(isTerminal(done.state)).toBe(true);
    expect(reconcile(done, orderSlots)).toEqual(done); // unchanged
    expect(fail(ready).state).toBe('failed');
    expect(handOff(ready).state).toBe('handed_off');
  });

  it('registry is data-driven + guarded', () => {
    expect(JOB_TYPE_IDS).toEqual(
      expect.arrayContaining(['inform', 'discovery', 'order', 'fulfillment', 'recovery']),
    );
    expect(isJobType('order')).toBe(true);
    expect(isJobType('nope')).toBe(false);
    expect(requiredSlotsFor('unknown-type')).toEqual([]); // unknown ⇒ never pauses
  });
});
