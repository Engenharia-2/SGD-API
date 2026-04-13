import { ApiError } from '../utils/apiResponse.js';

export interface UserAuth {
  id: number;
  sector: string;
  role: string;
}

export interface DocumentAuth {
  id: number;
  sector: string;
  responsible?: string;
  is_published?: boolean | number;
}

export class DocumentPolicy {
  /**
   * Verifica se o usuário pode enviar um documento para um determinado setor.
   */
  static canUpload(user: UserAuth, targetSector: string): void {
    if (user.role !== 'Administrador' && targetSector !== user.sector) {
      throw new ApiError('Você não tem permissão para enviar documentos para outro setor.', 403);
    }
  }

  /**
   * Verifica se o usuário pode realizar ações administrativas (excluir, alterar status) em um documento.
   */
  static canManage(user: UserAuth, doc: DocumentAuth): void {
    const isAdmin = user.role === 'Administrador';
    const isManagerInSector = user.role === 'Gestor' && doc.sector === user.sector;

    if (!isAdmin && !isManagerInSector) {
      throw new ApiError('Apenas Administradores ou Gestores do setor podem gerenciar este documento.', 403);
    }
  }

  /**
   * Verifica se o usuário pode aprovar um documento.
   */
  static canApprove(user: UserAuth, doc: DocumentAuth, visibilitySectors: string[]): void {
    if (user.role === 'Administrador') return;
    
    const belongsToSector = doc.sector === user.sector;
    const hasVisibility = visibilitySectors.includes(user.sector);

    if (!belongsToSector && !hasVisibility) {
      throw new ApiError('Você não tem permissão para aprovar documentos fora da sua alçada de visibilidade.', 403);
    }
  }
}
