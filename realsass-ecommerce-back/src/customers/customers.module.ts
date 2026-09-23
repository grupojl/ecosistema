import { Module }                     from "@nestjs/common";
import { CustomersService }           from "@/customers/customers.service";
import { PrismaCustomersRepository }  from "@/customers/repository/prisma-customers.repository";
import { CUSTOMERS_REPOSITORY }       from "@/customers/repository/customers.repository.interface";

@Module({
  providers: [
    CustomersService,
    PrismaCustomersRepository,
    { provide: CUSTOMERS_REPOSITORY, useClass: PrismaCustomersRepository },
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
