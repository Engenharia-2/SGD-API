import { Response } from 'express';

export class ApiError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ApiResponse {
  /**
   * Envia uma resposta de sucesso padronizada.
   */
  static success<T>(res: Response, data: T | null = null, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      data
    });
  }

  /**
   * Envia uma resposta de erro padronizada.
   */
  static error<T>(res: Response, message: string = 'Internal Server Error', statusCode: number = 500, errors: T | null = null) {
    return res.status(statusCode).json({
      status: 'error',
      message,
      errors
    });
  }
}
