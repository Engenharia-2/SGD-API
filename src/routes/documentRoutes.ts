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
  handleApprovalAction,
  updateDocumentStatus
} from '../controllers/documentController.js';
import { 
  markAsRead, 
  confirmReading, 
  listPendingReadings, 
  getReadingStats 
} from '../controllers/documentReadingController.js';
import { upload } from '../config/multer.js';
import { authenticateJWT, authorizePermission, checkSector } from '../middlewares/authMiddleware.js';

const router = Router();

// --- Rotas de Leitura e Conformidade ---
// Funcionário marca como lido
router.post(
  '/:id/read', 
  authenticateJWT, 
  authorizePermission('LEITURA'), 
  markAsRead
);

// Gestor lista leituras pendentes do seu setor
router.get(
  '/pending-readings', 
  authenticateJWT, 
  authorizePermission('AUTORIZACAO'), 
  listPendingReadings
);

// Gestor confirma leitura específica
router.post(
  '/confirm-reading/:readingId', 
  authenticateJWT, 
  authorizePermission('AUTORIZACAO'), 
  confirmReading
);

// Gestor/Admin vê estatísticas de um documento
router.get(
  '/:id/reading-stats', 
  authenticateJWT, 
  authorizePermission('AUTORIZACAO'), 
  getReadingStats
);

// --- Rotas de Documentos ---
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
