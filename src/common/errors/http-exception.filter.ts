import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConflictError, DomainError, InvalidRequestError, NotFoundError } from './domain.errors.js';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const body = this.toBody(exception);
    httpAdapter.reply(host.switchToHttp().getResponse(), body, body.statusCode);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof DomainError) {
      const statusCode = statusForDomainError(exception);
      return {
        statusCode,
        error: reasonPhrase(statusCode),
        message: exception.message,
        code: exception.code,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        error: reasonPhrase(statusCode),
        message: messageFromHttpException(exception),
      };
    }

    const stack = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error('Unhandled exception', stack);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: reasonPhrase(HttpStatus.INTERNAL_SERVER_ERROR),
      message: 'Internal server error',
    };
  }
}

function statusForDomainError(error: DomainError): number {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof InvalidRequestError) return HttpStatus.BAD_REQUEST;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function messageFromHttpException(exception: HttpException): string | string[] {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && 'message' in response) {
    const { message } = response;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message;
    }
  }
  return exception.message;
}

function reasonPhrase(statusCode: number): string {
  const name = HttpStatus[statusCode];
  if (name === undefined) return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
