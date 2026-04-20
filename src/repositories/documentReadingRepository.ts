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
      'INSERT IGNORE INTO document_readings (document_id, user_id) VALUES (?, ?)',
      [documentId, userId]
    );
    return result.insertId;
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
   * Busca documentos que o usuário logado ainda não leu, mas que pertencem ao seu setor
   * ou possuem visibilidade para ele.
   */
  static async listMyPending(userId: number, userSector: string): Promise<Document[]> {
    const query = `
      SELECT DISTINCT d.* 
      FROM documents d
      LEFT JOIN document_visibility dv ON d.id = dv.document_id
      WHERE d.is_published = 1
      AND (d.sector = ? OR dv.sector_name = ?)
      AND d.id NOT IN (
        SELECT document_id 
        FROM document_readings 
        WHERE user_id = ? AND status = 'Confirmado'
      )
      ORDER BY d.uploaded_at DESC
    `;
    const [rows] = await pool.query<Document[]>(query, [userSector, userSector, userId]);
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
   * Lista todas as leituras pendentes de confirmação.
   * Se o setor for fornecido, filtra por ele. Caso contrário (para Admins), traz tudo.
   */
  static async listPending(sector?: string): Promise<DocumentReading[]> {
    let query = `
      SELECT dr.*, u.username, d.title as document_title, d.doc_code
      FROM document_readings dr
      JOIN users u ON dr.user_id = u.id
      JOIN documents d ON dr.document_id = d.id
      WHERE dr.status = 'Pendente'
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
   * Retorna quem leu e quem ainda falta ler.
   */
  static async getReadingStats(documentId: number, sector: string): Promise<{
    read: DocumentReading[],
    missing: Array<{ id: number, username: string }>
  }> {
    // 1. Quem leu (Pendente ou Confirmado) - Apenas usuários com role 'Funcionario'
    const [readRows] = await pool.query<DocumentReading[]>(`
      SELECT dr.*, u.username
      FROM document_readings dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.document_id = ? AND u.sector = ? AND u.role = 'Funcionario'
    `, [documentId, sector]);

    // 2. Quem falta (Usuários ativos do setor com role 'Funcionario' que não estão na lista acima)
    const [missingRows] = await pool.query<RowDataPacket[]>(`
      SELECT id, username 
      FROM users 
      WHERE sector = ? AND is_authorized = 1 AND role = 'Funcionario' AND id NOT IN (
        SELECT user_id FROM document_readings WHERE document_id = ?
      )
    `, [sector, documentId]);

    return {
      read: readRows,
      missing: missingRows as Array<{ id: number, username: string }>
    };
  }
}
