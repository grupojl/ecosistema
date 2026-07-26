import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AffiliatesService } from './affiliate.service';

@Controller('affiliates')
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  /**
   * GET /affiliates/me
   * Retorna el perfil completo del afiliado: código, balance, referidos.
   */
  @Get('me')
  async getMyAffiliateProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.affiliatesService.getMyProfile(user.uid);
  }

  /**
   * GET /affiliates/me/referrals
   * Retorna el listado de usuarios que se registraron usando el código del afiliado.
   */
  @Get('me/referrals')
  async getMyReferrals(@CurrentUser() user: CurrentUserPayload) {
    return this.affiliatesService.getMyReferrals(user.uid);
  }
}