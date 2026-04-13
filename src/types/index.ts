import { ResultSetHeader, RowDataPacket } from 'mysql2';

export type UserRole = 'Administrador' | 'Gestor' | 'Funcionario';

export interface UserBase {
  id: number;
  username: string;
  password?: string;
  sector: string;
  role: UserRole;
  is_authorized: boolean;
  created_at: string;
}

export interface User extends UserBase, RowDataPacket {}

export type DocumentStatus = 'Revisão' | 'Aprovado' | 'Obsoleto' | 'Rejeitado';

export interface DocumentBase {
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
  user_reading_status?: 'Pendente' | 'Confirmado' | null;
  files?: Array<{
    id: number;
    filename: string;
    original_name: string;
    mimetype: string;
    size: number;
  }>;
}

export interface Document extends DocumentBase, RowDataPacket {}

export type DocumentReadingStatus = 'Pendente' | 'Confirmado';

export interface DocumentReadingBase {
  id: number;
  document_id: number;
  user_id: number;
  status: DocumentReadingStatus;
  read_at: string;
  confirmed_by: number | null;
  confirmed_at: string | null;
  // Campos virtuais para JOINs
  username?: string;
  document_title?: string;
}

export interface DocumentReading extends DocumentReadingBase, RowDataPacket {}

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface NotificationBase {
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

export interface Notification extends NotificationBase, RowDataPacket {}

export { ResultSetHeader };
