import { pool } from '../config/db.js';
import { DocumentReading, ResultSetHeader, Document } from '../types/index.js';
import { RowDataPacket } from 'mysql2';
import { DocumentRepository } from './documentRepository.js';

export class DocumentReadingRepository {
  /**
   * Registra uma nova intenção de leitura pelo funcionário.
   */
  static async create(documentId: number, userId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO document_readings (document_id, user_id, status, read_at) VALUES (?, ?, "Lido", NOW())',
      [documentId, userId]
    );
    return result.insertId;
  }

  /**
   * Registra uma nova leitura já confirmada (Ação de Gestor/Admin).
   */
  static async createConfirmed(documentId: number, userId: number): Promise<void> {
    await pool.query(
      'INSERT IGNORE INTO document_readings (document_id, user_id, status, read_at, confirmed_by, confirmed_at) VALUES (?, ?, "Confirmado", NOW(), ?, NOW())',
      [documentId, userId, userId]
    );
  }

  /**
   * Marca um registro existente como já confirmado (Ação de Gestor/Admin).
   */
  static async markAsConfirmed(documentId: number, userId: number): Promise<void> {
    await pool.query(
      'UPDATE document_readings SET status = "Confirmado", read_at = NOW(), confirmed_by = ?, confirmed_at = NOW() WHERE document_id = ? AND user_id = ?',
      [userId, documentId, userId]
    );
  }

  /**
   * Marca um registro de leitura obrigatória existente como 'Lido'.
   */
  static async markAsRead(documentId: number, userId: number): Promise<void> {
    await pool.query(
      'UPDATE document_readings SET status = "Lido", read_at = NOW() WHERE document_id = ? AND user_id = ?',
      [documentId, userId]
    );
  }

  /**
   * Registra múltiplas intenções de leitura de uma vez.
   */
  static async addBatch(documentId: number, userIds: number[], connection?: any): Promise<void> {
    if (userIds.length === 0) return;
    const values = userIds.map(userId => [documentId, userId, 'Pendente']);
    const query = 'INSERT IGNORE INTO document_readings (document_id, user_id, status) VALUES ?';
    
    if (connection) {
      await connection.query(query, [values]);
    } else {
      await pool.query(query, [values]);
    }
  }

  /**
   * Busca todas as leituras pendentes vinculadas a um documento específico.
   */
  static async findPendingByDocument(documentId: number): Promise<DocumentReading[]> {
    const [rows] = await pool.query<DocumentReading[]>(
      'SELECT * FROM document_readings WHERE document_id = ? AND status = "Pendente"',
      [documentId]
    );
    return rows;
  }

  /**
   * Busca documentos que o usuário logado ainda não leu.
   */
  static async listMyPending(userId: number, userSector: string, userRole: string): Promise<Document[]> {
    const query = `
      SELECT DISTINCT d.* 
      FROM documents d
      LEFT JOIN document_visibility dv ON d.id = dv.document_id
      LEFT JOIN document_readings dr_manual ON d.id = dr_manual.document_id AND dr_manual.user_id = ?
      WHERE d.is_published = 1
      AND (
        -- Para qualquer cargo: mostra se foi designado nominalmente e ainda não leu
        (dr_manual.user_id = ? AND dr_manual.status = 'Pendente')
        OR (
          -- Apenas para Funcionários: mostra tudo do setor ou com visibilidade, exceto o que já leu/confirmou
          ? = 'Funcionario' AND (d.sector = ? OR dv.sector_name = ?)
        )
      )
      AND d.id NOT IN (
        SELECT document_id 
        FROM document_readings 
        WHERE user_id = ? AND status IN ('Lido', 'Confirmado')
      )
      ORDER BY d.uploaded_at DESC
    `;
    const [rows] = await pool.query<Document[]>(query, [userId, userId, userRole, userSector, userSector, userId]);
    return await DocumentRepository.attachFiles(rows);
  }

  /**
   * Busca o status de leitura de um usuário específico para um documento.
   */
  static async findByUserAndDocument(userId: number, documentId: number): Promise<DocumentReading | null> {
    const [rows] = await pool.query<DocumentReading[]>(
      'SELECT * FROM document_readings WHERE user_id = ? AND document_id = ?',
      [userId, documentId]
    );
    return rows[0] || null;
  }

  /**
   * Lista todas as leituras que aguardam confirmação do gestor.
   */
  static async listPending(sector?: string): Promise<DocumentReading[]> {
    let query = `
      SELECT dr.*, u.username, d.title as document_title, d.doc_code
      FROM document_readings dr
      JOIN users u ON dr.user_id = u.id
      JOIN documents d ON dr.document_id = d.id
      WHERE dr.status = 'Lido'
    `;
    const params: string[] = [];

    if (sector) {
      query += ' AND u.sector = ?';
      params.push(sector);
    }

    query += ' ORDER BY dr.read_at DESC';
    const [rows] = await pool.query<DocumentReading[]>(query, params);
    return rows;
  }

  /**
   * Confirma a leitura de um documento.
   */
  static async confirm(id: number, adminId: number): Promise<void> {
    await pool.query(
      'UPDATE document_readings SET status = "Confirmado", confirmed_by = ?, confirmed_at = NOW() WHERE id = ?',
      [adminId, id]
    );
  }

  /**
   * Busca estatísticas de leitura para um documento específico dentro de um setor.
   */
  static async getReadingStats(documentId: number, sector: string): Promise<{
    read: DocumentReading[],
    missing: Array<{ id: number, username: string }>
  }> {
    // 1. Quem leu (Lido ou Confirmado)
    const [readRows] = await pool.query<DocumentReading[]>(`
      SELECT dr.*, u.username
      FROM document_readings dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.document_id = ? AND u.sector = ? AND u.role = 'Funcionario'
      AND dr.status IN ('Lido', 'Confirmado')
    `, [documentId, sector]);

    // 2. Quem falta
    const [missingRows] = await pool.query<RowDataPacket[]>(`
      SELECT id, username 
      FROM users 
      WHERE sector = ? AND is_authorized = 1 AND role = 'Funcionario' AND id NOT IN (
        SELECT user_id FROM document_readings WHERE document_id = ? AND status IN ('Lido', 'Confirmado')
      )
    `, [sector, documentId]);

    return {
      read: readRows,
      missing: missingRows as Array<{ id: number, username: string }>
    };
  }
}
