import { z } from 'zod';
import type { ToolDefinition } from '@opsflow/platform';
import { supportDeps } from '../deps';

const MAX_RESULTS = 5;
const DESC_LEN = 200;

/**
 * Read-only catalog lookup for product + pricing questions. Tenant-scoped from
 * context (ADR-002); searches only ACTIVE products via the repository (never the
 * model directly). Grounds the agent's answers in the real catalog instead of
 * inventing prices.
 */
export const productLookup: ToolDefinition = {
  name: 'product_lookup',
  description:
    'Look up products in the store catalog by name or keywords. Read-only — returns ' +
    "each match's name, category, description, price (and per-variant pricing where " +
    'variants exist). Use this to answer product and pricing questions. Does not modify anything.',
  schema: z.object({
    query: z.string().min(1).describe('Product name or keywords, e.g. "jollof spice"'),
  }),
  execute: async (args: unknown, { tenantId }) => {
    const { productCatalogRepository } = supportDeps();
    const { query } = args as { query: string };
    const words = query.split(/\s+/).filter(Boolean);
    if (!words.length) return { found: 0, products: [] };

    const matches = await productCatalogRepository.searchActive(tenantId, words, MAX_RESULTS);
    const products = matches.map((p) => {
      const product = p as {
        name: string;
        category: string;
        description?: string;
        basePrice?: number;
        currency?: string;
        variants?: Array<{ sku: string; price: number }>;
      };
      return {
        name: product.name,
        category: product.category,
        description: (product.description ?? '').slice(0, DESC_LEN),
        // basePrice is the product's price when it has no variants (the common case —
        // catalog onboarding creates basePrice-only rows). Omitting it starved the
        // driver of every non-variant price → "price not available" escalations and,
        // under pressure, invented amounts (stress-run finding, 2026-07-17).
        price: product.basePrice,
        currency: product.currency,
        variants: (product.variants ?? []).map((v) => ({ sku: v.sku, price: v.price })),
      };
    });

    return { found: products.length, products };
  },
};
