import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';

// Admin — el dueño de la org revisa órdenes desde el dashboard.
@Controller('ecommerce/orders')
@UseGuards(TenantGuard, RolesGuard)
@Roles('OWNER', 'COLLABORATOR')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Tenant() tenant: TenantContext) {
    return this.ordersService.listOrders(tenant.organizationId);
  }

  @Get(':id')
  get(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.ordersService.getOrder(tenant.organizationId, id);
  }
}
