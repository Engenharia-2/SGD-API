import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AdminService } from '../services/adminService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const listUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user!;
  try {
    const users = await AdminService.listAllUsers(user.role, user.sector);
    ApiResponse.success(res, users);
  } catch (err) {
    next(err);
  }
};

export const authorizeUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  try {
    await AdminService.authorizeUser(Number(id));
    ApiResponse.success(res, null, 'Usuário autorizado com sucesso');
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  try {
    await AdminService.deleteUser(Number(id));
    ApiResponse.success(res, null, 'Usuário removido/recusado');
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { newPassword } = req.body;
  try {
    await AdminService.resetPassword(Number(id), newPassword);
    ApiResponse.success(res, null, 'Senha redefinida com sucesso');
  } catch (err) {
    next(err);
  }
};
