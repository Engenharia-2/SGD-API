import { NotificationService } from './notificationService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, User, DocumentStatus } from '../types/index.js';
import { DocumentRepository } from '../repositories/documentRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/apiResponse.js';
import { pool } from '../config/db.js';

import { DocumentMapper } from '../utils/documentMapper.js';
import { DocumentPolicy } from '../policies/documentPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export class DocumentService {
  /**
   * Faz o upload de um novo documento e inicia o processo de aprovação.
   * Utiliza transação para garantir integridade dos dados (Metadados + Arquivos + Aprovadores + Visibilidade).
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
      status?: DocumentStatus;
      creation_date?: string;
      approverIds: number[];
      targetSectors: string[];
      parent_id?: number;
    },
    user: { id: number, sector: string, role: string }
  ): Promise<number> {
    // 1. Validação de Política
    DocumentPolicy.canUpload(user, data.sector);

    let finalCode = data.doc_code;
    let fileMetadata = {
      filename: '',
      original_name: '',
      mimetype: '',
      size: 0
    };

    // Se houver arquivos novos, pega os dados do primeiro
    if (files && files.length > 0) {
      fileMetadata = {
        filename: files[0].filename,
        original_name: files[0].originalname,
        mimetype: files[0].mimetype,
        size: files[0].size
      };
    }

    // Se for uma nova versão, herdar dados do pai se necessário
    if (data.parent_id) {
      const parent = await DocumentRepository.findById(data.parent_id);
      if (parent) {
        if (!finalCode) finalCode = parent.doc_code;
        if (!files || files.length === 0) {
          fileMetadata = {
            filename: parent.filename,
            original_name: parent.original_name,
            mimetype: parent.mimetype,
            size: parent.size
          };
        }
      }
    } else if (finalCode && !finalCode.includes('-')) {
      const nextNum = await DocumentRepository.getNextCodeNumber(finalCode);
      finalCode = `${finalCode}-${nextNum}`;
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 2. Criar o registro principal (metadados)
      const newDocId = await DocumentRepository.create({
        ...data,
        doc_code: finalCode,
        ...fileMetadata
      }, connection);

      // 3. Inserir todos os arquivos na tabela document_files
      if (files && files.length > 0) {
        await DocumentRepository.addFiles(newDocId, files, connection);
      }

      // 4. Inserir Aprovadores
      if (data.approverIds.length > 0) {
        await DocumentRepository.addApprovers(newDocId, data.approverIds, connection);
      }

      // 5. Inserir Visibilidade
      const sectors = data.targetSectors.length > 0 ? data.targetSectors : [data.sector];
      await DocumentRepository.addVisibility(newDocId, sectors, connection);

      await connection.commit();

      // Notificações (fora da transação para não travar o banco com chamadas externas/IO)
      const notificationTitle = data.title || fileMetadata.original_name || 'Novo Documento';
      for (const approverId of data.approverIds) {
        await NotificationService.notifyUser(
          approverId,
          data.sector,
          'Aprovação Pendente',
          `Você foi designado para aprovar o documento "${notificationTitle}".`,
          'warning',
          newDocId
        );
      }

      return newDocId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Lista documentos com filtros e agrupamento por histórico.
   */
  static async listDocuments(userId: number, filters: { sector?: string; category?: string }): Promise<Document[]> {
    const docs = await DocumentRepository.listPublished(userId, filters);
    return DocumentMapper.toHistoryGroup(docs);
  }

  /**
   * Processa a ação de aprovação/rejeição.
   */
  static async processApproval(docId: number, userId: number, userSector: string, userRole: string, action: 'Aprovado' | 'Rejeitado', reason?: string): Promise<void> {
    const doc = await DocumentRepository.findById(docId);
    if (!doc) throw new ApiError('Documento não encontrado', 404);

    const visibilitySectors = await DocumentRepository.getVisibilitySectors(docId);
    DocumentPolicy.canApprove({ id: userId, sector: userSector, role: userRole }, doc, visibilitySectors);

    await DocumentRepository.updateApprovalStatus(docId, userId, action, reason);

    if (action === 'Rejeitado') {
      let targetUserId: number | null = null;
      if (doc.responsible) {
        const creator = await UserRepository.findByUsername(doc.responsible);
        if (creator) targetUserId = creator.id;
      }

      if (targetUserId) {
        await NotificationService.notifyUser(
          targetUserId,
          doc.sector,
          'Documento Rejeitado',
          `Seu documento "${doc.title}" foi rejeitado. Motivo: ${reason}`,
          'error',
          docId
        );
      } else {
        await NotificationService.notifySector(
          doc.sector,
          'Documento Rejeitado',
          `O documento "${doc.title}" (Responsável: ${doc.responsible || 'N/A'}) foi rejeitado. Motivo: ${reason}`,
          'error',
          docId
        );
      }
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

    // Validação via Policy (Apenas Admin ou Gestor do setor)
    DocumentPolicy.canManage({ id: 0, sector: userSector, role: userRole }, doc);

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

    // Validação via Policy (Apenas Admin ou Gestor do setor)
    DocumentPolicy.canManage({ id: 0, sector: userSector, role: userRole }, doc);

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
