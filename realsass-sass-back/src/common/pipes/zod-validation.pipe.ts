// realsass-sass-back/src/common/pipes/zod-validation.pipe.ts
// Pipe de validación Zod inline — patrón ecosistema-ms (ADR-001)
import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: (result.error as ZodError).errors.map(
          e => `${e.path.join('.')}: ${e.message}`,
        ),
      });
    }
    return result.data;
  }
}
