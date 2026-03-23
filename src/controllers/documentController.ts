import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const { title, sector, category } = req.body;
  try {
    const [result]: any = await pool.query(
      'INSERT INTO documents (title, filename, original_name, mimetype, size, sector, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title || req.file.originalname, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, sector, category]
    );
    res.status(201).json({ id: result.insertId, title, sector, category });
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
    const [docs] = await pool.query(query, params);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar documentos' });
  }
};
