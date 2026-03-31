import { Request, Response } from 'express';
import { pool } from '../config/db.js';
import { notificationEmitter } from '../config/events.js';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  const { userId, sector } = req.params;

  try {
    const [rows]: any = await pool.query(`
      SELECT n.*, IF(un.is_read IS NULL, 0, un.is_read) as is_read
      FROM notifications n
      LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_id = ?
      WHERE (n.sector = ? OR n.sector = 'Geral')
      AND (
        -- Mostrar se for uma notificação geral (sem entradas em user_notifications)
        NOT EXISTS (SELECT 1 FROM user_notifications un2 WHERE un2.notification_id = n.id)
        -- OU se for especificamente para este usuário
        OR un.user_id IS NOT NULL
      )
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId, sector]);

    res.json(rows);
  } catch (err) {
    console.error('[NotificationController] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  const { userId, notificationId } = req.params;

  try {
    // Usar REPLACE INTO para MySQL para simplificar a lógica de INSERT ou UPDATE
    await pool.query(`
      REPLACE INTO user_notifications (user_id, notification_id, is_read, read_at)
      VALUES (?, ?, 1, NOW())
    `, [userId, notificationId]);

    res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    console.error('[NotificationController] Erro ao marcar como lida:', err);
    res.status(500).json({ error: 'Erro ao marcar notificação' });
  }
};

export const streamNotifications = (req: Request, res: Response) => {
  const { sector } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Garantir CORS para SSE
  res.flushHeaders();

  const onNewNotification = (notification: any) => {
    if (notification.sector === sector || notification.sector === 'Geral') {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  };

  notificationEmitter.on('new_notification', onNewNotification);

  // Keep-alive ping
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    notificationEmitter.off('new_notification', onNewNotification);
    res.end();
  });
};
