import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { DocumentReadingService } from '../services/documentReadingService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const listMyPendingReadings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user!;
  try {
    const docs = await DocumentReadingService.getMyPendingReadings(user.id, user.sector);
    ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id: documentId } = req.params;
  const user = req.user!;

  try {
    await DocumentReadingService.markAsRead(Number(documentId), user.id);
    ApiResponse.success(res, null, 'Leitura registrada com sucesso. Aguardando confirmação do gestor.');
  } catch (err) {
    next(err);
  }
};

export const confirmReading = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { readingId } = req.params;
  const admin = req.user!;

  try {
    await DocumentReadingService.confirmReading(Number(readingId), admin.id, admin.role, admin.sector);
    ApiResponse.success(res, null, 'Leitura confirmada com sucesso.');
  } catch (err) {
    next(err);
  }
};

export const listPendingReadings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const admin = req.user!;
  try {
    const readings = await DocumentReadingService.listPendingReadings(admin.sector, admin.role);
    ApiResponse.success(res, readings);
  } catch (err) {
    next(err);
  }
};

export const getReadingStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id: documentId } = req.params;
  const admin = req.user!;

  try {
    const stats = await DocumentReadingService.getReadingStats(Number(documentId), admin.sector);
    ApiResponse.success(res, stats);
  } catch (err) {
    next(err);
  }
};
