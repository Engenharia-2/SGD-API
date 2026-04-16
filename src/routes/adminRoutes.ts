import { Router } from 'express';
import { listUsers, authorizeUser, deleteUser, resetPassword } from '../controllers/adminController.js';
import { authenticateJWT, authorizePermission, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de admin exigem token
router.use(authenticateJWT);

// Listar, autorizar e redefinir senha exige nível de AUTORIZACAO (Administrador e Gestor)
router.get('/users', authorizePermission('AUTORIZACAO'), listUsers);
router.patch('/users/:id/authorize', authorizePermission('AUTORIZACAO'), authorizeUser);
router.patch('/users/:id/reset-password', authorizePermission('AUTORIZACAO'), resetPassword);

// Apenas Administradores podem excluir usuários (Operação Crítica)
router.delete('/users/:id', authorizeRoles('Administrador'), deleteUser);

export default router;
