import { Router } from 'express';
import { listUsers, authorizeUser, deleteUser } from '../controllers/adminController.js';

const router = Router();

router.get('/users', listUsers);
router.patch('/users/:id/authorize', authorizeUser);
router.delete('/users/:id', deleteUser);

export default router;
