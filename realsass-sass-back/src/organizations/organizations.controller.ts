import { Public } from '../common/guards/firebase-auth.guard';
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UpdateOrganizationDto } from './dto/update-organization.dto'; // sin "s"

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  async getMyOrganization(@CurrentUser() user: CurrentUserPayload) {
    return this.organizationsService.getMyOrganization(user.uid);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMyOrganization(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateMyOrganization(user.uid, dto);
  }

  /**
   * GET /organizations/public/by-slug/:slug
   * Ruta pública — sin Firebase auth.
   * Consumida por realsass-ecommerce-back para resolver slug → StoreInfo.
   */
  @Public()
  @Get('public/by-slug/:slug')
  async getBySlugPublic(@Param('slug') slug: string) {
    const org = await this.organizationsService.findBySlugPublic(slug);
    if (!org) {
      throw new NotFoundException(`No existe una organización con el slug "${slug}"`);
    }
    return { success: true, data: org };
  }
}
