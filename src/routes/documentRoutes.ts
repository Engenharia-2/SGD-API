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
import { authenticateJWT, authorizePermission, checkSector } from '../middlewares/authMiddleware.js';

const router = Router();

// Listagem é permitida para todos (LEITURA)
router.get('/', authenticateJWT, authorizePermission('LEITURA'), checkSector, listDocuments);
router.get('/favorites', authenticateJWT, authorizePermission('LEITURA'), listFavorites);

// Aprovações exigem nível de AUTORIZACAO e setor correto
router.get(
  '/pending-approvals', 
  authenticateJWT, 
  authorizePermission('AUTORIZACAO'), 
  listPendingApprovals
);

router.post(
  '/:id/approve-action', 
  authenticateJWT, 
  authorizePermission('AUTORIZACAO'), 
  handleApprovalAction
);

// Favoritação (Leitura)
router.post('/:id/favorite', authenticateJWT, authorizePermission('LEITURA'), favoriteDocument);
router.delete('/:id/favorite', authenticateJWT, authorizePermission('LEITURA'), unfavoriteDocument);

// Operações de Escrita
router.post(
  '/upload', 
  authenticateJWT, 
  authorizePermission('ESCRITA'), 
  upload.array('files'), 
  uploadDocument
);

// Operações de Modificação
router.patch(
  '/:id/status', 
  authenticateJWT, 
  authorizePermission('MODIFICACAO'), 
  updateDocumentStatus
);

router.delete(
  '/:id', 
  authenticateJWT, 
  authorizePermission('MODIFICACAO'), 
  deleteDocument
);

export default router;
