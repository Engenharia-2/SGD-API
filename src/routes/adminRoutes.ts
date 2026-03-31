import { Router } from 'express';
import { listUsers, authorizeUser, deleteUser } from '../controllers/adminController.js';
import { authenticateJWT, authorizePermission, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de admin exigem token
router.use(authenticateJWT);

// Listar e autorizar exige nível de AUTORIZACAO (Administrador e Gestor)
router.get('/users', authorizePermission('AUTORIZACAO'), listUsers);
router.patch('/users/:id/authorize', authorizePermission('AUTORIZACAO'), authorizeUser);

// Apenas Administradores podem excluir usuários (Operação Crítica)
router.delete('/users/:id', authorizeRoles('Administrador'), deleteUser);

export default router;
