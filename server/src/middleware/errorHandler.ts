import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

export class ApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }

  static badRequest(message: string) {
    return new ApiError(message, 400, 'BAD_REQUEST');
  }

  static notFound(message: string) {
    return new ApiError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string) {
    return new ApiError(message, 409, 'CONFLICT');
  }

  static internal(message: string) {
    return new ApiError(message, 500, 'INTERNAL_ERROR');
  }
}
