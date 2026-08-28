import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ITemplatesRepository } from './templates.repository.interface';
import type { ContentTemplate, CreateTemplateInput } from '../domain/template.entity';

@Injectable()
export class PrismaTemplatesRepository implements ITemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrg(organizationId: string): Promise<ContentTemplate[]> {
    return this.prisma.contentTemplate.findMany({
      where: { organizationId },
      orderBy: { key: 'asc' },
    }) as unknown as ContentTemplate[];
  }

  async findByKey(organizationId: string, key: string): Promise<ContentTemplate | null> {
    return this.prisma.contentTemplate.findFirst({
      where: { organizationId, key },
    }) as unknown as ContentTemplate | null;
  }

  async create(input: CreateTemplateInput): Promise<ContentTemplate> {
    return this.prisma.contentTemplate.create({
      data: {
        organizationId: input.organizationId,
        key:            input.key,
        content:        input.content,
        description:    input.description,
      },
    }) as unknown as ContentTemplate;
  }
}
