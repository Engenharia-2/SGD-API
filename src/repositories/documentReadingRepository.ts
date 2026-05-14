import { pool } from '../config/db.js';
import { DocumentReading, ResultSetHeader, Document, UserComplianceItem, NormComplianceResult } from '../types/index.js';
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
        (dr_manual.user_id = ? AND TRIM(dr_manual.status) = 'Pendente')
        OR (
          -- Apenas para Funcionários: mostra tudo do setor ou com visibilidade
          ? = 'Funcionario' AND (d.sector = ? OR dv.sector_name = ?)
        )
      )
      -- Garante que se já existir um registro de 'Lido' ou 'Confirmado', o documento SUMA da lista
      AND d.id NOT IN (
        SELECT document_id 
        FROM document_readings 
        WHERE user_id = ? AND TRIM(status) IN ('Lido', 'Confirmado')
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
   * Busca um registro de leitura pelo seu ID.
   */
  static async findById(id: number): Promise<DocumentReading | null> {
    const [rows] = await pool.query<DocumentReading[]>(
      'SELECT * FROM document_readings WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Lista todas as leituras que aguardam confirmação do gestor.
   * Agora inclui fallback para capturar registros que por ventura ficaram com status vazio.
   */
  static async listPending(sector?: string): Promise<DocumentReading[]> {
    let query = `
      SELECT dr.*, u.username, d.title as document_title, d.doc_code
      FROM document_readings dr
      LEFT JOIN users u ON dr.user_id = u.id
      LEFT JOIN documents d ON dr.document_id = d.id
      WHERE (TRIM(dr.status) = 'Lido' OR dr.status = '' OR dr.status IS NULL)
      AND dr.confirmed_at IS NULL
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
   * Busca o histórico de conformidade de um usuário específico.
   * Retorna os documentos que ele leu e os que ainda estão pendentes.
   */
  static async getUserReadingCompliance(userId: number): Promise<UserComplianceItem[]> {
    // 1. Primeiro buscamos informações do usuário (setor e role) para saber o que ele deve ver
    const [userRows] = await pool.query<RowDataPacket[]>('SELECT sector, role FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) return [];
    
    const { sector: userSector, role: userRole } = userRows[0];

    // 2. Query que combina:
    //    a) Documentos que já possuem registro na document_readings
    //    b) Documentos que o usuário deve ver (pelo setor ou visibilidade) mas não tem registro
    const query = `
      SELECT DISTINCT
             d.id, d.title, d.doc_code, d.category, d.sector as doc_sector,
             COALESCE(dr.status, 'Pendente') as status, 
             dr.read_at, dr.confirmed_at
      FROM documents d
      LEFT JOIN document_visibility dv ON d.id = dv.document_id
      LEFT JOIN document_readings dr ON d.id = dr.document_id AND dr.user_id = ?
      WHERE d.is_published = 1
      AND (
        -- Documentos que ele já interagiu (Lido, Confirmado ou Pendente nominal)
        dr.id IS NOT NULL
        OR (
          -- Apenas para Funcionários: mostra tudo do setor ou com visibilidade setorial
          ? = 'Funcionario' AND (d.sector = ? OR dv.sector_name = ?)
        )
      )
      ORDER BY 
        CASE 
          WHEN dr.status = 'Confirmado' THEN 1
          WHEN dr.status = 'Lido' THEN 2
          WHEN dr.status = 'Pendente' OR dr.status IS NULL THEN 3
          ELSE 4
        END ASC,
        d.uploaded_at DESC
    `;
    
    const [rows] = await pool.query<UserComplianceItem[]>(query, [userId, userRole, userSector, userSector]);
    return rows;
  }

  /**
   * Busca a adesão de todos os usuários a uma norma/documento específico.
   */
  static async getNormCompliance(documentId: number, sector?: string): Promise<NormComplianceResult[]> {
    let query = `
      SELECT u.id as user_id, u.username, u.sector,
             dr.status, dr.read_at, dr.confirmed_at
      FROM users u
      LEFT JOIN document_readings dr ON u.id = dr.user_id AND dr.document_id = ?
      WHERE u.is_authorized = 1 AND u.role = 'Funcionario'
    `;
    const params: any[] = [documentId];

    if (sector) {
      query += ' AND u.sector = ?';
      params.push(sector);
    }

    query += ' ORDER BY dr.status DESC, u.username ASC';
    const [rows] = await pool.query<NormComplianceResult[]>(query, params);
    return rows;
  }

  /**
   * Busca estatísticas de leitura para um documento específico (global ou por setor).
   */
  static async getReadingStats(documentId: number, sector?: string): Promise<{
    read: DocumentReading[],
    missing: Array<{ id: number, username: string }>
  }> {
    // 1. Quem leu (Lido ou Confirmado)
    let readQuery = `
      SELECT dr.*, u.username
      FROM document_readings dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.document_id = ? AND u.role = 'Funcionario'
      AND dr.status IN ('Lido', 'Confirmado')
    `;
    const readParams: any[] = [documentId];
    
    if (sector) {
      readQuery += ' AND u.sector = ?';
      readParams.push(sector);
    }

    const [readRows] = await pool.query<DocumentReading[]>(readQuery, readParams);

    // 2. Quem falta
    let missingQuery = `
      SELECT id, username 
      FROM users 
      WHERE is_authorized = 1 AND role = 'Funcionario' 
      AND id NOT IN (
        SELECT user_id FROM document_readings WHERE document_id = ? AND status IN ('Lido', 'Confirmado')
      )
    `;
    const missingParams: any[] = [documentId];

    if (sector) {
      missingQuery += ' AND sector = ?';
      missingParams.push(sector);
    }

    const [missingRows] = await pool.query<RowDataPacket[]>(missingQuery, missingParams);

    return {
      read: readRows,
      missing: missingRows as Array<{ id: number, username: string }>
    };
  }
}
