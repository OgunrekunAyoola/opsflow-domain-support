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
