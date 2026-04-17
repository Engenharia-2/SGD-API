import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { DocumentService } from '../services/documentService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const files = req.files as Express.Multer.File[];
  const { 
    doc_code, 
    title, 
    description,
    sector, 
    category, 
    responsible, 
    revision_period_years,
    version, 
    status, 
    creation_date, 
    approverIds, 
    targetSectors, 
    parent_id 
  } = req.body;

  // Se não for uma nova versão (parent_id ausente), arquivos são obrigatórios
  if (!parent_id && (!files || files.length === 0)) {
    ApiResponse.error(res, 'Nenhum arquivo enviado', 400);
    return;
  }
  
  const user = req.user!;
  
  try {
    const newDocId = await DocumentService.uploadDocument(files, {
      doc_code,
      title,
      description,
      sector,
      category,
      responsible,
      revision_period_years: revision_period_years ? Number(revision_period_years) : undefined,
      version,
      status,
      creation_date,
      approverIds: Array.isArray(approverIds) ? approverIds : (approverIds ? JSON.parse(approverIds) : []),
      targetSectors: Array.isArray(targetSectors) ? targetSectors : (targetSectors ? JSON.parse(targetSectors) : []),
      parent_id: parent_id ? Number(parent_id) : undefined
    }, user);

    ApiResponse.success(res, { id: newDocId }, 'Documento enviado para aprovação com sucesso.', 201);
  } catch (err) {
    next(err);
  }
};

export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { sector, category } = req.query;
  const user = req.user!;

  try {
    const groupedDocs = await DocumentService.listDocuments(user.id, {
      sector: sector as string,
      category: category as string
    });
    ApiResponse.success(res, groupedDocs);
  } catch (err) {
    next(err);
  }
};

export const listPendingApprovals = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    ApiResponse.error(res, 'Não autenticado', 401);
    return;
  }
  try {
    const docs = await DocumentService.listPendingApprovals(userId);
    ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
};

export const handleApprovalAction = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id: docId } = req.params;
  const { action, reason } = req.body;
  const user = req.user!;

  try {
    await DocumentService.processApproval(Number(docId), user.id, user.sector, user.role, action, reason);
    ApiResponse.success(res, null, `Documento ${action === 'Aprovado' ? 'aprovado' : 'rejeitado'} com sucesso.`);
  } catch (err) {
    next(err);
  }
};

export const favoriteDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    ApiResponse.error(res, 'Não autenticado', 401);
    return;
  }

  try {
    await DocumentService.favorite(userId, Number(id));
    ApiResponse.success(res, null, 'Documento favoritado com sucesso');
  } catch (err) {
    next(err);
  }
};

export const unfavoriteDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    ApiResponse.error(res, 'Não autenticado', 401);
    return;
  }

  try {
    await DocumentService.unfavorite(userId, Number(id));
    ApiResponse.success(res, null, 'Documento removido dos favoritos');
  } catch (err) {
    next(err);
  }
};

export const listFavorites = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    ApiResponse.error(res, 'Não autenticado', 401);
    return;
  }
  try {
    const docs = await DocumentService.listFavorites(userId);
    ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  try {
    await DocumentService.deleteDocument(Number(id), user.sector, user.role);
    ApiResponse.success(res, null, 'Documento e todas as suas versões excluídos com sucesso');
  } catch (err) {
    next(err);
  }
};

export const updateDocumentStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user!;

  try {
    await DocumentService.updateStatus(Number(id), status, user.sector, user.role);
    ApiResponse.success(res, null, 'Status atualizado com sucesso');
  } catch (err) {
    next(err);
  }
};
