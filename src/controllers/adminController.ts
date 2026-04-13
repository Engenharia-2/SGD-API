import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/adminService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await AdminService.listAllUsers();
    ApiResponse.success(res, users);
  } catch (err) {
    next(err);
  }
};

export const authorizeUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  try {
    await AdminService.authorizeUser(Number(id));
    ApiResponse.success(res, null, 'Usuário autorizado com sucesso');
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  try {
    await AdminService.deleteUser(Number(id));
    ApiResponse.success(res, null, 'Usuário removido/recusado');
  } catch (err) {
    next(err);
  }
};
