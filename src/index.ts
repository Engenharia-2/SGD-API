import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'node:path';
import { initDatabase, pool } from './config/db.js';

// Importação das Rotas
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import documentCodeRoutes from './routes/documentCodeRoutes.js';
import { SchedulerService } from './services/schedulerService.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// Verificação de Variáveis de Ambiente Obrigatórias
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter(key => {
  const value = process.env[key];
  // DB_PASS pode ser uma string vazia em ambiente local (ex: XAMPP root sem senha)
  if (key === 'DB_PASS') {
    return typeof value === 'undefined';
  }
  return !value;
});

if (missingEnv.length > 0) {
  console.error(`[ERRO CRÍTICO]: Variáveis de ambiente faltando: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app: Express = express();
const port = process.env.PORT || 3003;

// Middlewares Globais
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permite que o Electron acesse os arquivos
}));
app.use(cors());
app.use(express.json());

// Servir arquivos físicos da pasta uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rota de Health Check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Definição das Rotas
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/documents', documentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/document-codes', documentCodeRoutes);

// Tratamento de Erros Global (DEVE vir após as rotas)
import { errorHandler } from './middlewares/errorMiddleware.js';
app.use(errorHandler);

// Inicialização segura
initDatabase().then(() => {
  app.listen(port, () => {
    console.log(`[server]: API rodando em http://localhost:${port}`);
    SchedulerService.init();
  });
});
