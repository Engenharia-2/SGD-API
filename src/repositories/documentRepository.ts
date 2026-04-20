import { pool } from '../config/db.js';
import { Document, DocumentBase, ResultSetHeader } from '../types/index.js';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';

export class DocumentRepository {
  /**
   * Executa uma query usando a conexão fornecida ou o pool padrão.
   */
  private static async execute(query: string, params: any[], connection?: PoolConnection) {
    if (connection) {
      return await connection.query(query, params);
    }
    return await pool.query(query, params);
  }

  static async create(data: Partial<DocumentBase>, connection?: PoolConnection): Promise<number> {
    console.log('[RepoDebug] Criando documento no banco. is_published:', data.is_published);
    const query = 'INSERT INTO documents (doc_code, title, description, filename, original_name, mimetype, size, sector, category, responsible, revision_period_years, next_revision_date, version, status, is_published, creation_date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      data.doc_code || null,
      data.title, 
      data.description || null,
      data.filename || null, 
      data.original_name || null, 
      data.mimetype || null, 
      data.size || null,
      data.sector, 
      data.category, 
      data.responsible,
      data.revision_period_years || 0,
      data.next_revision_date || null,
      data.version, 
      data.status,
      data.is_published ?? 0, 
      data.creation_date, 
      data.parent_id
    ];
    
    const [result] = await this.execute(query, params, connection) as [ResultSetHeader, any];
    return result.insertId;
  }

  static async getNextCodeNumber(prefix: string): Promise<number> {
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

  static async addFiles(docId: number, files: Express.Multer.File[], connection?: PoolConnection): Promise<void> {
    if (files.length === 0) return;
    const values = files.map(file => [
      docId, 
      file.filename, 
      file.originalname, 
      file.mimetype, 
      file.size
    ]);
    const query = 'INSERT INTO document_files (document_id, filename, original_name, mimetype, size) VALUES ?';
    await this.execute(query, [values], connection);
  }

  /**
   * Anexa os arquivos da tabela document_files a uma lista de documentos.
   */
  static async attachFiles(docs: Document[]): Promise<Document[]> {
    if (docs.length === 0) return [];

    const docIds = docs.map(doc => doc.id);
    const [allFiles] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM document_files WHERE document_id IN (?)',
      [docIds]
    );

    const filesMap = allFiles.reduce((acc, file) => {
      const docId = file.document_id;
      if (!acc[docId]) acc[docId] = [];
      acc[docId].push(file);
      return acc;
    }, {} as Record<number, any[]>);

    docs.forEach(doc => {
      doc.files = filesMap[doc.id] || [];
    });

    return docs;
  }

  static async findById(id: number): Promise<Document | null> {
    const [rows] = await pool.query<Document[]>('SELECT * FROM documents WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    
    const docsWithFiles = await this.attachFiles([rows[0]]);
    return docsWithFiles[0];
  }

  static async listPublished(userId: number, filters: { sector?: string, category?: string }): Promise<Document[]> {
    let query = `
      SELECT DISTINCT d.*, 
      (SELECT COUNT(*) FROM user_favorites WHERE user_id = ? AND document_id = d.id) as is_favorite,
      (SELECT status FROM document_readings WHERE user_id = ? AND document_id = d.id LIMIT 1) as user_reading_status
      FROM documents d 
      LEFT JOIN document_visibility dv ON d.id = dv.document_id
      WHERE d.is_published = 1
    `;
    const params: (string | number)[] = [userId, userId];

    if (filters.sector && filters.sector !== 'Geral') {
      query += ' AND (d.sector = ? OR dv.sector_name = ?)';
      params.push(filters.sector, filters.sector);
    }

    if (filters.category) {
      query += ' AND d.category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY d.uploaded_at DESC';
    const [docs] = await pool.query<Document[]>(query, params);

    return await this.attachFiles(docs);
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

    return await this.attachFiles(docs);
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

  static async addApprovers(docId: number, approverIds: number[], connection?: PoolConnection): Promise<void> {
    if (approverIds.length === 0) return;
    const values = approverIds.map(userId => [docId, userId, 'Pendente']);
    const query = 'INSERT INTO document_approvals (document_id, user_id, status) VALUES ?';
    await this.execute(query, [values], connection);
  }

  static async addVisibility(docId: number, sectors: string[], connection?: PoolConnection): Promise<void> {
    if (sectors.length === 0) return;
    const values = sectors.map(s => [docId, s]);
    const query = 'INSERT INTO document_visibility (document_id, sector_name) VALUES ?';
    await this.execute(query, [values], connection);
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

  static async listFavorites(userId: number): Promise<Document[]> {
    const query = `
      SELECT d.*, 1 as is_favorite
      FROM documents d
      JOIN user_favorites uf ON d.id = uf.document_id
      WHERE uf.user_id = ? AND d.is_published = 1
      ORDER BY uf.created_at DESC
    `;
    const [docs] = await pool.query<Document[]>(query, [userId]);
    return await this.attachFiles(docs);
  }

  static async addFavorite(userId: number, docId: number): Promise<void> {
    await pool.query('INSERT IGNORE INTO user_favorites (user_id, document_id) VALUES (?, ?)', [userId, docId]);
  }

  static async removeFavorite(userId: number, docId: number): Promise<void> {
    await pool.query('DELETE FROM user_favorites WHERE user_id = ? AND document_id = ?', [userId, docId]);
  }

  /**
   * Busca documentos que precisam ser revisados hoje.
   */
  static async findDocumentsForRevisionToday(): Promise<Document[]> {
    const [rows] = await pool.query<Document[]>(
      'SELECT * FROM documents WHERE next_revision_date = CURRENT_DATE'
    );
    return rows;
  }

  /**
   * Atualiza a data da próxima revisão após o envio da notificação (ou após revisão).
   */
  static async updateNextRevisionDate(id: number, nextDate: string): Promise<void> {
    await pool.query('UPDATE documents SET next_revision_date = ? WHERE id = ?', [nextDate, id]);
  }
}
