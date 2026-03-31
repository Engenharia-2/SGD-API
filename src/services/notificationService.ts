import { notificationEmitter } from '../config/events.js';
import { NotificationType } from '../types/index.js';
import { NotificationRepository } from '../repositories/notificationRepository.js';

export interface NotificationPayload {
  title: string;
  message: string;
  sector: string;
  document_id?: number | null;
  type?: NotificationType;
  target_user_id?: number | null;
}

export class NotificationService {
  /**
   * Cria uma nova notificação e a emite via SSE.
   */
  static async createNotification(payload: NotificationPayload): Promise<number> {
    const { title, message, sector, document_id = null, type = 'info', target_user_id = null } = payload;

    const notificationId = await NotificationRepository.create({
      title, message, sector, document_id, type
    });

    // Se houver um usuário alvo, vincular especificamente
    if (target_user_id) {
      await NotificationRepository.linkToUser(notificationId, target_user_id);
    }

    // Emitir via SSE
    notificationEmitter.emit('new_notification', {
      id: notificationId,
      title,
      message,
      sector,
      document_id,
      type,
      target_user_id,
      created_at: new Date()
    });

    return notificationId;
  }

  /**
   * Notifica um setor inteiro.
   */
  static async notifySector(sector: string, title: string, message: string, type: NotificationType = 'info', document_id?: number): Promise<void> {
    await this.createNotification({ sector, title, message, type, document_id });
  }

  /**
   * Notifica um usuário específico.
   */
  static async notifyUser(userId: number, sector: string, title: string, message: string, type: NotificationType = 'info', document_id?: number): Promise<void> {
    await this.createNotification({ target_user_id: userId, sector, title, message, type, document_id });
  }
}
