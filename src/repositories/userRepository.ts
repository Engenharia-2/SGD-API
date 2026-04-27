import { pool } from '../config/db.js';
import { User, UserBase, ResultSetHeader } from '../types/index.js';

export class UserRepository {
  static async findById(id: number): Promise<User | null> {
    const [rows] = await pool.query<User[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.query<User[]>('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  static async listAll(sector?: string, role?: string): Promise<User[]> {
    let query = 'SELECT id, username, sector, role, is_authorized, created_at FROM users';
    const params: any[] = [];
    const conditions: string[] = [];

    if (sector) {
      conditions.push('sector = ?');
      params.push(sector);
    }

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY is_authorized ASC, username ASC';
    const [rows] = await pool.query<User[]>(query, params);
    return rows;
  }

  static async create(userData: Partial<UserBase> & { password?: string }): Promise<number> {
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

  static async findManagersBySector(sector: string): Promise<User[]> {
    const [rows] = await pool.query<User[]>(
      "SELECT id, username, sector, role FROM users WHERE is_authorized = 1 AND (role = 'Gestor' OR (role = 'Administrador' AND sector = ?))",
      [sector]
    );
    return rows;
  }

  static async listAllGlobal(): Promise<User[]> {
    const [rows] = await pool.query<User[]>(
      "SELECT id, username, sector, role FROM users WHERE is_authorized = 1 ORDER BY username ASC"
    );
    return rows;
  }

  static async listAvailableApprovers(): Promise<User[]> {
    const [rows] = await pool.query<User[]>(
      "SELECT id, username, sector, role FROM users WHERE is_authorized = 1 AND (role = 'Gestor' OR role = 'Administrador') ORDER BY username ASC"
    );
    return rows;
  }

  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async updatePassword(id: number, hashedPassword: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );
    return result.affectedRows > 0;
  }
}
