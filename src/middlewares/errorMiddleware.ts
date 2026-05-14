import { Request, Response, NextFunction } from 'express';
import { ApiError, ApiResponse } from '../utils/apiResponse.js';
import { ZodError } from 'zod';

/**
 * Middleware global para captura e tratamento de erros.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Erros de validação do Zod
  if (err instanceof ZodError) {
    const errorDetails = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    
    return ApiResponse.error(res, 'Erro de validação', 400, errorDetails);
  }

  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  // Erros inesperados
  console.error('[Global Error Handler]:', err);
  return ApiResponse.error(res, 'Erro interno do servidor', 500);
};
