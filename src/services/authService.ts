import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserBase } from '../types/index.js';
import { UserRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/apiResponse.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    sector: string;
    role: string;
  };
}

export class AuthService {
  /**
   * Registra um novo usuário no sistema com senha criptografada.
   */
  static async register(userData: Partial<UserBase> & { password?: string }): Promise<void> {
    const existing = await UserRepository.findByUsername(userData.username || '');
    if (existing) {
      throw new ApiError('Usuário já existe', 400);
    }

    if (!userData.password) {
      throw new ApiError('Senha é obrigatória', 400);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    await UserRepository.create({ ...userData, password: hashedPassword });
  }

  /**
   * Autentica um usuário e gera um token JWT.
   */
  static async login(username?: string, password?: string): Promise<AuthResponse> {
    if (!username || !password) {
      throw new ApiError('Usuário e senha são obrigatórios', 400);
    }

    const user = await UserRepository.findByUsername(username);

    if (!user || !(await bcrypt.compare(password, user.password || ''))) {
      throw new ApiError('Credenciais inválidas', 401);
    }

    if (!user.is_authorized) {
      throw new ApiError('Sua conta ainda não foi autorizada.', 403);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, sector: user.sector, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        sector: user.sector,
        role: user.role
      }
    };
  }

  /**
   * Altera a senha do usuário autenticado.
   */
  static async changePassword(userId: number, currentPassword?: string, newPassword?: string): Promise<void> {
    if (!currentPassword || !newPassword) {
      throw new ApiError('Senha atual e nova senha são obrigatórias', 400);
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new ApiError('Usuário não encontrado', 404);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password || '');
    if (!isMatch) {
      throw new ApiError('Senha atual incorreta', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserRepository.updatePassword(userId, hashedPassword);
  }
}
