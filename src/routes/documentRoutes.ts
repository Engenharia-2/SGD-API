import { Router } from 'express';
import { 
  uploadDocument, 
  listDocuments, 
  deleteDocument, 
  updateDocumentStatus,
  favoriteDocument,
  unfavoriteDocument,
  listFavorites
} from '../controllers/documentController.js';
import { upload } from '../config/multer.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Listagem é permitida para todos os autenticados
router.get('/', authenticateJWT, listDocuments);
router.get('/favorites', authenticateJWT, listFavorites);

// Operações de favoritação
router.post('/:id/favorite', authenticateJWT, favoriteDocument);
router.delete('/:id/favorite', authenticateJWT, unfavoriteDocument);

// Operações de escrita permitidas apenas para Administrador e Gestor
router.post(
  '/upload', 
  authenticateJWT, 
  authorizeRoles('Administrador', 'Gestor'), 
  upload.single('file'), 
  uploadDocument
);

router.patch(
  '/:id/status', 
  authenticateJWT, 
  authorizeRoles('Administrador', 'Gestor'), 
  updateDocumentStatus
);

router.delete(
  '/:id', 
  authenticateJWT, 
  authorizeRoles('Administrador', 'Gestor'), 
  deleteDocument
);

export default router;
