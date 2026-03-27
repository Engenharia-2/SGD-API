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
  const { title, sector, category, responsible, version, status, creation_date } = req.body;
  try {
    const [result]: any = await pool.query(
      'INSERT INTO documents (title, filename, original_name, mimetype, size, sector, category, responsible, version, status, creation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        creation_date || null
      ]
    );

    const newDocId = result.insertId;
    const newDoc = {
      id: newDocId,
      title: title || req.file.originalname,
      filename: req.file.filename,
      original_name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      sector,
      category,
      responsible,
      version,
      status,
      creation_date,
      uploaded_at: new Date().toISOString(),
      history: []
    };

    // Criar Notificação
    const notificationTitle = 'Novo Documento';
    const notificationMsg = `O documento "${newDoc.title}" foi adicionado ao setor ${sector}.`;
    
    const [notifResult]: any = await pool.query(
      'INSERT INTO notifications (title, message, sector, document_id, type) VALUES (?, ?, ?, ?, ?)',
      [notificationTitle, notificationMsg, sector, newDocId, 'info']
    );

    // Emitir evento para SSE
    notificationEmitter.emit('new_notification', {
      id: notifResult.insertId,
      title: notificationTitle,
      message: notificationMsg,
      sector: sector,
      document_id: newDocId,
      type: 'info',
      created_at: new Date()
    });

    res.status(201).json(newDoc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const listDocuments = async (req: Request, res: Response) => {
  const { sector, category } = req.query;
  const userId = (req as any).user?.id;

  try {
    let query = `
      SELECT d.*, 
      (SELECT COUNT(*) FROM user_favorites WHERE user_id = ? AND document_id = d.id) as is_favorite
      FROM documents d 
      WHERE 1=1
    `;
    const params: any[] = [userId];

    if (sector) { query += ' AND sector = ?'; params.push(sector); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY uploaded_at DESC';
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
      WHERE uf.user_id = ?
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
