import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

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

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        sector VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL,
        is_authorized TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createDocsTable = `
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100),
        size INT,
        sector VARCHAR(50) NOT NULL,
        category VARCHAR(20) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createUsersTable);
    await pool.query(createDocsTable);

    // Garantir que a coluna is_authorized exista
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authorized TINYINT(1) DEFAULT 0 AFTER role;");
    } catch (err) {
      // Ignorar se já existe
    }

    console.log('[db]: Conexão e tabelas inicializadas com sucesso.');
  } catch (err) {
    console.error('[db]: Erro Crítico:', err);
    process.exit(1);
  }
}
