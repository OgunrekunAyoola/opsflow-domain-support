/**
 * Support-domain tool package (ADR-T1, SOC north star).
 *
 * Every tool the support industry exposes to the platform is registered here.
 * Tool definitions are domain-owned: they never live in platform/. The platform
 * consumes this record via ToolRegistry (the host registers it at boot).
 *
 * Communication-only scope (PRODUCT_SCOPE_AND_MONEY_CLEANUP): the money + order tools
 * (payment_link, create_order, refund_order, get_customer_orders, check_order_status,
 * update_delivery_address, add_order_note) were removed — the bot grounds + escalates and
 * never reads/writes orders or touches payment. Money/order safety is enforced by ABSENCE.
 */
import type { ToolDefinition } from '@opsflow/platform';
import { escalateTicket } from './escalateTicket';
import { resetPassword } from './resetPassword';
import { productLookup } from './productLookup';
import { checkInventory } from './checkInventory';

export const supportTools: Record<string, ToolDefinition> = {
  escalate_ticket: escalateTicket,
  reset_password: resetPassword,
  // Read-only catalog lookups — tenant-scoped, no mutation, never humanOnly.
  product_lookup: productLookup,
  check_inventory: checkInventory,
};
