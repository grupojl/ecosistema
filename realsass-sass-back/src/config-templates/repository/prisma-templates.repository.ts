import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { ITemplatesRepository } from './templates.repository.interface';
import type { ContentTemplate, CreateTemplateInput } from '../domain/template.entity';

type PrismaTemplate = Prisma.ContentTemplateGetPayload<Record<string, never>>;

@Injectable()
export class PrismaTemplatesRepository implements ITemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaTemplate): ContentTemplate {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      key:            row.key,
      content:        row.content,
      description:    row.description,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<ContentTemplate[]> {
    const rows = await this.prisma.contentTemplate.findMany({
      where: { organizationId }, orderBy: { key: 'asc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findByKey(organizationId: string, key: string): Promise<ContentTemplate | null> {
    const row = await this.prisma.contentTemplate.findFirst({ where: { organizationId, key } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateTemplateInput): Promise<ContentTemplate> {
    const row = await this.prisma.contentTemplate.create({
      data: {
        organizationId: input.organizationId,
        key:            input.key,
        content:        input.content,
        description:    input.description,
      },
    });
    return this.toEntity(row);
  }
}
