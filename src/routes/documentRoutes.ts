import { Router } from 'express';
import { 
  uploadDocument, 
  listDocuments, 
  deleteDocument, 
  updateDocumentStatus,
  favoriteDocument,
  unfavoriteDocument,
  listFavorites,
  listPendingApprovals,
  handleApprovalAction
} from '../controllers/documentController.js';
import { upload } from '../config/multer.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Listagem é permitida para todos os autenticados
router.get('/', authenticateJWT, listDocuments);
router.get('/favorites', authenticateJWT, listFavorites);
router.get('/pending-approvals', authenticateJWT, authorizeRoles('Administrador', 'Gestor'), listPendingApprovals);

// Operações de favoritação e aprovação
router.post('/:id/favorite', authenticateJWT, favoriteDocument);
router.delete('/:id/favorite', authenticateJWT, unfavoriteDocument);
router.post('/:id/approve-action', authenticateJWT, authorizeRoles('Administrador', 'Gestor'), handleApprovalAction);

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
