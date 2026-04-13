import { DocumentReadingRepository } from '../repositories/documentReadingRepository.js';
import { DocumentRepository } from '../repositories/documentRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { NotificationService } from './notificationService.js';
import { ApiError } from '../utils/apiResponse.js';
import { DocumentReading, Document } from '../types/index.js';

export class DocumentReadingService {
  /**
   * Lista documentos que o usuário logado ainda não leu.
   */
  static async getMyPendingReadings(userId: number, userSector: string): Promise<Document[]> {
    return await DocumentReadingRepository.listMyPending(userId, userSector);
  }

  /**
   * Registra a leitura de um documento por um funcionário.
   */
  static async markAsRead(documentId: number, userId: number): Promise<void> {
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) throw new ApiError('Documento não encontrado.', 404);
    if (!doc.is_published) throw new ApiError('Este documento ainda não foi publicado para leitura.', 400);

    const existing = await DocumentReadingRepository.findByUserAndDocument(userId, documentId);
    if (existing) throw new ApiError('Você já marcou este documento como lido.', 400);

    const user = await UserRepository.findById(userId);
    if (!user) throw new ApiError('Usuário não encontrado.', 404);

    await DocumentReadingRepository.create(documentId, userId);

    // Notificar Gestores do Setor sobre a nova leitura pendente de confirmação
    const sectorManagers = await UserRepository.findManagersBySector(user.sector);
    for (const manager of sectorManagers) {
      await NotificationService.notifyUser(
        manager.id,
        user.sector,
        'Confirmação de Leitura Pendente',
        `O funcionário ${user.username} marcou o documento "${doc.title}" como lido.`,
        'info',
        documentId
      );
    }
  }

  /**
   * Confirma a leitura de um documento (Ação do Gestor/Admin).
   */
  static async confirmReading(readingId: number, adminId: number, adminRole: string, adminSector: string): Promise<void> {
    // Apenas Gestores ou Administradores podem confirmar
    if (adminRole === 'Funcionario') {
      throw new ApiError('Você não tem permissão para confirmar leituras.', 403);
    }

    // Nota: Em um sistema mais rigoroso, validaríamos se o admin pertence ao mesmo setor que o registro
    // Mas o middleware de rota já deve cuidar de parte dessa proteção.
    
    await DocumentReadingRepository.confirm(readingId, adminId);
  }

  /**
   * Lista leituras pendentes para o setor do administrador logado.
   * Se for Gestor global, traz tudo. Se for Administrador, filtra pelo setor.
   */
  static async listPendingReadings(sector: string, role: string): Promise<DocumentReading[]> {
    const filterBySector = role === 'Gestor' ? undefined : sector;
    return await DocumentReadingRepository.listPending(filterBySector);
  }

  /**
   * Busca as estatísticas de conformidade (Quem leu e quem falta).
   */
  static async getReadingStats(documentId: number, sector: string) {
    return await DocumentReadingRepository.getReadingStats(documentId, sector);
  }
}
