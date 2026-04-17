import cron from 'node-cron';
import { DocumentRepository } from '../repositories/documentRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { NotificationService } from './notificationService.js';

export class SchedulerService {
  /**
   * Inicializa os agendamentos do sistema.
   */
  static init() {
    // Rodar todos os dias às 03:00 da manhã
    cron.schedule('0 3 * * *', async () => {
      console.log('[Scheduler] Verificando revisões de documentos...');
      await this.processDocumentRevisions();
    });

    console.log('[Scheduler] Agendador de tarefas inicializado.');
  }

  /**
   * Verifica documentos que precisam de revisão e notifica os responsáveis.
   */
  private static async processDocumentRevisions() {
    try {
      const docsToReview = await DocumentRepository.findDocumentsForRevisionToday();
      
      if (docsToReview.length === 0) {
        console.log('[Scheduler] Nenhum documento para revisar hoje.');
        return;
      }

      for (const doc of docsToReview) {
        // Tentar encontrar o ID do usuário responsável pelo nome
        let targetUserId: number | null = null;
        if (doc.responsible) {
          const user = await UserRepository.findByUsername(doc.responsible);
          if (user) targetUserId = user.id;
        }

        const title = 'Revisão Necessária';
        const message = `O documento "${doc.title}" atingiu o prazo de revisão e precisa ser verificado.`;

        if (targetUserId) {
          // Notifica o usuário específico (criador/responsável)
          await NotificationService.notifyUser(
            targetUserId,
            doc.sector,
            title,
            message,
            'warning',
            doc.id
          );
        } else {
          // Se não encontrar o usuário, notifica o setor em geral
          await NotificationService.notifySector(
            doc.sector,
            title,
            message,
            'warning',
            doc.id
          );
        }

        // Atualizar para a próxima data (se o período de revisão for > 0)
        if (doc.revision_period_years && doc.revision_period_years > 0) {
          const nextDate = new Date();
          nextDate.setFullYear(nextDate.getFullYear() + doc.revision_period_years);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          
          await DocumentRepository.updateNextRevisionDate(doc.id, nextDateStr);
          console.log(`[Scheduler] Documento ${doc.id} agendado para próxima revisão em ${nextDateStr}`);
        }
      }
      
      console.log(`[Scheduler] Processamento concluído. ${docsToReview.length} documentos notificados.`);
    } catch (err) {
      console.error('[Scheduler] Erro ao processar revisões:', err);
    }
  }
}
