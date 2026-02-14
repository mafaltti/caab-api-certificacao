export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NoTicketsError extends AppError {
  constructor() {
    super("No available tickets", 422);
  }
}
