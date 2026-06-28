/**
 * payment_link tool — generate a pay link for an unpaid order. Never confirms payment (ADR-068).
 * Graceful-degrades to "a human will share payment details" when no provider is wired.
 */
import { setSupportDeps } from '../deps';
import { paymentLink } from '../tools/paymentLink';

const findByOrderId = jest.fn();
const createLink = jest.fn();

function wire(withProvider: boolean) {
  setSupportDeps({
    orderRepository: { findByOrderId } as any,
    productCatalogRepository: {} as any,
    userRepository: {} as any,
    ticketRepository: {} as any,
    ticketReplyRepository: {} as any,
    emailService: {} as any,
    ...(withProvider ? { paymentLinkProvider: { createLink } } : {}),
  });
}

const ctx = { tenantId: 'aaaaaaaaaaaaaaaaaaaaaaaa', ticketId: 'tk1', customerEmail: 'c@x.com' };

describe('payment_link tool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates a link when a provider is wired', async () => {
    wire(true);
    findByOrderId.mockResolvedValue({ total: 370000, customerEmail: 'c@x.com' });
    createLink.mockResolvedValue({ url: 'https://pay/x', reference: 'ORD-X' });

    const out: any = await paymentLink.execute({ orderId: 'ORD-X' }, ctx);

    expect(out.success).toBe(true);
    expect(out.paymentUrl).toBe('https://pay/x');
    expect(out.amount).toBe(370000);
    expect(createLink).toHaveBeenCalledWith({ orderId: 'ORD-X', amount: 370000, customerEmail: 'c@x.com' });
  });

  it('fail-closes gracefully (needsHuman) when no provider is wired', async () => {
    wire(false);
    findByOrderId.mockResolvedValue({ total: 1, customerEmail: 'c@x.com' });
    const out: any = await paymentLink.execute({ orderId: 'ORD-X' }, ctx);
    expect(out.success).toBe(false);
    expect(out.needsHuman).toBe(true);
  });

  it('soft-fails when the order is not found', async () => {
    wire(true);
    findByOrderId.mockResolvedValue(null);
    const out: any = await paymentLink.execute({ orderId: 'NOPE' }, ctx);
    expect(out.success).toBe(false);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('refuses an already-paid order (never re-collects)', async () => {
    wire(true);
    findByOrderId.mockResolvedValue({ total: 1, customerEmail: 'c@x.com', paidAt: new Date() });
    const out: any = await paymentLink.execute({ orderId: 'ORD-X' }, ctx);
    expect(out.success).toBe(false);
    expect(out.reason).toContain('already paid');
    expect(createLink).not.toHaveBeenCalled();
  });

  // H2 / ADR-002 — ownership: never issue a link for an order the conversation customer does not own.
  it('denies an order belonging to a different customer (no cross-customer leak)', async () => {
    wire(true);
    findByOrderId.mockResolvedValue({ total: 1, customerEmail: 'someone-else@x.com' });
    const out: any = await paymentLink.execute({ orderId: 'ORD-X' }, ctx);
    expect(out.success).toBe(false);
    expect(out.reason).toContain('not found');
    expect(createLink).not.toHaveBeenCalled();
  });

  it('fail-closes when the conversation has no trusted customer identity', async () => {
    wire(true);
    findByOrderId.mockResolvedValue({ total: 1, customerEmail: 'c@x.com' });
    const out: any = await paymentLink.execute(
      { orderId: 'ORD-X' },
      { tenantId: 'aaaaaaaaaaaaaaaaaaaaaaaa', ticketId: 'tk1' },
    );
    expect(out.success).toBe(false);
    expect(createLink).not.toHaveBeenCalled();
  });
});
