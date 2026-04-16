import { Router } from 'express';
import { register, login, changePassword } from '../controllers/authController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.patch('/change-password', authenticateJWT, changePassword);

export default router;
