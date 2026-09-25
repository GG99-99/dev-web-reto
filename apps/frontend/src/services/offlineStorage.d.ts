/**
 * offlineStorage.ts
 * ---------------------------------------------------------------------------
 * Motor de persistencia local offline (RNF-01 / RF-15) usando IndexedDB con
 * respaldo automático en localStorage. Permite a los técnicos evaluadores
 * diligenciar la Ficha EBR en plantas y almacenes sin conectividad.
 * ---------------------------------------------------------------------------
 */
import type { FormAnswers, FormTemplateTree } from '@reto/shared';
export interface LocalDraft {
    evaluationId: number;
    answers: FormAnswers;
    notes: Record<string, string>;
    updatedAt: string;
    /** True after the technician starts the inspection, even if the assignment list is still stale. */
    started?: boolean;
    finished?: boolean;
}
export interface SyncQueueItem {
    id?: number;
    evaluationId: number;
    answers: FormAnswers;
    queuedAt: string;
}
/** Mirrors the technician workload so a later visit can restore a started inspection. */
export declare function saveAssignedEvaluations(items: unknown[]): void;
export declare function getAssignedEvaluations<T = unknown>(): T[];
export declare function saveLocalDraft(evaluationId: number, answers: FormAnswers, notes?: Record<string, string>, flags?: {
    started?: boolean;
    finished?: boolean;
}): Promise<void>;
/**
 * Obtiene el borrador local de una evaluación (IndexedDB con fallback en localStorage).
 */
export declare function getLocalDraft(evaluationId: number): Promise<LocalDraft | null>;
/**
 * Guarda en caché el árbol completo de la plantilla BPM para uso offline.
 */
export declare function saveCachedTemplateTree(tree: FormTemplateTree): Promise<void>;
/**
 * Recupera la plantilla BPM desde la caché local cuando no hay conexión.
 */
export declare function getCachedTemplateTree(templateId: number): Promise<FormTemplateTree | null>;
export declare const DEFAULT_BPM_TEMPLATE: FormTemplateTree;
/**
 * Agrega un lote de respuestas a la cola de sincronización cuando se detecta modo offline.
 */
export declare function enqueueSync(evaluationId: number, answers: FormAnswers): Promise<void>;
/**
 * Obtiene todos los pendientes de la cola de sincronización.
 */
export declare function getPendingSyncQueue(): Promise<SyncQueueItem[]>;
/**
 * Elimina un registro de la cola de sincronización tras enviarse exitosamente.
 */
export declare function removeSyncQueueItem(evaluationId: number): Promise<void>;
