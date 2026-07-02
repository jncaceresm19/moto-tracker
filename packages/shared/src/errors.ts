// Standard API error codes
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'GOOGLE_TOKEN_INVALID';

// Error response interface
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

// Create error response helper
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any
): ApiError {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

// HTTP status code mapping
export function getHttpStatusFromErrorCode(code: ErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
    case 'GOOGLE_TOKEN_INVALID':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'RATE_LIMIT':
      return 429;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}