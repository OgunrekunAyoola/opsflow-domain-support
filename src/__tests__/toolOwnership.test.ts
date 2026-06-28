/**
 * H2 / ADR-002 — tool ownership & identity binding.
 *
 * Customer-scoped tools take the customer identity from the TRUSTED conversation context, never from
 * the model's args, and fail-closed when it is absent or does not match the resource owner. These
 * tests lock the cross-customer data leak shut (CONVERSATION_DRIVER_ARCHITECTURE §8.1 / H2).
 */
import { setSupportDeps } from '../deps';
import { getCustomerOrders } from '../tools/getCustomerOrders';
import { checkOrderStatus } from '../tools/checkOrderStatus';
import { updateDeliveryAddress } from '../tools/updateDeliveryAddress';
import { addOrderNote } from '../tools/addOrderNote';
import { resetPassword } from '../tools/resetPassword';

const findByCustomerContact = jest.fn();
const findOne = jest.fn();
const findByOrderId = jest.fn();
const addNote = jest.fn();
const updateShippingAddress = jest.fn();
const findByEmail = jest.fn();
const updateById = jest.fn();
const send = jest.fn();

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const owned = { tenantId: TENANT, ticketId: 'tk1', customerEmail: 'me@x.com' };
const anon = { tenantId: TENANT, ticketId: 'tk1' }; // no trusted identity resolved

beforeEach(() => {
  jest.clearAllMocks();
  setSupportDeps({
    orderRepository: { findByCustomerContact, findOne, findByOrderId, addNote, updateShippingAddress } as any,
    productCatalogRepository: {} as any,
    userRepository: { findByEmail, updateById } as any,
    ticketRepository: {} as any,
    ticketReplyRepository: {} as any,
    emailService: { send } as any,
  });
});

describe('get_customer_orders — identity from context', () => {
  it('queries by the trusted ctx contact, ignoring any model-supplied email', async () => {
    findByCustomerContact.mockResolvedValue([{ orderId: 'ORD-1', status: 'pending', total: 10 }]);
    const out: any = await getCustomerOrders.execute({ customerEmail: 'victim@x.com' } as any, owned);
    expect(findByCustomerContact).toHaveBeenCalledWith(TENANT, { email: 'me@x.com', phone: undefined });
    expect(out.found).toBe(1);
  });

  it('queries by phone for a WhatsApp customer with no email', async () => {
    findByCustomerContact.mockResolvedValue([{ orderId: 'ORD-9', status: 'shipped', total: 20 }]);
    const phoneCtx = { tenantId: TENANT, ticketId: 'tk1', customerPhone: '+2348012345678' };
    const out: any = await getCustomerOrders.execute({}, phoneCtx);
    expect(findByCustomerContact).toHaveBeenCalledWith(TENANT, { email: undefined, phone: '+2348012345678' });
    expect(out.found).toBe(1);
  });

  it('fail-closes (no lookup) when the conversation has no identity', async () => {
    const out: any = await getCustomerOrders.execute({}, anon);
    expect(findByCustomerContact).not.toHaveBeenCalled();
    expect(out.found).toBe(0);
  });
});

describe('check_order_status — ownership', () => {
  it('returns status for an order the customer owns', async () => {
    findOne.mockResolvedValue({
      status: 'shipped',
      trackingNumber: 'T1',
      total: 5,
      customerEmail: 'me@x.com',
    });
    const out: any = await checkOrderStatus.execute({ orderId: 'ORD-1' }, owned);
    expect(out.status).toBe('shipped');
  });

  it('matches a WhatsApp customer by phone (no email on either side)', async () => {
    findOne.mockResolvedValue({ status: 'shipped', total: 5, customerPhone: '+2348012345678' });
    const phoneCtx = { tenantId: TENANT, ticketId: 'tk1', customerPhone: '+2348012345678' };
    const out: any = await checkOrderStatus.execute({ orderId: 'ORD-1' }, phoneCtx);
    expect(out.status).toBe('shipped');
  });

  it('hides another customer order (not_found, no leak)', async () => {
    findOne.mockResolvedValue({ status: 'shipped', total: 5, customerEmail: 'other@x.com' });
    const out: any = await checkOrderStatus.execute({ orderId: 'ORD-1' }, owned);
    expect(out.status).toBe('not_found');
  });

  it('fail-closes without a trusted identity', async () => {
    findOne.mockResolvedValue({ status: 'shipped', total: 5, customerEmail: 'me@x.com' });
    const out: any = await checkOrderStatus.execute({ orderId: 'ORD-1' }, anon);
    expect(out.status).toBe('not_found');
  });
});

describe('mutating order tools — ownership checked before write', () => {
  it('update_delivery_address denies a foreign order without mutating', async () => {
    findByOrderId.mockResolvedValue({ status: 'pending', customerEmail: 'other@x.com' });
    const out: any = await updateDeliveryAddress.execute(
      { orderId: 'ORD-1', address: '123 New Road' },
      owned,
    );
    expect(out.success).toBe(false);
    expect(updateShippingAddress).not.toHaveBeenCalled();
  });

  it('add_order_note denies a foreign order without mutating', async () => {
    findByOrderId.mockResolvedValue({ customerEmail: 'other@x.com' });
    const out: any = await addOrderNote.execute({ orderId: 'ORD-1', note: 'hi' }, owned);
    expect(out.success).toBe(false);
    expect(addNote).not.toHaveBeenCalled();
  });
});

describe('reset_password — own account only', () => {
  it('resets the conversation customer, ignoring any model-supplied email', async () => {
    findByEmail.mockResolvedValue({ _id: { toString: () => 'u1' } });
    updateById.mockResolvedValue(true);
    send.mockResolvedValue(undefined);
    const out: any = await resetPassword.execute({ email: 'victim@x.com' } as any, owned);
    expect(findByEmail).toHaveBeenCalledWith(TENANT, 'me@x.com');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'me@x.com' }));
    expect(out.success).toBe(true);
  });

  it('fail-closes without a trusted identity', async () => {
    const out: any = await resetPassword.execute({}, anon);
    expect(findByEmail).not.toHaveBeenCalled();
    expect(out.success).toBe(false);
  });
});
