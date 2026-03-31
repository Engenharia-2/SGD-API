import { Request, Response } from 'express';
import { pool } from '../config/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { notificationEmitter } from '../config/events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  
  // approverIds e targetSectors virão como strings (JSON ou separadas por vírgula) devido ao FormData
  const { title, sector, category, responsible, version, status, creation_date, approverIds, targetSectors, parent_id } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const [result]: any = await connection.query(
      'INSERT INTO documents (title, filename, original_name, mimetype, size, sector, category, responsible, version, status, is_published, creation_date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title || req.file.originalname, 
        req.file.filename, 
        req.file.originalname, 
        req.file.mimetype, 
        req.file.size, 
        sector, 
        category,
        responsible || null,
        version || '1.0',
        status || 'Revisão',
        0, // is_published inicia sempre como 0 (falso)
        creation_date || null,
        parent_id || null
      ]
    );

    const newDocId = result.insertId;

    // 1. Inserir Aprovadores
    const approvers = Array.isArray(approverIds) ? approverIds : (approverIds ? JSON.parse(approverIds) : []);
    if (approvers.length > 0) {
      const approvalValues = approvers.map((userId: number) => [newDocId, userId, 'Pendente']);
      await connection.query(
        'INSERT INTO document_approvals (document_id, user_id, status) VALUES ?',
        [approvalValues]
      );
    }

    // 2. Inserir Visibilidade por Setor
    const sectors = Array.isArray(targetSectors) ? targetSectors : (targetSectors ? JSON.parse(targetSectors) : [sector]);
    const visibilityValues = sectors.map((s: string) => [newDocId, s]);
    await connection.query(
      'INSERT INTO document_visibility (document_id, sector_name) VALUES ?',
      [visibilityValues]
    );

    await connection.commit();

    // 3. Notificar Aprovadores (Fora da transação para não travar se o SSE falhar)
    for (const approverId of approvers) {
      const notificationTitle = 'Aprovação Pendente';
      const notificationMsg = `Você foi designado para aprovar o documento "${title || req.file.originalname}".`;
      
      const [notifResult]: any = await pool.query(
        'INSERT INTO notifications (title, message, sector, document_id, type) VALUES (?, ?, ?, ?, ?)',
        [notificationTitle, notificationMsg, sector, newDocId, 'warning']
      );

      // Vincular notificação ao usuário específico (se tivermos a tabela user_notifications configurada para isso)
      await pool.query(
        'INSERT IGNORE INTO user_notifications (notification_id, user_id, is_read) VALUES (?, ?, ?)',
        [notifResult.insertId, approverId, 0]
      );

      // Emitir evento SSE segmentado por usuário
      notificationEmitter.emit('new_notification', {
        id: notifResult.insertId,
        title: notificationTitle,
        message: notificationMsg,
        sector: sector,
        document_id: newDocId,
        type: 'warning',
        target_user_id: approverId, // Adicionado para filtragem no frontend
        created_at: new Date()
      });
    }

    res.status(201).json({ 
      id: newDocId, 
      message: 'Documento enviado para aprovação com sucesso.',
      is_published: 0 
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const listDocuments = async (req: Request, res: Response) => {
  const { sector, category } = req.query;
  const user = (req as any).user;

  try {
    // Usuários comuns só vêem publicados e que estão em seus setores visíveis
    // Gestores/Admins vêem tudo do seu setor ou setores visíveis
    let query = `
      SELECT DISTINCT d.*, 
      (SELECT COUNT(*) FROM user_favorites WHERE user_id = ? AND document_id = d.id) as is_favorite
      FROM documents d 
      LEFT JOIN document_visibility dv ON d.id = dv.document_id
      WHERE 1=1
    `;
    const params: any[] = [user.id];

    // Apenas documentos publicados aparecem na listagem geral para todos os usuários
    query += ' AND d.is_published = 1';

    // Filtrar por setor (seja o setor original ou via visibilidade)
    if (sector) {
      query += ' AND (d.sector = ? OR dv.sector_name = ?)';
      params.push(sector, sector);
    }

    if (category) {
      query += ' AND d.category = ?';
      params.push(category);
    }

    query += ' ORDER BY d.uploaded_at DESC';
    const [docs]: any = await pool.query(query, params);

    const groupedDocs: any[] = [];
    const rootMap = new Map<number, any>();

    docs.forEach((doc: any) => {
      const rootId = doc.parent_id || doc.id;
      const formattedDoc = { ...doc, is_favorite: !!doc.is_favorite };
      
      if (!rootMap.has(rootId)) {
        const docWithHistory = { ...formattedDoc, history: [] };
        rootMap.set(rootId, docWithHistory);
        groupedDocs.push(docWithHistory);
      }
      
      rootMap.get(rootId).history.push(formattedDoc);
    });

    res.json(groupedDocs);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar documentos: ' + err.message });
  }
};

export const listPendingApprovals = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const query = `
      SELECT d.*, da.status as my_approval_status
      FROM documents d
      JOIN document_approvals da ON d.id = da.document_id
      WHERE da.user_id = ? AND da.status = 'Pendente'
      ORDER BY d.uploaded_at DESC
    `;
    const [docs]: any = await pool.query(query, [userId]);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar aprovações pendentes: ' + err.message });
  }
};

