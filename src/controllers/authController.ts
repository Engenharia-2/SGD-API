import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password, sector, role } = req.body;
    await AuthService.register({ username, password, sector, role });
    ApiResponse.success(res, null, 'Cadastro realizado! Aguarde a autorização.', 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;
    const response = await AuthService.login(username, password);
    ApiResponse.success(res, response, 'Login realizado com sucesso');
  } catch (err) {
    next(err);
  }
};
