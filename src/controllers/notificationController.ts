import { Request, Response, NextFunction } from 'express';
import { notificationEmitter } from '../config/events.js';
import { Notification } from '../types/index.js';
import { NotificationRepository } from '../repositories/notificationRepository.js';
import { ApiResponse, ApiError } from '../utils/apiResponse.js';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId, sector } = req.params;
  const user = (req as any).user;

  try {
    // Apenas o próprio usuário ou Administrador pode ver estas notificações
    if (user.role !== 'Administrador' && Number(userId) !== user.id) {
      throw new ApiError('Você não tem permissão para visualizar estas notificações.', 403);
    }

    const rows = await NotificationRepository.listByUser(Number(userId), sector);
    return ApiResponse.success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId, notificationId } = req.params;
  const user = (req as any).user;

  try {
    // Apenas o próprio usuário ou Administrador pode marcar como lida
    if (user.role !== 'Administrador' && Number(userId) !== user.id) {
      throw new ApiError('Você não tem permissão para esta operação.', 403);
    }

    await NotificationRepository.markAsRead(Number(userId), Number(notificationId));
    return ApiResponse.success(res, null, 'Notificação marcada como lida');
  } catch (err) {
    next(err);
  }
};

export const streamNotifications = (req: Request, res: Response) => {
  const { sector } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.flushHeaders();

  const onNewNotification = (notification: Notification) => {
    if (notification.sector === sector || notification.sector === 'Geral') {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  };

  notificationEmitter.on('new_notification', onNewNotification);

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
