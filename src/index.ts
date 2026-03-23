import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Simulação de banco de dados em memória
const users: any[] = [];

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rota de Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'sgd-api' 
  });
});

// Registro de usuário
app.post('/auth/register', async (req: Request, res: Response) => {
  const { username, password, sector, role } = req.body;

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { 
    id: Date.now(), 
    username, 
    password: hashedPassword, 
    sector, 
    role // Administrador, Gestor, Funcionario
  };
  users.push(newUser);

  res.status(201).json({ message: 'Usuário criado com sucesso' });
});

// Login de usuário
app.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, sector: user.sector, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ 
    token, 
    user: { 
      username: user.username, 
      sector: user.sector, 
      role: user.role 
    } 
  });
});

// Inicialização do servidor
app.listen(port, () => {
  console.log(`[server]: API está rodando em http://localhost:${port}`);
});
