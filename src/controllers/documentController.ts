import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/documentService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) return ApiResponse.error(res, 'Nenhum arquivo enviado', 400);
  
  const { title, sector, category, responsible, version, status, creation_date, approverIds, targetSectors, parent_id } = req.body;
  const user = (req as any).user;
  
  try {
    const newDocId = await DocumentService.uploadDocument(req.file, {
      title,
      sector,
      category,
      responsible,
      version,
      status,
      creation_date,
      approverIds: Array.isArray(approverIds) ? approverIds : (approverIds ? JSON.parse(approverIds) : []),
      targetSectors: Array.isArray(targetSectors) ? targetSectors : (targetSectors ? JSON.parse(targetSectors) : []),
      parent_id: parent_id ? Number(parent_id) : undefined
    }, user);

    return ApiResponse.success(res, { id: newDocId }, 'Documento enviado para aprovação com sucesso.', 201);
  } catch (err) {
    next(err);
  }
};

export const listDocuments = async (req: Request, res: Response, next: NextFunction) => {
  const { sector, category } = req.query;
  const user = (req as any).user;

  try {
    const groupedDocs = await DocumentService.listDocuments(user.id, {
      sector: sector as string,
      category: category as string
    });
    return ApiResponse.success(res, groupedDocs);
  } catch (err) {
    next(err);
  }
};

export const listPendingApprovals = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  try {
    const docs = await DocumentService.listPendingApprovals(userId);
    return ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
};

export const handleApprovalAction = async (req: Request, res: Response, next: NextFunction) => {
  const { id: docId } = req.params;
  const { action, reason } = req.body;
  const user = (req as any).user;

  try {
    await DocumentService.processApproval(Number(docId), user.id, user.sector, user.role, action, reason);
    return ApiResponse.success(res, null, `Documento ${action === 'Aprovado' ? 'aprovado' : 'rejeitado'} com sucesso.`);
  } catch (err) {
    next(err);
  }
};

export const favoriteDocument = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    await DocumentService.favorite(userId, Number(id));
    return ApiResponse.success(res, null, 'Documento favoritado com sucesso');
  } catch (err) {
    next(err);
  }
};

export const unfavoriteDocument = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    await DocumentService.unfavorite(userId, Number(id));
    return ApiResponse.success(res, null, 'Documento removido dos favoritos');
  } catch (err) {
    next(err);
  }
};

export const listFavorites = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  try {
    const docs = await DocumentService.listFavorites(userId);
    return ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const user = (req as any).user;
  try {
    await DocumentService.deleteDocument(Number(id), user.sector, user.role);
    return ApiResponse.success(res, null, 'Documento e todas as suas versões excluídos com sucesso');
  } catch (err) {
    next(err);
  }
};

export const updateDocumentStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = (req as any).user;

  try {
    await DocumentService.updateStatus(Number(id), status, user.sector, user.role);
    return ApiResponse.success(res, null, 'Status atualizado com sucesso');
  } catch (err) {
    next(err);
  }
};
