import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';

@Controller('ecommerce/inventory')
@UseGuards(TenantGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Patch(':variantId')
  @Roles('OWNER', 'MEMBER')
  setStock(@Tenant() tenant: TenantContext, @Param('variantId') variantId: string, @Body() dto: UpdateStockDto) {
    return this.inventoryService.setStock(tenant.organizationId, variantId, dto.quantityAvailable);
  }
}
