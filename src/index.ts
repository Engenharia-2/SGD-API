import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase, pool } from './config/db.js';

// Importação das Rotas
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3003;

// Middlewares Globais
app.use(helmet());
app.use(cors());
app.use(express.json());

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

// Inicialização segura
initDatabase().then(() => {
  app.listen(port, () => {
    console.log(`[server]: API rodando em http://localhost:${port}`);
  });
});
