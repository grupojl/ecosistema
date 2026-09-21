import { Module }                     from "@nestjs/common";
import { CustomersService }           from "./customers.service";
import { PrismaCustomersRepository }  from "./repository/prisma-customers.repository";
import { CUSTOMERS_REPOSITORY }       from "./repository/customers.repository.interface";

@Module({
  providers: [
    CustomersService,
    PrismaCustomersRepository,
    { provide: CUSTOMERS_REPOSITORY, useClass: PrismaCustomersRepository },
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
