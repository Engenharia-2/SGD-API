import { Router } from 'express';
import { getNotifications, markAsRead, streamNotifications } from '../controllers/notificationController.js';

const router = Router();

router.get('/stream/:sector', streamNotifications);
router.get('/:userId/:sector', getNotifications);
router.post('/read/:userId/:notificationId', markAsRead);

export default router;
