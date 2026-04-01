import { pool } from '../config/db.js';
import { Document, ResultSetHeader } from '../types/index.js';
import { RowDataPacket } from 'mysql2';

export class DocumentRepository {
  static async create(data: any): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO documents (doc_code, title, description, filename, original_name, mimetype, size, sector, category, responsible, version, status, is_published, creation_date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.doc_code || null,
        data.title, 
        data.description || null,
        data.filename || null, 
        data.original_name || null, 
        data.mimetype || null, 
        data.size || null,
        data.sector, data.category, data.responsible, data.version, data.status,
        0, data.creation_date, data.parent_id
      ]
    );
    return result.insertId;
  }

  static async getNextCodeNumber(prefix: string): Promise<number> {
    // Busca o maior número após o prefixo (ex: PQS-5 -> retorna 5)
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT doc_code FROM documents WHERE doc_code LIKE ? ORDER BY CAST(SUBSTRING_INDEX(doc_code, '-', -1) AS UNSIGNED) DESC LIMIT 1",
      [`${prefix}-%`]
    );

    if (rows.length === 0) return 1;
    
    const lastCode = rows[0].doc_code;
    const parts = lastCode.split('-');
    const lastNumber = parseInt(parts[parts.length - 1]);
    
    return isNaN(lastNumber) ? 1 : lastNumber + 1;
  }

  static async addFiles(docId: number, files: Express.Multer.File[]): Promise<void> {
    if (files.length === 0) return;
    const values = files.map(file => [
      docId, 
      file.filename, 
      file.originalname, 
      file.mimetype, 
      file.size
    ]);
    await pool.query(
      'INSERT INTO document_files (document_id, filename, original_name, mimetype, size) VALUES ?', 
      [values]
    );
  }

  static async findById(id: number): Promise<Document | null> {
    const [rows] = await pool.query<Document[]>('SELECT * FROM documents WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async listPublished(userId: number, filters: { sector?: string, category?: string }): Promise<Document[]> {
    let query = `
      SELECT DISTINCT d.*, 
      (SELECT COUNT(*) FROM user_favorites WHERE user_id = ? AND document_id = d.id) as is_favorite
      FROM documents d 
      LEFT JOIN document_visibility dv ON d.id = dv.document_id
      WHERE d.is_published = 1
    `;
    const params: (string | number)[] = [userId];

    if (filters.sector) {
      query += ' AND (d.sector = ? OR dv.sector_name = ?)';
      params.push(filters.sector, filters.sector);
    }

    if (filters.category) {
      query += ' AND d.category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY d.uploaded_at DESC';
    const [docs] = await pool.query<Document[]>(query, params);

    // Buscar arquivos para cada documento
    for (const doc of docs) {
      const [files] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM document_files WHERE document_id = ?',
        [doc.id]
      );
      (doc as any).files = files;
    }

    return docs;
  }

  static async listPendingApprovals(userId: number): Promise<Document[]> {
    const query = `
      SELECT d.*, da.status as my_approval_status
      FROM documents d
      JOIN document_approvals da ON d.id = da.document_id
      WHERE da.user_id = ? AND da.status = 'Pendente'
      ORDER BY d.uploaded_at DESC
    `;
    const [docs] = await pool.query<Document[]>(query, [userId]);

    for (const doc of docs) {
      const [files] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM document_files WHERE document_id = ?',
        [doc.id]
      );
      (doc as any).files = files;
    }

    return docs;
  }

  static async updateStatus(id: number, status: string, isPublished: number = 0): Promise<void> {
    await pool.query('UPDATE documents SET status = ?, is_published = ? WHERE id = ?', [status, isPublished, id]);
  }

  static async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM documents WHERE id = ? OR parent_id = ?', [id, id]);
  }

  static async getFilenamesToDelete(id: number): Promise<string[]> {
    const [docs] = await pool.query<Document[]>(
      'SELECT filename FROM documents WHERE id = ? OR parent_id = ?', 
      [id, id]
    );
    
    const [files] = await pool.query<RowDataPacket[]>(
      'SELECT filename FROM document_files WHERE document_id = ? OR document_id IN (SELECT id FROM documents WHERE parent_id = ?)',
      [id, id]
    );

    const docFilenames = docs.map(d => d.filename).filter(f => f !== null);
    const extraFilenames = files.map(f => f.filename);
    
    return [...new Set([...docFilenames, ...extraFilenames])];
  }

  // Métodos Auxiliares (Aprovações e Visibilidade)
  static async addApprovers(docId: number, approverIds: number[]): Promise<void> {
    const values = approverIds.map(userId => [docId, userId, 'Pendente']);
    await pool.query('INSERT INTO document_approvals (document_id, user_id, status) VALUES ?', [values]);
  }

  static async addVisibility(docId: number, sectors: string[]): Promise<void> {
    const values = sectors.map(s => [docId, s]);
    await pool.query('INSERT INTO document_visibility (document_id, sector_name) VALUES ?', [values]);
  }

  static async updateApprovalStatus(docId: number, userId: number, status: string, reason?: string): Promise<void> {
    await pool.query(
      'UPDATE document_approvals SET status = ?, rejection_reason = ? WHERE document_id = ? AND user_id = ?',
      [status, reason || null, docId, userId]
    );
  }

  static async getPendingApprovalsCount(docId: number): Promise<number> {
    const [results] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as pendingCount FROM document_approvals WHERE document_id = ? AND status != "Aprovado"',
      [docId]
    );
    return results[0].pendingCount;
  }

  static async getVisibilitySectors(docId: number): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT sector_name FROM document_visibility WHERE document_id = ?', [docId]);
    return rows.map(r => r.sector_name);
  }

  // Favoritos
  static async listFavorites(userId: number): Promise<Document[]> {
    const query = `
      SELECT d.*, 1 as is_favorite
      FROM documents d
      JOIN user_favorites uf ON d.id = uf.document_id
      WHERE uf.user_id = ? AND d.is_published = 1
      ORDER BY uf.created_at DESC
    `;
    const [docs] = await pool.query<Document[]>(query, [userId]);
    return docs;
  }

  static async addFavorite(userId: number, docId: number): Promise<void> {
    await pool.query('INSERT IGNORE INTO user_favorites (user_id, document_id) VALUES (?, ?)', [userId, docId]);
  }

  static async removeFavorite(userId: number, docId: number): Promise<void> {
    await pool.query('DELETE FROM user_favorites WHERE user_id = ? AND document_id = ?', [userId, docId]);
  }
}
