/**
 * create_order tool — prices + stock-checks each line from the catalog by exact SKU, then creates
 * an UNPAID pending order. Soft-fails (no order created) on unknown SKU or insufficient stock.
 * Deps are injected via setSupportDeps (mocked repos).
 */
import { setSupportDeps } from '../deps';
import { createOrder } from '../tools/createOrder';

const findBySku = jest.fn();
const createOrderRepo = jest.fn();

function wireDeps() {
  setSupportDeps({
    productCatalogRepository: { findBySku } as any,
    orderRepository: { createOrder: createOrderRepo } as any,
    userRepository: {} as any,
    ticketRepository: {} as any,
    ticketReplyRepository: {} as any,
    emailService: {} as any,
  });
}

const ctx = { tenantId: 'aaaaaaaaaaaaaaaaaaaaaaaa', ticketId: 'tk1' };

describe('create_order tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireDeps();
  });

  it('prices from the catalog by SKU and creates a pending order', async () => {
    findBySku.mockResolvedValue({
      name: 'Samsung Galaxy A15',
      variants: [{ sku: 'PH-001', price: 185000, stockQty: 8 }],
    });
    createOrderRepo.mockImplementation(async (_t: string, d: any) => ({
      orderId: 'ORD-X',
      status: 'pending',
      ...d,
    }));

    const out: any = await createOrder.execute(
      { customerEmail: 'c@x.com', items: [{ sku: 'PH-001', quantity: 2 }] },
      ctx,
    );

    expect(out.success).toBe(true);
    expect(out.total).toBe(370000);
    expect(out.orderId).toBe('ORD-X');
    expect(out.status).toBe('pending');
    expect(createOrderRepo).toHaveBeenCalledWith(
      'aaaaaaaaaaaaaaaaaaaaaaaa',
      expect.objectContaining({
        customerEmail: 'c@x.com',
        total: 370000,
        items: [{ sku: 'PH-001', name: 'Samsung Galaxy A15', quantity: 2, unitPrice: 185000 }],
      }),
    );
  });

  it('soft-fails (no order created) when a SKU is not found', async () => {
    findBySku.mockResolvedValue(null);
    const out: any = await createOrder.execute(
      { customerEmail: 'c@x.com', items: [{ sku: 'NOPE', quantity: 1 }] },
      ctx,
    );
    expect(out.success).toBe(false);
    expect(out.reason).toContain('NOPE');
    expect(createOrderRepo).not.toHaveBeenCalled();
  });

  it('soft-fails (no order created) when stock is insufficient', async () => {
    findBySku.mockResolvedValue({
      name: 'Bone-straight wig',
      variants: [{ sku: 'HR-001', price: 50000, stockQty: 1 }],
    });
    const out: any = await createOrder.execute(
      { customerEmail: 'c@x.com', items: [{ sku: 'HR-001', quantity: 3 }] },
      ctx,
    );
    expect(out.success).toBe(false);
    expect(out.reason).toContain('in stock');
    expect(out.available).toBe(1);
    expect(createOrderRepo).not.toHaveBeenCalled();
  });
});
