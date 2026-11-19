import { IsInt, Max, Min } from 'class-validator';
import { MAX_INT4 } from '../../common/limits.js';

export class CancelOrderDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  userId!: number;
}
