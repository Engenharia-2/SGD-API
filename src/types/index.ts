import { ResultSetHeader, RowDataPacket } from 'mysql2';

export type UserRole = 'Administrador' | 'Gestor' | 'Funcionario';

export interface User extends RowDataPacket {
  id: number;
  username: string;
  password?: string;
  sector: string;
  role: UserRole;
  is_authorized: boolean;
  created_at: string;
}

export type DocumentStatus = 'Revisão' | 'Aprovado' | 'Obsoleto' | 'Rejeitado';

export interface Document extends RowDataPacket {
  id: number;
  doc_code?: string;
  title: string;
  description?: string;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  sector: string;
  category: string;
  responsible: string;
  version: string;
  status: DocumentStatus;
  is_published: boolean;
  creation_date: string;
  uploaded_at: string;
  parent_id?: number | null;
  is_favorite?: boolean;
}

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface Notification extends RowDataPacket {
  id: number;
  title: string;
  message: string;
  sector: string;
  document_id: number | null;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  target_user_id?: number | null;
}

export { ResultSetHeader };
