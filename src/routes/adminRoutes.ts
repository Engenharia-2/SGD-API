import { Router } from 'express';
import { listUsers, authorizeUser, deleteUser } from '../controllers/adminController.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de admin exigem token e cargo de Administrador
router.use(authenticateJWT);
router.use(authorizeRoles('Administrador'));

router.get('/users', listUsers);
router.patch('/users/:id/authorize', authorizeUser);
router.delete('/users/:id', deleteUser);

export default router;
