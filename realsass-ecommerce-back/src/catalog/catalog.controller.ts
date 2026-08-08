import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';

// Admin — requiere Firebase + x-organization-id (FirebaseAuthGuard es global).
@Controller('ecommerce/products')
@UseGuards(TenantGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Tenant() tenant: TenantContext) {
    return this.catalogService.listProductsAdmin(tenant.organizationId);
  }

  @Post()
  @Roles('OWNER', 'COLLABORATOR')
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(tenant.organizationId, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'COLLABORATOR')
  update(@Tenant() tenant: TenantContext, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalogService.updateProduct(tenant.organizationId, id, dto);
  }
}