export const handleApprovalAction = async (req: Request, res: Response) => {
  const { id: docId } = req.params;
  const { action, reason } = req.body; // action: 'Aprovado' ou 'Rejeitado'
  const userId = (req as any).user?.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Atualizar o status da aprovação individual
    await connection.query(
      'UPDATE document_approvals SET status = ?, rejection_reason = ? WHERE document_id = ? AND user_id = ?',
      [action, action === 'Rejeitado' ? reason : null, docId, userId]
    );

    // Buscar dados do documento para notificações
    const [[doc]]: any = await connection.query('SELECT * FROM documents WHERE id = ?', [docId]);

    if (action === 'Rejeitado') {
      // Notificar o autor sobre a rejeição
      const notificationTitle = 'Documento Rejeitado';
      const notificationMsg = `Seu documento "${doc.title}" foi rejeitado. Motivo: ${reason}`;
      
      const [notifResult]: any = await connection.query(
        'INSERT INTO notifications (title, message, sector, document_id, type) VALUES (?, ?, ?, ?, ?)',
        [notificationTitle, notificationMsg, doc.sector, docId, 'error']
      );

      // Notificar o autor especificamente (se encontrarmos o autor por responsável ou outra lógica)
      // Por simplicidade aqui, vamos disparar para o setor original
      notificationEmitter.emit('new_notification', {
        id: notifResult.insertId,
        title: notificationTitle,
        message: notificationMsg,
        sector: doc.sector,
        document_id: docId,
        type: 'error',
        created_at: new Date()
      });
    } else {
      // Se aprovado, verificar se todos os outros também aprovaram
      const [[{ pendingCount }]]: any = await connection.query(
        'SELECT COUNT(*) as pendingCount FROM document_approvals WHERE document_id = ? AND status != "Aprovado"',
        [docId]
      );

      if (pendingCount === 0) {
        // Publicar o documento!
        await connection.query('UPDATE documents SET is_published = 1, status = "Aprovado" WHERE id = ?', [docId]);

        // Notificar setores de visibilidade
        const [sectors]: any = await connection.query('SELECT sector_name FROM document_visibility WHERE document_id = ?', [docId]);
        
        for (const s of sectors) {
          const notificationTitle = 'Novo Documento Publicado';
          const notificationMsg = `O documento "${doc.title}" foi aprovado e já está disponível para o setor ${s.sector_name}.`;
          
          const [notifResult]: any = await connection.query(
            'INSERT INTO notifications (title, message, sector, document_id, type) VALUES (?, ?, ?, ?, ?)',
            [notificationTitle, notificationMsg, s.sector_name, docId, 'success']
          );

          notificationEmitter.emit('new_notification', {
            id: notifResult.insertId,
            title: notificationTitle,
            message: notificationMsg,
            sector: s.sector_name,
            document_id: docId,
            type: 'success',
            created_at: new Date()
          });
        }
      }
    }

    await connection.commit();
    res.json({ message: `Documento ${action === 'Aprovado' ? 'aprovado' : 'rejeitado'} com sucesso.` });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const favoriteDocument = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    await pool.query(
      'INSERT IGNORE INTO user_favorites (user_id, document_id) VALUES (?, ?)',
      [userId, id]
    );
    res.json({ message: 'Documento favoritado com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao favoritar: ' + err.message });
  }
};

export const unfavoriteDocument = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    await pool.query(
      'DELETE FROM user_favorites WHERE user_id = ? AND document_id = ?',
      [userId, id]
    );
    res.json({ message: 'Documento removido dos favoritos' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao remover favorito: ' + err.message });
  }
};

export const listFavorites = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const query = `
      SELECT d.*, 1 as is_favorite
      FROM documents d
      JOIN user_favorites uf ON d.id = uf.document_id
      WHERE uf.user_id = ? AND d.is_published = 1
      ORDER BY uf.created_at DESC
    `;
    const [docs]: any = await pool.query(query, [userId]);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar favoritos: ' + err.message });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [docs]: any = await pool.query(
      'SELECT filename FROM documents WHERE id = ? OR parent_id = ?', 
      [id, id]
    );
    
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    for (const doc of docs) {
      const filePath = path.join(UPLOADS_DIR, doc.filename);
      try {
        await fs.unlink(filePath);
      } catch (err: any) {
        console.warn(`Aviso: Arquivo ${doc.filename} não encontrado no disco.`);
      }
    }

    await pool.query('DELETE FROM documents WHERE id = ? OR parent_id = ?', [id, id]);

    res.json({ message: 'Documento e todas as suas versões excluídos com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao excluir documento: ' + err.message });
  }
};

export const updateDocumentStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const [docs]: any = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
    if (docs.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });

    const doc = docs[0];
    await pool.query('UPDATE documents SET status = ? WHERE id = ?', [status, id]);

    // Notificação de Alteração de Status
    const notificationTitle = 'Status Alterado';
    const notificationMsg = `O status do documento "${doc.title}" foi alterado para "${status}" no setor ${doc.sector}.`;
    
    const [notifResult]: any = await pool.query(
      'INSERT INTO notifications (title, message, sector, document_id, type) VALUES (?, ?, ?, ?, ?)',
      [notificationTitle, notificationMsg, doc.sector, id, 'info']
    );

    notificationEmitter.emit('new_notification', {
      id: notifResult.insertId,
      title: notificationTitle,
      message: notificationMsg,
      sector: doc.sector,
      document_id: id,
      type: 'info',
      created_at: new Date()
    });

    res.json({ message: 'Status atualizado com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar status: ' + err.message });
  }
};
