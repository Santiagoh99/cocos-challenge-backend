export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(resource: string, id: number) {
    super(`${resource} ${id} not found`);
  }
}

export class InvalidRequestError extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ConflictError extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
