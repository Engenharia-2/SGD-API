import { Router } from 'express';
import { uploadDocument, listDocuments, deleteDocument, updateDocument } from '../controllers/documentController.js';
import { upload } from '../config/multer.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Listagem é permitida para todos os autenticados
router.get('/', authenticateJWT, listDocuments);

// Operações de escrita permitidas apenas para Administrador e Gestor
router.post(
  '/upload', 
  authenticateJWT, 
  authorizeRoles('Administrador', 'Gestor'), 
  upload.single('file'), 
  uploadDocument
);

router.put(
  '/:id', 
  authenticateJWT, 
  authorizeRoles('Administrador', 'Gestor'), 
  upload.single('file'),
  updateDocument
);

router.delete(
  '/:id', 
  authenticateJWT, 
  authorizeRoles('Administrador', 'Gestor'), 
  deleteDocument
);

export default router;
