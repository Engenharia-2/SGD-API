import { Request, Response, NextFunction } from 'express';
import { DocumentCodeRepository } from '../repositories/documentCodeRepository.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const listCodes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const codes = await DocumentCodeRepository.findAll();
    ApiResponse.success(res, codes);
  } catch (err) {
    next(err);
  }
};

export const createCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { prefix, description } = req.body;
  if (!prefix || !description) {
    ApiResponse.error(res, 'Prefixo e descrição são obrigatórios', 400);
    return;
  }

  try {
    const existing = await DocumentCodeRepository.findByPrefix(prefix);
    if (existing) {
      ApiResponse.error(res, 'Este prefixo já existe no sistema.', 400);
      return;
    }

    const id = await DocumentCodeRepository.create(prefix, description);
    ApiResponse.success(res, { id }, 'Código criado com sucesso', 201);
  } catch (err) {
    next(err);
  }
};

export const updateCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { prefix, description } = req.body;

  try {
    const existingPrefix = await DocumentCodeRepository.findByPrefix(prefix);
    if (existingPrefix && existingPrefix.id !== Number(id)) {
      ApiResponse.error(res, 'Este prefixo já está em uso por outro código.', 400);
      return;
    }

    await DocumentCodeRepository.update(Number(id), prefix, description);
    ApiResponse.success(res, null, 'Código atualizado com sucesso');
  } catch (err) {
    next(err);
  }
};

export const deleteCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  try {
    await DocumentCodeRepository.delete(Number(id));
    ApiResponse.success(res, null, 'Código excluído com sucesso');
  } catch (err) {
    next(err);
  }
};
