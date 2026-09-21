import { Module }                from "@nestjs/common";
import { CartService }           from "./cart.service";
import { PrismaCartRepository }  from "./repository/prisma-cart.repository";
import { CART_REPOSITORY }       from "./repository/cart.repository.interface";
import { ActivityModule }        from "../activity/activity.module";

@Module({
  imports:   [ActivityModule],
  providers: [
    CartService,
    PrismaCartRepository,
    { provide: CART_REPOSITORY, useClass: PrismaCartRepository },
  ],
  exports: [CartService],
})
export class CartModule {}
