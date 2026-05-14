import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { SCHEMA_QUERIES } from './schema.js';

dotenv.config();

export let pool: mysql.Pool;

/**
 * Inicializa a conexão com o banco de dados e cria a estrutura inicial.
 */
export async function initDatabase() {
  try {
    // 1. Conexão inicial para garantir que o database existe
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await connection.end();

    // 2. Criação do Pool de conexões principal
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });

    // 3. Execução das queries de criação de tabelas (CREATE TABLE IF NOT EXISTS)
    console.log('[db]: Validando estrutura das tabelas...');
    for (const query of SCHEMA_QUERIES) {
      await pool.query(query);
    }

    // 4. Criação de índices adicionais para performance
    await createIndexes();

    console.log('[db]: Conexão e tabelas inicializadas com sucesso em estado limpo.');
  } catch (err) {
    console.error('[db]: Erro Crítico na inicialização do banco:', err);
    process.exit(1);
  }
}

/**
 * Cria índices de performance caso não existam.
 * Mantemos aqui apenas o que é essencial para busca rápida em produção.
 */
async function createIndexes() {
  try {
    const indexes = [
      { table: 'documents', name: 'idx_doc_sector', column: 'sector' },
      { table: 'documents', name: 'idx_doc_status', column: 'status' },
      { table: 'documents', name: 'idx_doc_published', column: 'is_published' },
      { table: 'document_visibility', name: 'idx_dv_sector', column: 'sector_name' },
      { table: 'notifications', name: 'idx_notif_sector', column: 'sector' },
      { table: 'document_readings', name: 'idx_read_status', column: 'status' }
    ];

    for (const idx of indexes) {
      try {
        await pool.query(`ALTER TABLE ${idx.table} ADD INDEX IF NOT EXISTS ${idx.name} (${idx.column})`);
      } catch (e) {
        // Ignora erros se o índice já existir ou se o driver não suportar IF NOT EXISTS no ALTER
      }
    }
  } catch (err) {
    console.warn('[db]: Aviso ao criar índices secundários:', err);
  }
}
