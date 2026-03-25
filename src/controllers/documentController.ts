import { Request, Response } from 'express';
import { pool } from '../config/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const newDoc = {
      id: result.insertId,
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
      uploaded_at: new Date().toISOString()
    };

    res.status(201).json(newDoc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const listDocuments = async (req: Request, res: Response) => {
  const { sector, category } = req.query;
  try {
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    if (sector) { query += ' AND sector = ?'; params.push(sector); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY uploaded_at DESC';
    const [docs]: any = await pool.query(query, params);

    // Agrupar versões: Apenas o mais recente como principal, e os outros no array history
    const groupedDocs: any[] = [];
    const rootMap = new Map<number, any>();

    docs.forEach((doc: any) => {
      const rootId = doc.parent_id || doc.id;
      if (!rootMap.has(rootId)) {
        const docWithHistory = { ...doc, history: [] };
        rootMap.set(rootId, docWithHistory);
        groupedDocs.push(docWithHistory);
      }
      
      rootMap.get(rootId).history.push({
        id: doc.id,
        version: doc.version,
        filename: doc.filename,
        original_name: doc.original_name,
        uploaded_at: doc.uploaded_at,
        responsible: doc.responsible,
        status: doc.status,
        creation_date: doc.creation_date,
        title: doc.title,
        size: doc.size,
        mimetype: doc.mimetype
      });
    });

    res.json(groupedDocs);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar documentos: ' + err.message });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // 1. Buscar todas as versões do grupo (seja o ID passado ou quem tem esse ID como parent_id)
    const [docs]: any = await pool.query(
      'SELECT filename FROM documents WHERE id = ? OR parent_id = ?', 
      [id, id]
    );
    
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    // 2. Excluir os arquivos físicos de todas as versões
    for (const doc of docs) {
      const filePath = path.join(__dirname, '../../uploads', doc.filename);
      try {
        await fs.unlink(filePath);
      } catch (err: any) {
        console.warn(`Aviso: Arquivo ${doc.filename} não encontrado no disco para exclusão.`);
      }
    }

    // 3. Excluir os registros do banco (o original e as versões filhas)
    await pool.query('DELETE FROM documents WHERE id = ? OR parent_id = ?', [id, id]);

    res.json({ message: 'Documento e todas as suas versões excluídos com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao excluir documento: ' + err.message });
  }
};

export const updateDocument = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, responsible, version, status, creation_date, sector, category } = req.body;
  const newFile = req.file;

  try {
    // 1. Buscar o documento atual para saber se ele já é uma versão
    const [docs]: any = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    const currentDoc = docs[0];
    const parentId = currentDoc.parent_id || currentDoc.id;

    // 2. SEMPRE criar um novo registro em vez de sobrescrever o antigo (Estratégia de Versionamento)
    // Se não houver arquivo novo, usamos os dados do arquivo atual
    const fileNameToSave = newFile ? newFile.filename : currentDoc.filename;
    const originalNameToSave = newFile ? newFile.originalname : currentDoc.original_name;
    const mimetypeToSave = newFile ? newFile.mimetype : currentDoc.mimetype;
    const sizeToSave = newFile ? newFile.size : currentDoc.size;

    await pool.query(
      'INSERT INTO documents (title, filename, original_name, mimetype, size, sector, category, responsible, version, status, creation_date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title || currentDoc.title,
        fileNameToSave,
        originalNameToSave,
        mimetypeToSave,
        sizeToSave,
        sector || currentDoc.sector,
        category || currentDoc.category,
        responsible,
        version,
        status,
        creation_date,
        parentId
      ]
    );

    res.json({ message: 'Nova versão do documento salva com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao criar versão do documento: ' + err.message });
  }
};
