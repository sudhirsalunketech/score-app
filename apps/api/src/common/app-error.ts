export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export const Errors = {
  validation: (message: string) => new AppError('VALIDATION_ERROR', message, 400),
  unauthorized: (message = 'Unauthorized') => new AppError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Forbidden') => new AppError('FORBIDDEN', message, 403),
  notFound: (code: string, message: string) => new AppError(code, message, 404),
  conflict: (code: string, message: string) => new AppError(code, message, 409),
  invalidState: (message: string) => new AppError('INVALID_MATCH_STATE', message, 409),
  structureLocked: (message = 'Match settings are locked after scoring starts.') =>
    new AppError('MATCH_STRUCTURE_LOCKED', message, 409),
  invalidDelivery: (message: string) => new AppError('INVALID_DELIVERY', message, 400),
  invalidWicket: (message: string) => new AppError('INVALID_WICKET', message, 400),
  duplicate: (message = 'Duplicate delivery') => new AppError('DUPLICATE_DELIVERY', message, 409),
  unavailable: (message = 'Scoring is currently unavailable. Please try again.') =>
    new AppError('SCORING_UNAVAILABLE', message, 503),
};
