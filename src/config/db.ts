import mysql, { RowDataPacket } from 'mysql2/promise';
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
    const [columns] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM documents");
    const columnNames = columns.map(c => c.Field as string);
    
    // Quando inicializar a api no servidor remover essas condições pois todas as colunas já estarão criadas pelas CREATE TABLE
    if (!columnNames.includes('doc_code')) {
      await pool.query("ALTER TABLE documents ADD COLUMN doc_code VARCHAR(50) NULL AFTER id");
    }
    if (!columnNames.includes('description')) {
      await pool.query("ALTER TABLE documents ADD COLUMN description TEXT NULL AFTER title");
    }
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
    const [userColumns] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM users");
    const userColumnNames = userColumns.map(c => c.Field as string);
    if (!userColumnNames.includes('is_authorized')) {
      await pool.query("ALTER TABLE users ADD COLUMN is_authorized TINYINT(1) DEFAULT 0 AFTER role");
    }

    // Ensure Indexes for existing tables
    await pool.query("ALTER TABLE documents ADD INDEX IF NOT EXISTS idx_doc_sector (sector)");
    await pool.query("ALTER TABLE documents ADD INDEX IF NOT EXISTS idx_doc_category (category)");
    await pool.query("ALTER TABLE documents ADD INDEX IF NOT EXISTS idx_doc_published (is_published)");
    await pool.query("ALTER TABLE documents ADD INDEX IF NOT EXISTS idx_doc_status (status)");
    await pool.query("ALTER TABLE document_visibility ADD INDEX IF NOT EXISTS idx_dv_sector (sector_name)");
    await pool.query("ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_notif_sector (sector)");

  } catch (err) {
    console.warn('Aviso ao validar colunas do banco:', err);
  }
}
