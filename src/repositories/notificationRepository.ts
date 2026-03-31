import { pool } from '../config/db.js';
import { Notification, ResultSetHeader } from '../types/index.js';

export class NotificationRepository {
  static async create(data: {
    title: string;
    message: string;
    sector: string;
    document_id: number | null;
    type: string;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO notifications (title, message, sector, document_id, type) VALUES (?, ?, ?, ?, ?)',
      [data.title, data.message, data.sector, data.document_id, data.type]
    );
    return result.insertId;
  }

  static async linkToUser(notificationId: number, userId: number): Promise<void> {
    await pool.query(
      'INSERT IGNORE INTO user_notifications (notification_id, user_id, is_read) VALUES (?, ?, ?)',
      [notificationId, userId, 0]
    );
  }

  static async listByUser(userId: number, sector: string): Promise<Notification[]> {
    const [rows] = await pool.query<Notification[]>(`
      SELECT n.*, IF(un.is_read IS NULL, 0, un.is_read) as is_read
      FROM notifications n
      LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_id = ?
      WHERE (n.sector = ? OR n.sector = 'Geral')
      AND (
        NOT EXISTS (SELECT 1 FROM user_notifications un2 WHERE un2.notification_id = n.id)
        OR un.user_id IS NOT NULL
      )
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId, sector]);
    return rows;
  }

  static async markAsRead(userId: number, notificationId: number): Promise<void> {
    await pool.query(`
      REPLACE INTO user_notifications (user_id, notification_id, is_read, read_at)
      VALUES (?, ?, 1, NOW())
    `, [userId, notificationId]);
  }
}
