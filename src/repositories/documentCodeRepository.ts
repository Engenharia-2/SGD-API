import { pool } from '../config/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface DocumentCode extends RowDataPacket {
  id: number;
  prefix: string;
  description: string;
  created_at: string;
}

export class DocumentCodeRepository {
  static async findAll(): Promise<DocumentCode[]> {
    const [rows] = await pool.query<DocumentCode[]>('SELECT * FROM document_codes ORDER BY prefix ASC');
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

  static async create(prefix: string, description: string): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO document_codes (prefix, description) VALUES (?, ?)',
      [prefix.toUpperCase(), description]
    );
    return result.insertId;
  }

  static async update(id: number, prefix: string, description: string): Promise<void> {
    await pool.query(
      'UPDATE document_codes SET prefix = ?, description = ? WHERE id = ?',
      [prefix.toUpperCase(), description, id]
    );
  }

  static async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM document_codes WHERE id = ?', [id]);
  }
}
