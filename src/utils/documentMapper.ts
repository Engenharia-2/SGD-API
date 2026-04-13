import { Document } from '../types/index.js';

export class DocumentMapper {
  /**
   * Agrupa uma lista plana de documentos em uma estrutura com histórico de versões.
   * Documentos com parent_id são agrupados sob o documento raiz (ou o primeiro da série).
   */
  static toHistoryGroup(docs: Document[]): Document[] {
    const groupedDocs: Document[] = [];
    const rootMap = new Map<number, Document & { history: Document[] }>();

    docs.forEach((doc) => {
      // O rootId é o parent_id (se houver) ou o próprio id (se for o pai)
      const rootId = doc.parent_id || doc.id;
      
      // Garante que is_favorite seja booleano (o banco pode retornar 0/1 ou count)
      const formattedDoc = { 
        ...doc, 
        is_favorite: !!doc.is_favorite 
      };
      
      if (!rootMap.has(rootId)) {
        // Inicializa o nó raiz com um array de histórico
        const docWithHistory = { ...formattedDoc, history: [] };
        rootMap.set(rootId, docWithHistory);
        // Adicionamos à lista final apenas uma vez por grupo
        groupedDocs.push(docWithHistory as unknown as Document);
      }
      
      // Adiciona a versão atual ao histórico do seu respectivo grupo
      rootMap.get(rootId)?.history.push(formattedDoc as Document);
    });

    return groupedDocs;
  }
}
