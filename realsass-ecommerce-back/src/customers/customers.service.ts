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
} from "@/customers/repository/customers.repository.interface.js";
import {
  assertValidEmail,
  CustomerNotFoundError,
  InvalidEmailError,
} from "@/customers/domain/customer.errors.js";

export interface IdentifyCustomerOutput {
  customerId: string;
  sessionId:  string;
  isNew:      boolean;
}

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMERS_REPOSITORY)
    private readonly customersRepository: ICustomersRepository,
  ) {}

  async identify(
    organizationId: string,
    sessionId:      string,
    email?:         string,
    name?:          string,
    phone?:         string,
    cartId?:        string,
  ): Promise<IdentifyCustomerOutput> {
    // Validar email si viene
    if (email) {
      try {
        assertValidEmail(email);
      } catch (err) {
        throw new UnprocessableEntityException(
          err instanceof InvalidEmailError ? err.message : "Email inválido",
        );
      }
    }

    // identifyBySession hace upsert — crea si no existe, retorna si existe
    const customer = await this.customersRepository.identifyBySession(
      organizationId,
      sessionId,
    );

    const isNew = !customer.email && !email;

    // Actualizar datos si vinieron
    if (email || name || phone) {
      await this.customersRepository.update(organizationId, customer.id, {
        ...(email && { email }),
        ...(name  && { name }),
        ...(phone && { phone }),
      });
    }

    // cartId se maneja en CartService — aquí solo identificamos al customer
    void cartId;

    return {
      customerId: customer.id,
      sessionId:  customer.sessionId,
      isNew,
    };
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
