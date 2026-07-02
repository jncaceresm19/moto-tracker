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

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!JWT_SECRET) {
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'JWT_SECRET not configured'));
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Token expired'));
    } else {
      res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid token'));
    }
  }
}
