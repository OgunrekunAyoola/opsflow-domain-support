import { z } from 'zod';
import type { ToolDefinition, OrderItem } from '@opsflow/platform';
import { supportDeps } from '../deps';

/**
 * Capture a new order (CONVERSION_CAPABILITY_DESIGN). Prices + stock-checks every line from the
 * catalog by exact SKU (never trusts an agent-claimed price), then creates an UNPAID `pending`
 * order. Tenant-scoped (ADR-002), repository-backed, audited + idempotent (in MUTATING_TOOLS).
 *
 * NOT humanOnly: creating an unpaid order is operational, not a money confirmation (ADR-068).
 * It NEVER takes or confirms payment — a payment link / human handles that, and only the processor
 * webhook marks an order paid.
 */
export const createOrder: ToolDefinition = {
  name: 'create_order',
  description:
    'Capture a new order for in-stock catalog items. Creates an UNPAID (pending) order priced from ' +
    'the catalog and returns the order id + total. Use it AFTER confirming items + quantities with ' +
    'the customer — find exact SKUs first with product_lookup / check_inventory. Does NOT take or ' +
    'confirm payment (a payment link or a human handles that). Reference items by their exact SKU.',
  schema: z.object({
    customerEmail: z.string().email().describe('The customer email the order is keyed to'),
    items: z
      .array(
        z.object({
          sku: z.string().min(1).describe('Exact variant SKU from the catalog'),
          quantity: z.number().int().positive().describe('How many of this SKU'),
        }),
      )
      .min(1)
      .describe('The line items to order'),
    shippingAddress: z.string().optional().describe('Delivery address, if the customer gave one'),
  }),
  execute: async (args: unknown, { tenantId }) => {
    const { productCatalogRepository, orderRepository } = supportDeps();
    const { customerEmail, items, shippingAddress } = args as {
      customerEmail: string;
      items: { sku: string; quantity: number }[];
      shippingAddress?: string;
    };

    const lineItems: OrderItem[] = [];
    for (const it of items) {
      const product = (await productCatalogRepository.findBySku(tenantId, it.sku)) as {
        name: string;
        variants?: Array<{ sku: string; price: number; stockQty?: number }>;
      } | null;
      if (!product) {
        return { success: false, reason: `No active product found for SKU "${it.sku}".`, sku: it.sku };
      }
      const variant = (product.variants ?? []).find((v) => v.sku === it.sku);
      if (!variant) {
        return { success: false, reason: `SKU "${it.sku}" is not available.`, sku: it.sku };
      }
      if (typeof variant.stockQty === 'number' && variant.stockQty < it.quantity) {
        return {
          success: false,
          reason: `Only ${variant.stockQty} of "${product.name}" (${it.sku}) in stock — cannot order ${it.quantity}.`,
          sku: it.sku,
          available: variant.stockQty,
        };
      }
      lineItems.push({ sku: it.sku, name: product.name, quantity: it.quantity, unitPrice: variant.price });
    }

    const total = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
    const order = (await orderRepository.createOrder(tenantId, {
      customerEmail,
      total,
      items: lineItems,
      ...(shippingAddress ? { shippingAddress } : {}),
    })) as { orderId: string; status: string };

    return { success: true, orderId: order.orderId, status: order.status, total, items: lineItems };
  },
};
