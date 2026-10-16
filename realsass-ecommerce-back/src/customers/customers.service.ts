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

export interface IdentifyCustomerOutput {
  customerId: string;
  isNew:      boolean;
}

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMERS_REPOSITORY)
    private readonly customersRepository: ICustomersRepository,
  ) {}

  /**
   * Identifica al cliente por email: un cliente por (organización, email). Lo crea si no existe.
   *
   * Ya NO es un procedure público (ADR-021): lo llama el contexto tRPC con el email verificado por Firebase.
   */
  async identify(
    organizationId: string,
    email:          string,
    name?:          string,
    phone?:         string,
    cartId?:        string,
  ): Promise<IdentifyCustomerOutput> {
    const normalized = email.trim().toLowerCase();
    try {
      assertValidEmail(normalized);
    } catch (err) {
      throw new UnprocessableEntityException(
        err instanceof InvalidEmailError ? err.message : "Email inválido",
      );
    }

    const { customer, created } = await this.customersRepository.upsertByEmail(
      organizationId,
      normalized,
      {
        ...(name?.trim()  && { displayName: name.trim() }),
        ...(phone?.trim() && { phone: phone.trim() }),
      },
    );

    // cartId se maneja en CartService — aquí solo identificamos al customer
    void cartId;

    return { customerId: customer.id, isNew: created };
  }

  async findById(organizationId: string, customerId: string) {
    const customer = await this.customersRepository.findById(organizationId, customerId);
    if (!customer) {
      throw new NotFoundException(new CustomerNotFoundError(customerId).message);
    }
    return customer;
  }

  async findBySession(organizationId: string, sessionId: string) {
    return this.customersRepository.findBySessionId(organizationId, sessionId);
  }

  async update(
    organizationId: string,
    customerId:     string,
    patch: { email?: string; name?: string; phone?: string },
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

  async listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ) {
    return this.customersRepository.listByOrg(organizationId, filters);
  }
}
