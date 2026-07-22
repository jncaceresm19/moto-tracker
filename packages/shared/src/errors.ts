// Standard API error codes
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'RATE_LIMITED'
  | 'EXPIRED'
  | 'LOCKED'
  | 'INVALID_CODE'
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
    case 'BAD_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
    case 'GOOGLE_TOKEN_INVALID':
    case 'INVALID_CODE':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'EXPIRED':
      return 410;
    case 'RATE_LIMIT':
    case 'RATE_LIMITED':
    case 'LOCKED':
      return 429;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}