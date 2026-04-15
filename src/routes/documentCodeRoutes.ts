import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';
import * as documentCodeController from '../controllers/documentCodeController.js';

const router = Router();

// Qualquer usuário autenticado pode listar códigos (para preencher o DocumentForm)
router.get('/', authenticateJWT, documentCodeController.listCodes);

// Apenas Administradores e Gestores podem gerenciar os códigos
router.post('/', authenticateJWT, authorizeRoles('Administrador', 'Gestor'), documentCodeController.createCode);
router.put('/:id', authenticateJWT, authorizeRoles('Administrador', 'Gestor'), documentCodeController.updateCode);
router.delete('/:id', authenticateJWT, authorizeRoles('Administrador', 'Gestor'), documentCodeController.deleteCode);

export default router;
