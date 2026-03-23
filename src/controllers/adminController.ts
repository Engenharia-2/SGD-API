import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export const listUsers = async (req: Request, res: Response) => {
  try {
    const [users]: any = await pool.query('SELECT id, username, sector, role, is_authorized, created_at FROM users ORDER BY is_authorized ASC, created_at DESC');
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
};

export const authorizeUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE users SET is_authorized = 1 WHERE id = ?', [id]);
    res.json({ message: 'Usuário autorizado com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao autorizar usuário' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuário removido/recusado' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao remover usuário' });
  }
};
