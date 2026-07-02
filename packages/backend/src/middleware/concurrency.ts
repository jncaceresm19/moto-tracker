import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '@moto-tracker/shared';

const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '50', 10);
let currentConcurrentRequests = 0;

export function maxConcurrentRequests(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (currentConcurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    const errorResponse = createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'Server at capacity, please try again later'
    );
    res.status(503).json(errorResponse);
    return;
  }

  currentConcurrentRequests++;

  // Decrement when response finishes
  res.on('finish', () => {
    currentConcurrentRequests--;
  });

  // Also handle close event for aborted requests
  req.on('close', () => {
    // If response hasn't finished yet, decrement
    if (!res.writableFinished) {
      currentConcurrentRequests--;
    }
  });

  next();
}

// For testing purposes
export function getConcurrentRequestCount(): number {
  return currentConcurrentRequests;
}

export function resetConcurrentRequestCount(): void {
  currentConcurrentRequests = 0;
}