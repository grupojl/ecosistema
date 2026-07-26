import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';
import { InviteCollaboratorDto } from './dto/invite-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/guards/firebase-auth.guard';

@Controller()
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  // ─── Rutas del owner (/organizations/me/collaborators) ────────────────────

  /** GET /organizations/me/collaborators */
  @Get('organizations/me/collaborators')
  listCollaborators(@CurrentUser() user: CurrentUserPayload) {
    return this.collaboratorsService.listCollaborators(user.uid);
  }

  /** POST /organizations/me/collaborators */
  @Post('organizations/me/collaborators')
  @HttpCode(HttpStatus.CREATED)
  inviteCollaborator(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InviteCollaboratorDto,
  ) {
    return this.collaboratorsService.inviteCollaborator(user.uid, dto);
  }

  /** PATCH /organizations/me/collaborators/:id */
  @Patch('organizations/me/collaborators/:id')
  @HttpCode(HttpStatus.OK)
  updateCollaborator(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') collaboratorId: string,
    @Body() dto: UpdateCollaboratorDto,
  ) {
    return this.collaboratorsService.updateCollaborator(user.uid, collaboratorId, dto);
  }

  /** DELETE /organizations/me/collaborators/:id */
  @Delete('organizations/me/collaborators/:id')
  @HttpCode(HttpStatus.OK)
  removeCollaborator(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') collaboratorId: string,
  ) {
    return this.collaboratorsService.removeCollaborator(user.uid, collaboratorId);
  }

  // ─── Rutas de invitación (/invitations/:token) ────────────────────────────

  /**
   * GET /invitations/:token  (pública)
   * Muestra info de la invitación antes de que el usuario se loguee.
   */
  @Public()
  @Get('invitations/:token')
  getInvitationInfo(@Param('token') token: string) {
    return this.collaboratorsService.getInvitationInfo(token);
  }

  /**
   * POST /invitations/:token/accept  (requiere auth)
   * El colaborador logueado acepta la invitación.
   */
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.collaboratorsService.acceptInvitation(token, user.uid);
  }
}