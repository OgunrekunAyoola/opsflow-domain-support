/**
 * Support-domain tool package (ADR-T1, SOC north star).
 *
 * Every tool the support industry exposes to the platform is registered here.
 * Tool definitions are domain-owned: they never live in platform/. The platform
 * consumes this record via ToolRegistry (the host registers it at boot).
 */
import type { ToolDefinition } from '@opsflow/platform';
import { escalateTicket } from './escalateTicket';
import { checkOrderStatus } from './checkOrderStatus';
import { refundOrder } from './refundOrder';
import { resetPassword } from './resetPassword';
import { getCustomerOrders } from './getCustomerOrders';
import { productLookup } from './productLookup';
import { checkInventory } from './checkInventory';
import { updateDeliveryAddress } from './updateDeliveryAddress';
import { addOrderNote } from './addOrderNote';
import { createOrder } from './createOrder';
import { paymentLink } from './paymentLink';

export const supportTools: Record<string, ToolDefinition> = {
  escalate_ticket: escalateTicket,
  check_order_status: checkOrderStatus,
  refund_order: refundOrder,
  reset_password: resetPassword,
  // Read-only catalog/order lookups (Phase 1) — tenant-scoped, no mutation, never humanOnly.
  get_customer_orders: getCustomerOrders,
  product_lookup: productLookup,
  check_inventory: checkInventory,
  // Operational writes (Phase 1.5) — mutating + audited, pre-dispatch guarded, never humanOnly.
  update_delivery_address: updateDeliveryAddress,
  add_order_note: addOrderNote,
  // Conversion (CONVERSION_CAPABILITY_DESIGN) — captures an UNPAID order; mutating + audited;
  // never takes/confirms payment so NOT humanOnly.
  create_order: createOrder,
  // Generates a pay link for an unpaid order (graceful-degrades w/o a provider); never confirms
  // payment (webhook only, ADR-068); NOT humanOnly.
  payment_link: paymentLink,
};
