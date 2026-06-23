import type {
  OrderRepository,
  ProductCatalogRepository,
  UserRepository,
  TicketRepository,
  TicketReplyRepository,
} from '@opsflow/platform';

/** The email sender slice resetPassword needs (host injects its EmailService). */
export interface EmailSender {
  send(msg: { to: string; subject: string; text?: string; html?: string }): Promise<unknown>;
}

/**
 * Payment-link provider (CONVERSION_CAPABILITY_DESIGN) — generates a customer pay link for an
 * unpaid order (Paystack/Flutterwave). Injected + OPTIONAL: when absent, payment_link
 * fail-closes to "a human will share payment details". It NEVER confirms payment (ADR-068 —
 * only the processor webhook does); it just creates the link.
 */
export interface PaymentLinkProvider {
  createLink(args: {
    orderId: string;
    amount: number;
    customerEmail: string;
  }): Promise<{ url: string; reference: string }>;
}

/**
 * Host-injected dependencies for the support domain. The tools are domain-owned but
 * run against the host's registered-model repository singletons + services, which the
 * host wires once at boot via setSupportDeps — so this package never imports the host.
 */
export interface SupportDeps {
  orderRepository: OrderRepository;
  productCatalogRepository: ProductCatalogRepository;
  userRepository: UserRepository;
  ticketRepository: TicketRepository;
  ticketReplyRepository: TicketReplyRepository;
  emailService: EmailSender;
  /** Optional — when unset, payment_link degrades to "a human will share payment details". */
  paymentLinkProvider?: PaymentLinkProvider;
}

let _deps: SupportDeps | null = null;

/** Wire the host repositories + services. Call once at boot (and in tests, with mocks). */
export function setSupportDeps(deps: SupportDeps): void {
  _deps = deps;
}

export function supportDeps(): SupportDeps {
  if (!_deps) {
    throw new Error('@opsflow/domain-support: deps not set — call setSupportDeps() at boot');
  }
  return _deps;
}
