import { productLookup } from '../tools/productLookup';
import { setSupportDeps } from '../deps';

/**
 * productLookup must surface a price for BOTH catalog shapes: variant products
 * (variants[].price) and the common basePrice-only row. Regression for the
 * 2026-07-17 stress-run finding: basePrice was dropped from the tool result, so
 * every non-variant product looked priceless — the driver escalated all price
 * questions and, on long threads, invented amounts.
 */
describe('productLookup', () => {
  const searchActive = jest.fn();

  beforeAll(() => {
    setSupportDeps({
      productCatalogRepository: { searchActive } as any,
      orderRepository: {} as any,
      userRepository: {} as any,
      ticketRepository: {} as any,
      ticketReplyRepository: {} as any,
      emailService: { send: async () => ({}) },
    });
  });

  beforeEach(() => searchActive.mockReset());

  it('returns basePrice + currency for a variant-less product', async () => {
    searchActive.mockResolvedValue([
      {
        name: '3.5KVA generator',
        category: 'electronics',
        description: 'Technician support within Lagos.',
        basePrice: 320000,
        currency: 'NGN',
        variants: [],
      },
    ]);
    const out = (await productLookup.execute({ query: 'generator' }, { tenantId: 't1' } as any)) as any;
    expect(out.found).toBe(1);
    expect(out.products[0].price).toBe(320000);
    expect(out.products[0].currency).toBe('NGN');
  });

  it('keeps per-variant pricing alongside the base price', async () => {
    searchActive.mockResolvedValue([
      {
        name: 'Corporate slim-fit shirt',
        category: 'fashion',
        basePrice: 15500,
        currency: 'NGN',
        variants: [
          { sku: 'SHIRT-M', price: 15500 },
          { sku: 'SHIRT-XL', price: 16500 },
        ],
      },
    ]);
    const out = (await productLookup.execute({ query: 'shirt' }, { tenantId: 't1' } as any)) as any;
    expect(out.products[0].price).toBe(15500);
    expect(out.products[0].variants).toEqual([
      { sku: 'SHIRT-M', price: 15500 },
      { sku: 'SHIRT-XL', price: 16500 },
    ]);
  });

  it('returns found:0 for an empty query', async () => {
    const out = (await productLookup.execute({ query: ' ' }, { tenantId: 't1' } as any)) as any;
    expect(out).toEqual({ found: 0, products: [] });
    expect(searchActive).not.toHaveBeenCalled();
  });
});
