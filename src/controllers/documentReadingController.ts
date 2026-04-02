import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { DocumentReadingService } from '../services/documentReadingService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: documentId } = req.params;
  const user = req.user!;

  try {
    await DocumentReadingService.markAsRead(Number(documentId), user.id);
    return ApiResponse.success(res, null, 'Leitura registrada com sucesso. Aguardando confirmação do gestor.');
  } catch (err) {
    next(err);
  }
};

export const confirmReading = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { readingId } = req.params;
  const admin = req.user!;

  try {
    await DocumentReadingService.confirmReading(Number(readingId), admin.id, admin.role, admin.sector);
    return ApiResponse.success(res, null, 'Leitura confirmada com sucesso.');
  } catch (err) {
    next(err);
  }
};

export const listPendingReadings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const admin = req.user!;
  try {
    const readings = await DocumentReadingService.listPendingReadings(admin.sector, admin.role);
    return ApiResponse.success(res, readings);
  } catch (err) {
    next(err);
  }
};

export const getReadingStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: documentId } = req.params;
  const admin = req.user!;

  try {
    const stats = await DocumentReadingService.getReadingStats(Number(documentId), admin.sector);
    return ApiResponse.success(res, stats);
  } catch (err) {
    next(err);
  }
};
