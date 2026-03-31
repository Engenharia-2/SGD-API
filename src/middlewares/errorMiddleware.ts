import { Request, Response, NextFunction } from 'express';
import { ApiError, ApiResponse } from '../utils/apiResponse.js';

/**
 * Middleware global para captura e tratamento de erros.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  // Erros inesperados
  console.error('[Global Error Handler]:', err);
  return ApiResponse.error(res, 'Erro interno do servidor', 500);
};
