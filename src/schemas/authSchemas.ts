import { z } from 'zod';

/**
 * Schema para validação do registro de novos usuários.
 */
export const registerSchema = z.object({
  username: z.string()
    .min(3, 'O nome de usuário deve ter pelo menos 3 caracteres')
    .max(50, 'O nome de usuário deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9._]+$/, 'O nome de usuário pode conter apenas letras, números, pontos e underscores'),
  password: z.string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres'),
  sector: z.string()
    .min(2, 'O setor é obrigatório'),
  role: z.enum(['Administrador', 'Gestor', 'Funcionario'], {
    errorMap: () => ({ message: 'Cargo inválido. Escolha entre Administrador, Gestor ou Funcionario' })
  })
});

/**
 * Schema para validação do login.
 */
export const loginSchema = z.object({
  username: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória')
});

/**
 * Schema para alteração de senha.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres')
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
