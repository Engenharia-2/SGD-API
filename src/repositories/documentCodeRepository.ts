import { pool } from '../config/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface DocumentCode extends RowDataPacket {
  id: number;
  prefix: string;
  description: string;
  pages: string[] | string;
  created_at: string;
}

export class DocumentCodeRepository {
  static async findAll(page?: string): Promise<DocumentCode[]> {
    let query = 'SELECT * FROM document_codes';
    const params: any[] = [];

    if (page) {
      query += " WHERE JSON_CONTAINS(pages, JSON_QUOTE(?))";
      params.push(page);
    }

    query += ' ORDER BY prefix ASC';
    
    const [rows] = await pool.query<DocumentCode[]>(query, params);
    return rows;
  }

  static async findById(id: number): Promise<DocumentCode | null> {
    const [rows] = await pool.query<DocumentCode[]>('SELECT * FROM document_codes WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async findByPrefix(prefix: string): Promise<DocumentCode | null> {
    const [rows] = await pool.query<DocumentCode[]>('SELECT * FROM document_codes WHERE prefix = ?', [prefix]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async create(prefix: string, description: string, pages: string[]): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO document_codes (prefix, description, pages) VALUES (?, ?, ?)',
      [prefix.toUpperCase(), description, JSON.stringify(pages)]
    );
    return result.insertId;
  }

  static async update(id: number, prefix: string, description: string, pages: string[]): Promise<void> {
    await pool.query(
      'UPDATE document_codes SET prefix = ?, description = ?, pages = ? WHERE id = ?',
      [prefix.toUpperCase(), description, JSON.stringify(pages), id]
    );
  }

  static async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM document_codes WHERE id = ?', [id]);
  }
}
