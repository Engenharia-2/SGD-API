import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/**
 * Sanitiza o nome do arquivo para evitar problemas com caracteres especiais, 
 * espaços e acentuação no sistema de arquivos (especialmente Linux/Synology).
 */
const sanitizeFilename = (filename: string): string => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  
  const cleanName = name
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
    .replace(/[^a-zA-Z0-9]/g, '_') // Substitui qualquer caractere não alfanumérico por "_"
    .replace(/_{2,}/g, '_') // Evita múltiplos underscores seguidos
    .replace(/^_|_$/g, '') // Remove underscores no início ou fim
    .toLowerCase();

  return `${cleanName}${ext.toLowerCase()}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  }
});

export const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Limite de 50MB por arquivo
    files: 10 // Limite de no máximo 10 arquivos por vez (se aplicável)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.xlsx', '.docx', '.doc', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo ${ext} não suportado. Use: ${allowedTypes.join(', ')}`));
    }
  }
});
