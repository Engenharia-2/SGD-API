import { NotificationService } from './notificationService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, User } from '../types/index.js';
import { DocumentRepository } from '../repositories/documentRepository.js';
import { ApiError } from '../utils/apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export class DocumentService {
  /**
   * Faz o upload de um novo documento e inicia o processo de aprovação.
   */
  static async uploadDocument(
    files: Express.Multer.File[],
    data: {
      doc_code?: string;
      title?: string;
      description?: string;
      sector: string;
      category: string;
      responsible?: string;
      version?: string;
      status?: string;
      creation_date?: string;
      approverIds: number[];
      targetSectors: string[];
      parent_id?: number;
    },
    user: { id: number, sector: string, role: string }
  ): Promise<number> {
    // Verificar se o setor do documento bate com o do usuário (ou se é Admin)
    if (user.role !== 'Administrador' && data.sector !== user.sector) {
      throw new ApiError('Você não tem permissão para enviar documentos para outro setor.', 403);
    }

    let finalCode = data.doc_code;

    // Se for uma nova versão, herdar o código do pai (caso não enviado)
    if (data.parent_id && !finalCode) {
      const parent = await DocumentRepository.findById(data.parent_id);
      if (parent) finalCode = parent.doc_code;
    } 
    // Se for novo e o código enviado parecer um prefixo (sem o hífen e número no final)
    else if (finalCode && !finalCode.includes('-')) {
      const nextNum = await DocumentRepository.getNextCodeNumber(finalCode);
      finalCode = `${finalCode}-${nextNum}`;
    }

    // Criar o registro principal (metadados)
    const firstFile = files[0];
    const newDocId = await DocumentRepository.create({
      ...data,
      doc_code: finalCode,
      filename: firstFile.filename,
      original_name: firstFile.originalname,
      mimetype: firstFile.mimetype,
      size: firstFile.size
    });

    // Inserir todos os arquivos na tabela document_files
    await DocumentRepository.addFiles(newDocId, files);

    // Inserir Aprovadores
    if (data.approverIds.length > 0) {
      await DocumentRepository.addApprovers(newDocId, data.approverIds);
    }

    // Inserir Visibilidade
    const sectors = data.targetSectors.length > 0 ? data.targetSectors : [data.sector];
    await DocumentRepository.addVisibility(newDocId, sectors);

    // Notificações
    for (const approverId of data.approverIds) {
      await NotificationService.notifyUser(
        approverId,
        data.sector,
        'Aprovação Pendente',
        `Você foi designado para aprovar o documento "${data.title || firstFile.originalname}".`,
        'warning',
        newDocId
      );
    }

    return newDocId;
  }

  /**
   * Lista documentos com filtros e agrupamento por histórico.
   */
  static async listDocuments(userId: number, filters: { sector?: string; category?: string }): Promise<Document[]> {
    const docs = await DocumentRepository.listPublished(userId, filters);

    const groupedDocs: Document[] = [];
    const rootMap = new Map<number, Document & { history: Document[] }>();

    docs.forEach((doc) => {
      const rootId = doc.parent_id || doc.id;
      const formattedDoc = { ...doc, is_favorite: !!doc.is_favorite };
      
      if (!rootMap.has(rootId)) {
        const docWithHistory = { ...formattedDoc, history: [] };
        rootMap.set(rootId, docWithHistory);
        groupedDocs.push(docWithHistory as unknown as Document);
      }
      
      rootMap.get(rootId)?.history.push(formattedDoc as Document);
    });

    return groupedDocs;
  }

  /**
   * Processa a ação de aprovação/rejeição.
   */
  static async processApproval(docId: number, userId: number, userSector: string, userRole: string, action: 'Aprovado' | 'Rejeitado', reason?: string): Promise<void> {
    const doc = await DocumentRepository.findById(docId);
    if (!doc) throw new ApiError('Documento não encontrado', 404);

    // Gestores e Funcionários só aprovam documentos de seus setores (ou visibilidade)
    // Para simplificar, vamos garantir que o documento pertença ao setor ou tenha visibilidade para ele
    if (userRole !== 'Administrador' && doc.sector !== userSector) {
      const visibility = await DocumentRepository.getVisibilitySectors(docId);
      if (!visibility.includes(userSector)) {
        throw new ApiError('Você não tem permissão para aprovar documentos de outro setor.', 403);
      }
    }

    await DocumentRepository.updateApprovalStatus(docId, userId, action, reason);

    if (action === 'Rejeitado') {
      await NotificationService.notifySector(
        doc.sector,
        'Documento Rejeitado',
        `Seu documento "${doc.title}" foi rejeitado. Motivo: ${reason}`,
        'error',
        docId
      );
    } else {
      const pendingCount = await DocumentRepository.getPendingApprovalsCount(docId);

      if (pendingCount === 0) {
        await DocumentRepository.updateStatus(docId, 'Aprovado', 1);

        const sectors = await DocumentRepository.getVisibilitySectors(docId);
        for (const s of sectors) {
          await NotificationService.notifySector(
            s,
            'Novo Documento Publicado',
            `O documento "${doc.title}" foi aprovado e já está disponível para o setor ${s}.`,
            'success',
            docId
          );
        }
      }
    }
  }

  /**
   * Exclui um documento e seus arquivos relacionados.
   */
  static async deleteDocument(docId: number, userSector: string, userRole: string): Promise<void> {
    const doc = await DocumentRepository.findById(docId);
    if (!doc) throw new ApiError('Documento não encontrado', 404);

    if (userRole !== 'Administrador' && doc.sector !== userSector) {
      throw new ApiError('Você não tem permissão para excluir documentos de outro setor.', 403);
    }

    const filenames = await DocumentRepository.getFilenamesToDelete(docId);
    
    for (const filename of filenames) {
      const filePath = path.join(UPLOADS_DIR, filename);
      try {
        await fs.unlink(filePath);
      } catch (err: unknown) {
        console.warn(`Aviso: Arquivo ${filename} não encontrado no disco.`);
      }
    }

    await DocumentRepository.delete(docId);
  }

  /**
   * Lista aprovações pendentes para um usuário específico.
   */
  static async listPendingApprovals(userId: number): Promise<Document[]> {
    return await DocumentRepository.listPendingApprovals(userId);
  }

  /**
   * Lista documentos favoritos de um usuário.
   */
  static async listFavorites(userId: number): Promise<Document[]> {
    return await DocumentRepository.listFavorites(userId);
  }

  /**
   * Atualiza o status de um documento e notifica o setor.
   */
  static async updateStatus(docId: number, status: string, userSector: string, userRole: string): Promise<void> {
    const doc = await DocumentRepository.findById(docId);
    if (!doc) throw new ApiError('Documento não encontrado', 404);

    if (userRole !== 'Administrador' && doc.sector !== userSector) {
      throw new ApiError('Você não tem permissão para alterar documentos de outro setor.', 403);
    }

    await DocumentRepository.updateStatus(docId, status, doc.is_published ? 1 : 0);

    await NotificationService.notifySector(
      doc.sector,
      'Status Alterado',
      `O status do documento "${doc.title}" foi alterado para "${status}" no setor ${doc.sector}.`,
      'info',
      docId
    );
  }

  /**
   * Adiciona aos favoritos.
   */
  static async favorite(userId: number, docId: number): Promise<void> {
    await DocumentRepository.addFavorite(userId, docId);
  }

  /**
   * Remove dos favoritos.
   */
  static async unfavorite(userId: number, docId: number): Promise<void> {
    await DocumentRepository.removeFavorite(userId, docId);
  }
}
