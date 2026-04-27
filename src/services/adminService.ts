import { User } from '../types/index.js';
import { UserRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/apiResponse.js';
import bcrypt from 'bcryptjs';

export class AdminService {
  /**
   * Lista usuários do sistema com base na permissão do solicitante.
   * Gestores veem tudo, Administradores veem apenas o seu setor.
   */
  static async listAllUsers(role: string, sector: string): Promise<User[]> {
    const sectorFilter = role === 'Gestor' ? undefined : sector;
    return await UserRepository.listAll(sectorFilter);
  }

  /**
   * Autoriza um novo usuário.
   */
  static async authorizeUser(userId: number): Promise<void> {
    const success = await UserRepository.authorize(userId);
    if (!success) {
      throw new ApiError('Usuário não encontrado', 404);
    }
  }

  /**
   * Remove um usuário.
   */
  static async deleteUser(userId: number): Promise<void> {
    const success = await UserRepository.delete(userId);
    if (!success) {
      throw new ApiError('Usuário não encontrado', 404);
    }
  }

  /**
   * Redefine a senha de um usuário para uma senha temporária.
   */
  static async resetPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const success = await UserRepository.updatePassword(userId, hashedPassword);
    if (!success) {
      throw new ApiError('Usuário não encontrado', 404);
    }
  }
}
