import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

const MAX_RESULTS = 5;

/**
 * Read-only stock-availability check. Tenant-scoped from context (ADR-002),
 * repository-backed. Availability is derived from each variant's stockQty when
 * known; otherwise it falls back to the product's active status (we only ever
 * search active products, so unknown-qty actives read as in stock).
 */
export const checkInventory: ToolDefinition = {
  name: 'check_inventory',
  description:
    'Check stock availability for a product by name or keywords. Read-only — returns ' +
    'whether each matching variant is in stock and the quantity when known. Use this ' +
    'to answer "do you have X" / "is X available" questions. Does not modify anything.',
  schema: z.object({
    query: z.string().min(1).describe('Product name, SKU, or keywords'),
  }),
  execute: async (args: unknown, { tenantId }) => {
    const { productCatalogRepository } = supportDeps();
    const { query } = args as { query: string };
    const words = query.split(/\s+/).filter(Boolean);
    if (!words.length) return { found: 0, items: [] };

    const matches = await productCatalogRepository.searchActive(tenantId, words, MAX_RESULTS);
    const items = matches.flatMap((p) => {
      const product = p as { name: string; status?: string; variants?: Array<{ sku: string; stockQty?: number }> };
      return (product.variants ?? []).map((v) => {
        const hasQty = typeof v.stockQty === 'number';
        return {
          name: product.name,
          sku: v.sku,
          inStock: hasQty ? (v.stockQty as number) > 0 : product.status === 'active',
          stockQty: hasQty ? (v.stockQty as number) : null,
        };
      });
    });

    return { found: items.length, items };
  },
};
