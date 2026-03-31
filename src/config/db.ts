import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { SCHEMA_QUERIES } from './schema.js';

dotenv.config();

export let pool: mysql.Pool;

export async function initDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await connection.end();

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Inicializar tabelas
    for (const query of SCHEMA_QUERIES) {
      await pool.query(query);
    }

    // Garantir colunas extras (Migrações simples)
    await ensureColumns();

    console.log('[db]: Conexão e tabelas inicializadas com sucesso.');
  } catch (err) {
    console.error('[db]: Erro Crítico:', err);
    process.exit(1);
  }
}

async function ensureColumns() {
  try {
    const [columns]: any = await pool.query("SHOW COLUMNS FROM documents");
    const columnNames = columns.map((c: any) => c.Field);
    
    if (!columnNames.includes('responsible')) {
      await pool.query("ALTER TABLE documents ADD COLUMN responsible VARCHAR(100)");
    }
    if (!columnNames.includes('version')) {
      await pool.query("ALTER TABLE documents ADD COLUMN version VARCHAR(20)");
    }
    if (!columnNames.includes('status')) {
      await pool.query("ALTER TABLE documents ADD COLUMN status VARCHAR(20) DEFAULT 'Revisão'");
    }
    if (!columnNames.includes('is_published')) {
      await pool.query("ALTER TABLE documents ADD COLUMN is_published TINYINT(1) DEFAULT 0 AFTER status");
    }
    if (!columnNames.includes('creation_date')) {
      await pool.query("ALTER TABLE documents ADD COLUMN creation_date DATE");
    }
    if (!columnNames.includes('parent_id')) {
      await pool.query("ALTER TABLE documents ADD COLUMN parent_id INT NULL");
    }
    
    // Check users table
    const [userColumns]: any = await pool.query("SHOW COLUMNS FROM users");
    const userColumnNames = userColumns.map((c: any) => c.Field);
    if (!userColumnNames.includes('is_authorized')) {
      await pool.query("ALTER TABLE users ADD COLUMN is_authorized TINYINT(1) DEFAULT 0 AFTER role");
    }
  } catch (err) {
    console.warn('Aviso ao validar colunas do banco:', err);
  }
}
