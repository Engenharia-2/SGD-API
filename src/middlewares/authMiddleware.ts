import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/apiResponse.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export type UserRole = 'Administrador' | 'Gestor' | 'Funcionario';

export type Permission = 'LEITURA' | 'ESCRITA' | 'MODIFICACAO' | 'AUTORIZACAO';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'Administrador': ['LEITURA', 'ESCRITA', 'MODIFICACAO', 'AUTORIZACAO'],
  'Gestor': ['LEITURA', 'ESCRITA', 'MODIFICACAO', 'AUTORIZACAO'],
  'Funcionario': ['LEITURA']
};

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    sector: string;
    role: UserRole;
  };
}

/**
 * Middleware para autenticar o token JWT.
 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ApiResponse.error(res, 'Acesso negado. Token não fornecido.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch (err) {
    return ApiResponse.error(res, 'Token inválido ou expirado.', 403);
  }
};

/**
 * Middleware para autorizar com base na permissão específica.
 */
export const authorizePermission = (permission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return ApiResponse.error(res, 'Não autenticado.', 401);

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

    if (!userPermissions.includes(permission)) {
      return ApiResponse.error(res, `Permissão negada. Você não possui nível de ${permission}.`, 403);
    }

    next();
  };
};

/**
 * Middleware legado para autorizar com base em roles (mantido para compatibilidade enquanto migramos).
 */
export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return ApiResponse.error(res, 'Não autenticado.', 401);
    
    if (!allowedRoles.includes(req.user.role)) {
      return ApiResponse.error(res, 'Permissão negada para esta operação.', 403);
    }
    
    next();
  };
};

/**
 * Middleware para validar se o usuário pertence ao setor ou é Administrador.
 */
export const checkSector = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return ApiResponse.error(res, 'Não autenticado.', 401);
  
  const targetSector = req.params.sector || req.query.sector || req.body.sector;
  
  if (req.user.role !== 'Administrador' && targetSector && req.user.sector !== targetSector) {
    return ApiResponse.error(res, 'Acesso negado. Você não pertence a este setor.', 403);
  }
  
  next();
};
