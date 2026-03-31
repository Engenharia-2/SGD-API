import { pool } from '../config/db.js';
import { User, ResultSetHeader } from '../types/index.js';

export class UserRepository {
  static async findById(id: number): Promise<User | null> {
    const [rows] = await pool.query<User[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.query<User[]>('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  static async listAll(): Promise<User[]> {
    const [rows] = await pool.query<User[]>(
      'SELECT id, username, sector, role, is_authorized, created_at FROM users ORDER BY is_authorized ASC, created_at DESC'
    );
    return rows;
  }

  static async create(userData: Partial<User> & { password?: string }): Promise<number> {
    const { username, password, sector, role } = userData;
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, password, sector, role, is_authorized) VALUES (?, ?, ?, ?, 0)',
      [username, password, sector, role]
    );
    return result.insertId;
  }

  static async authorize(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>('UPDATE users SET is_authorized = 1 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}
