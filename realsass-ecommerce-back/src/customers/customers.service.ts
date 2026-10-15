// realsass-ecommerce-back/src/customers/customers.service.ts
// ECO-BACK-03: refactorizado para usar ICustomersRepository via @Inject.
// PrismaService eliminado — toda la persistencia va por el repository.
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  CUSTOMERS_REPOSITORY,
  type ICustomersRepository,
} from "@/customers/repository/customers.repository.interface";
import {
  assertValidEmail,
  CustomerNotFoundError,
  InvalidEmailError,
} from "@/customers/domain/customer.errors";
import { CustomerSessionService, type CustomerSession } from "@/customers/customer-session.service";

export interface IdentifyCustomerOutput {
  customerId: string;
  isNew:      boolean;
  /** Sesión firmada. Es la ÚNICA credencial del storefront: el router la entrega en una cookie HttpOnly. */
  token:      string;
  expiresAt:  Date;
}

export interface IdentifyContact {
  email?:       string;
  displayName?: string;
  phone?:       string;
}

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMERS_REPOSITORY)
    private readonly customersRepository: ICustomersRepository,
    private readonly sessions: CustomerSessionService,
  ) {}

  /**
   * Abre (o continúa) la sesión del cliente.
   *
   *  - Con una sesión VÁLIDA de la misma organización: se continúa esa sesión.
   *  - Sin sesión: se crea un invitado NUEVO. Nunca se busca por email ni se devuelve un cliente
   *    existente: saber un email no da acceso a la cuenta de nadie.
   */
  async identify(
    organizationId: string,
    current:        CustomerSession | null,
    contact:        IdentifyContact = {},
  ): Promise<IdentifyCustomerOutput> {
    if (contact.email) {
      try {
        assertValidEmail(contact.email);
      } catch (err) {
        throw new UnprocessableEntityException(
          err instanceof InvalidEmailError ? err.message : "Email inválido",
        );
      }
    }

    const continuing = current && current.organizationId === organizationId
      ? await this.customersRepository.findById(organizationId, current.customerId)
      : null;
    const customer = continuing ?? (await this.customersRepository.createGuest(organizationId));

    await this.customersRepository.attachContact(organizationId, customer.id, contact);

    const { token, expiresAt } = this.sessions.issue({ customerId: customer.id, organizationId });
    return { customerId: customer.id, isNew: !continuing, token, expiresAt };
  }

  async findById(organizationId: string, customerId: string) {
    const customer = await this.customersRepository.findById(organizationId, customerId);
    if (!customer) {
      throw new NotFoundException(new CustomerNotFoundError(customerId).message);
    }
    return customer;
  }

  async update(
    organizationId: string,
    customerId:     string,
    patch: { email?: string; displayName?: string; phone?: string },
  ) {
    if (patch.email) {
      try {
        assertValidEmail(patch.email);
      } catch (err) {
        throw new UnprocessableEntityException(
          err instanceof InvalidEmailError ? err.message : "Email inválido",
        );
      }
    }

    const exists = await this.customersRepository.findById(organizationId, customerId);
    if (!exists) throw new NotFoundException(new CustomerNotFoundError(customerId).message);

    return this.customersRepository.update(organizationId, customerId, patch);
  }

  /** GDPR/LGPD: el cliente anonimiza SU cuenta. El id sale de la sesión firmada, nunca del input. */
  async deleteAccount(organizationId: string, customerId: string): Promise<{ anonymizedAt: Date }> {
    const done = await this.customersRepository.anonymize(organizationId, customerId);
    if (!done) throw new NotFoundException(new CustomerNotFoundError(customerId).message);
    return { anonymizedAt: new Date() };
  }

  async listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ) {
    return this.customersRepository.listByOrg(organizationId, filters);
  }
}
