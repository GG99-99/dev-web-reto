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
    startData?: {
        representId: number;
        foodId: number;
    };
    finish?: boolean;
}
export interface PendingEvidence {
    id?: number;
    evaluationId: number;
    file: Blob;
    fileName: string;
    type: 'FOTO' | 'VIDEO' | 'DOCUMENTO';
    comment?: string;
    latitude?: number;
    longitude?: number;
    h1AskId?: number;
    h2AskId?: number;
    h3AskId?: number;
    h4AskId?: number;
    queuedAt: string;
}
/** Mirrors the technician workload so a later visit can restore a started inspection. */
export declare function saveAssignedEvaluations(items: unknown[]): Promise<void>;
export declare function getAssignedEvaluations<T = unknown>(): Promise<T[]>;
export interface OfflineEvaluationSetup {
    evaluationId: number;
    formTemplateId?: number;
    template?: FormTemplateTree;
    context?: unknown;
    representatives?: unknown[];
    categories?: unknown[];
    foodsByCategory?: Record<string, unknown[]>;
}
export declare function saveEvaluationSetup(evaluationId: number, patch: Omit<OfflineEvaluationSetup, 'evaluationId'>): Promise<void>;
export declare function getEvaluationSetup(evaluationId: number): Promise<OfflineEvaluationSetup | null>;
export declare function saveLocalDraft(evaluationId: number, answers: FormAnswers, notes?: Record<string, string>, flags?: {
    started?: boolean;
    finished?: boolean;
}): Promise<void>;
/**
 * Obtiene el borrador local de una evaluación (IndexedDB con fallback en localStorage).
 */
export declare function getLocalDraft(evaluationId: number): Promise<LocalDraft | null>;
/** Removes a local draft so a reset evaluation does not reopen old answers. */
export declare function deleteLocalDraft(evaluationId: number): Promise<void>;
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
export declare function enqueueSync(evaluationId: number, answers: FormAnswers, startData?: {
    representId: number;
    foodId: number;
}): Promise<void>;
export declare function enqueueFinish(evaluationId: number, answers: FormAnswers): Promise<void>;
export declare function enqueueEvidence(item: Omit<PendingEvidence, 'id' | 'queuedAt'>): Promise<void>;
export declare function getPendingEvidence(): Promise<PendingEvidence[]>;
export declare function removePendingEvidence(id: number): Promise<void>;
/**
 * Obtiene todos los pendientes de la cola de sincronización.
 */
export declare function getPendingSyncQueue(): Promise<SyncQueueItem[]>;
/**
 * Elimina un registro de la cola de sincronización tras enviarse exitosamente.
 */
export declare function removeSyncQueueItem(evaluationId: number): Promise<void>;
