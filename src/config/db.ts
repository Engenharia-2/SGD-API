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
        responsible VARCHAR(100),
        version VARCHAR(20),
        status VARCHAR(20) DEFAULT 'Revisão',
        creation_date DATE,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createNotificationsTable = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        sector VARCHAR(50) NOT NULL,
        document_id INT,
        type VARCHAR(50) DEFAULT 'info',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
      );
    `;

    const createUserNotificationsTable = `
      CREATE TABLE IF NOT EXISTS user_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_id INT NOT NULL,
        user_id INT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        read_at TIMESTAMP NULL,
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY user_notif (user_id, notification_id)
      );
    `;

    const createUserFavoritesTable = `
      CREATE TABLE IF NOT EXISTS user_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        document_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        UNIQUE KEY user_doc_fav (user_id, document_id)
      );
    `;

    await pool.query(createUsersTable);
    await pool.query(createDocsTable);
    await pool.query(createNotificationsTable);
    await pool.query(createUserNotificationsTable);
    await pool.query(createUserFavoritesTable);

    // Garantir que novas colunas existam para bancos já criados
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
      if (!columnNames.includes('creation_date')) {
        await pool.query("ALTER TABLE documents ADD COLUMN creation_date DATE");
      }
      if (!columnNames.includes('parent_id')) {
        await pool.query("ALTER TABLE documents ADD COLUMN parent_id INT NULL");
      }
    } catch (err) {
      console.warn('Aviso ao atualizar tabela documents:', err);
    }

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
