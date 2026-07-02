import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createErrorResponse } from '@moto-tracker/shared';

export interface AuthPayload {
  userId: string;
  email: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function createAuthenticate(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization header'));
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, jwtSecret) as AuthPayload;
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Token expired'));
      } else {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid token'));
      }
    }
  };
}

// Default export for production use
export const authenticate = createAuthenticate(process.env.JWT_SECRET || '');
