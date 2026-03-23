import { Router } from 'express';
import { uploadDocument, listDocuments } from '../controllers/documentController.js';
import { upload } from '../config/multer.js';

const router = Router();

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', listDocuments);

export default router;
