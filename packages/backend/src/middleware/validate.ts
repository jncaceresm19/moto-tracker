import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createErrorResponse } from '@moto-tracker/shared';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      // Replace with validated/transformed data
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        console.log('[VALIDATE] Source:', source, 'Body received:', JSON.stringify(req[source]));
        const details = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        console.log('[VALIDATE] Zod errors:', JSON.stringify(details));
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Validation failed',
          details
        );
        res.status(400).json(errorResponse);
      } else {
        next(error);
      }
    }
  };
}

// Convenience middleware for body validation
export function validateBody(schema: ZodSchema) {
  return validate(schema, 'body');
}

// Convenience middleware for query validation
export function validateQuery(schema: ZodSchema) {
  return validate(schema, 'query');
}

// Convenience middleware for params validation
export function validateParams(schema: ZodSchema) {
  return validate(schema, 'params');
}