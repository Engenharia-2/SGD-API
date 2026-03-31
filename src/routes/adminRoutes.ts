import { Router } from 'express';
import { listUsers, authorizeUser, deleteUser } from '../controllers/adminController.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de admin exigem token e cargo de Administrador
router.use(authenticateJWT);

// Listar e autorizar pode ser feito por Administradores e Gestores
router.get('/users', authorizeRoles('Administrador', 'Gestor'), listUsers);
router.patch('/users/:id/authorize', authorizeRoles('Administrador', 'Gestor'), authorizeUser);

// Apenas Administradores podem excluir usuários
router.delete('/users/:id', authorizeRoles('Administrador'), deleteUser);

export default router;
