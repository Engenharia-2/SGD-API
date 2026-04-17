import { Router } from 'express';
import { getNotifications, markAsRead, streamNotifications } from '../controllers/notificationController.js';
import { authenticateJWT, checkSector } from '../middlewares/authMiddleware.js';

const router = Router();

// Stream SSE não usa authenticateJWT (EventSource não suporta headers facilmente)
// A segurança é feita via parâmetro de setor no controller
router.get('/stream/:sector', streamNotifications);

// Rotas autenticadas
router.get('/:userId/:sector', authenticateJWT, checkSector, getNotifications);
router.patch('/:notificationId/read', authenticateJWT, markAsRead);

export default router;
