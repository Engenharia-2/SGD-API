import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const register = async (req: Request, res: Response) => {
  const { username, password, sector, role } = req.body;
  try {
    const [existing]: any = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Usuário já existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, sector, role, is_authorized) VALUES (?, ?, ?, ?, 0)',
      [username, hashedPassword, sector, role]
    );
    res.status(201).json({ message: 'Cadastro realizado! Aguarde a autorização.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const [results]: any = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = results[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!user.is_authorized) {
      return res.status(403).json({ error: 'Sua conta ainda não foi autorizada.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, sector: user.sector, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { username: user.username, sector: user.sector, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
