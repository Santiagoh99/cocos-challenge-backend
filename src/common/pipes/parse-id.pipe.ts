import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { MAX_INT4 } from '../limits.js';

@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^\d+$/.test(value)) throw new BadRequestException('id must be a positive integer');
    const id = Number(value);
    if (id < 1 || id > MAX_INT4) throw new BadRequestException('id is out of range');
    return id;
  }
}
