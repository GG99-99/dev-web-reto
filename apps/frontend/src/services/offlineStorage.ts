/**
 * offlineStorage.ts
 * ---------------------------------------------------------------------------
 * Motor de persistencia local offline (RNF-01 / RF-15) usando IndexedDB con
 * respaldo automático en localStorage. Permite a los técnicos evaluadores
 * diligenciar la Ficha EBR en plantas y almacenes sin conectividad.
 * ---------------------------------------------------------------------------
 */
import type { FormAnswers, FormTemplateTree } from '@reto/shared';

const DB_NAME = 'radar_sanitary_offline_v1';
const DB_VERSION = 1;

const STORES = {
  ANSWERS: 'evaluation_answers',
  TEMPLATES: 'form_templates',
  SYNC_QUEUE: 'sync_queue',
} as const;

export interface LocalDraft {
  evaluationId: number;
  answers: FormAnswers;
  notes: Record<string, string>;
  updatedAt: string;
}

export interface SyncQueueItem {
  id?: number;
  evaluationId: number;
  answers: FormAnswers;
  queuedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.ANSWERS)) {
        db.createObjectStore(STORES.ANSWERS, { keyPath: 'evaluationId' });
      }
      if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
        db.createObjectStore(STORES.TEMPLATES, { keyPath: 'formTemplateId' });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fallbacks de localStorage para ambientes restringidos o errores
function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorar cuotas excedidas */
  }
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Guarda o actualiza el borrador local de respuestas y notas para una evaluación.
 */
export async function saveLocalDraft(
  evaluationId: number,
  answers: FormAnswers,
  notes: Record<string, string> = {},
): Promise<void> {
  const draft: LocalDraft = {
    evaluationId,
    answers,
    notes,
    updatedAt: new Date().toISOString(),
  };

  // Guardar en localStorage como espejo inmediato
  lsSet(`radar_eval_${evaluationId}`, draft);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.ANSWERS, 'readwrite');
      const store = tx.objectStore(STORES.ANSWERS);
      const req = store.put(draft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('Fallo al guardar borrador en IndexedDB, usando localStorage fallback:', error);
  }
}

/**
 * Obtiene el borrador local de una evaluación (IndexedDB con fallback en localStorage).
 */
export async function getLocalDraft(evaluationId: number): Promise<LocalDraft | null> {
  try {
    const db = await openDB();
    const result = await new Promise<LocalDraft | undefined>((resolve, reject) => {
      const tx = db.transaction(STORES.ANSWERS, 'readonly');
      const store = tx.objectStore(STORES.ANSWERS);
      const req = store.get(evaluationId);
      req.onsuccess = () => resolve(req.result as LocalDraft | undefined);
      req.onerror = () => reject(req.error);
    });

    if (result) return result;
  } catch (error) {
    console.warn('Fallo al leer borrador de IndexedDB, probando localStorage:', error);
  }

  return lsGet<LocalDraft>(`radar_eval_${evaluationId}`);
}

/**
 * Guarda en caché el árbol completo de la plantilla BPM para uso offline.
 */
export async function saveCachedTemplateTree(tree: FormTemplateTree): Promise<void> {
  lsSet(`radar_template_${tree.formTemplateId}`, tree);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.TEMPLATES, 'readwrite');
      const store = tx.objectStore(STORES.TEMPLATES);
      const req = store.put(tree);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('Fallo al cachear plantilla en IndexedDB:', error);
  }
}

/**
 * Recupera la plantilla BPM desde la caché local cuando no hay conexión.
 */
export async function getCachedTemplateTree(templateId: number): Promise<FormTemplateTree | null> {
  try {
    const db = await openDB();
    const result = await new Promise<FormTemplateTree | undefined>((resolve, reject) => {
      const tx = db.transaction(STORES.TEMPLATES, 'readonly');
      const store = tx.objectStore(STORES.TEMPLATES);
      const req = store.get(templateId);
      req.onsuccess = () => resolve(req.result as FormTemplateTree | undefined);
      req.onerror = () => reject(req.error);
    });

    if (result) return result;
  } catch {
    /* fallback */
  }

  const local = lsGet<FormTemplateTree>(`radar_template_${templateId}`);
  if (local) return local;

  return DEFAULT_BPM_TEMPLATE;
}

export const DEFAULT_BPM_TEMPLATE: FormTemplateTree = ({
  formTemplateId: 1,
  name: 'Official Inspection Form for Good Manufacturing Practices (EBR/BPM)',
  version: '2.4',
  isActive: true,
  createdAt: new Date().toISOString(),
  h1s: [
    {
      h1Id: 1,
      formTemplateId: 1,
      name: '1. Buildings and Facilities',
      h1Asks: [],
      h2s: [
        {
          h2Id: 101,
          h1Id: 1,
          name: '1.1 Location and surroundings',
          h2Asks: [
            { h2AskId: 1001, h2Id: 101, active: true, name: 'Are the surroundings clean, free of garbage and stagnant water that could attract pests?' },
            { h2AskId: 1002, h2Id: 101, active: true, name: 'Is the establishment isolated from sources of unsanitary conditions and activities that compromise food safety?' },
          ],
          h3s: [],
        },
        {
          h2Id: 102,
          h1Id: 1,
          name: '1.2 Design and construction',
          h2Asks: [
            { h2AskId: 1003, h2Id: 102, active: true, name: 'Are the buildings solid and the construction materials do not transmit toxic substances?' },
            { h2AskId: 1004, h2Id: 102, active: true, name: 'Is there physical separation between clean processing areas and dirty reception/waste areas?' },
          ],
          h3s: [],
        },
        {
          h2Id: 103,
          h1Id: 1,
          name: '1.3 Floors, walls, and ceilings',
          h2Asks: [
            { h2AskId: 1005, h2Id: 103, active: true, name: 'Are the floors made of waterproof, non-absorbent, washable material and sloped towards the drains?' },
            { h2AskId: 1006, h2Id: 103, active: true, name: 'Do the walls have smooth surfaces, light colors, are they waterproof and easy to clean and disinfect?' },
            { h2AskId: 1007, h2Id: 103, active: true, name: 'Are the joints between floors and walls rounded (coved) to facilitate washing?' },
          ],
          h3s: [],
        },
      ],
    },
    {
      h1Id: 2,
      formTemplateId: 1,
      name: '2. Equipment and Utensils',
      h1Asks: [],
      h2s: [
        {
          h2Id: 201,
          h1Id: 2,
          name: '2.1 Contact surfaces',
          h2Asks: [
            { h2AskId: 2001, h2Id: 201, active: true, name: 'Are the surfaces in direct contact with food made of stainless steel or smooth, non-porous, and inert sanitary material?' },
            { h2AskId: 2002, h2Id: 201, active: true, name: 'Is the equipment designed and built in a way that allows easy disassembly for cleaning and disinfection?' },
          ],
          h3s: [],
        },
        {
          h2Id: 202,
          h1Id: 2,
          name: '2.2 Control and measuring instruments',
          h2Asks: [
            { h2AskId: 2003, h2Id: 202, active: true, name: 'Do thermometers, pressure gauges, and control devices have current calibration and records?' },
            { h2AskId: 2004, h2Id: 202, active: true, name: 'Is there a documented preventive and corrective maintenance program for critical equipment?' },
          ],
          h3s: [],
        },
      ],
    },
    {
      h1Id: 3,
      formTemplateId: 1,
      name: '3. Handling Personnel and Hygiene',
      h1Asks: [],
      h2s: [
        {
          h2Id: 301,
          h1Id: 3,
          name: '3.1 Health status and training',
          h2Asks: [
            { h2AskId: 3001, h2Id: 301, active: true, name: 'Does the staff have a medical health certificate and proof of current GMP training?' },
            { h2AskId: 3002, h2Id: 301, active: true, name: 'Is it supervised that operators with wounds or symptoms of a communicable disease do not handle food?' },
          ],
          h3s: [],
        },
        {
          h2Id: 302,
          h1Id: 3,
          name: '3.2 Clothing and hygiene habits',
          h2Asks: [
            { h2AskId: 3003, h2Id: 302, active: true, name: 'Does the staff wear a clean light-colored uniform, with appropriate footwear, hairnet, and face mask?' },
            { h2AskId: 3004, h2Id: 302, active: true, name: 'Is the use of jewelry, nail polish, cosmetics, or smoking/eating prohibited in production areas?' },
          ],
          h3s: [],
        },
      ],
    },
    {
      h1Id: 4,
      formTemplateId: 1,
      name: '4. Hygienic Production Requirements',
      h1Asks: [],
      h2s: [
        {
          h2Id: 401,
          h1Id: 4,
          name: '4.1 Raw materials and supplies',
          h2Asks: [
            { h2AskId: 4001, h2Id: 401, active: true, name: 'Are raw materials inspected upon receipt and have a technical data sheet and verifiable batch?' },
            { h2AskId: 4002, h2Id: 401, active: true, name: 'Are non-conforming supplies identified and stored in clearly marked areas for rejection?' },
          ],
          h3s: [],
        },
        {
          h2Id: 402,
          h1Id: 4,
          name: '4.2 Operations control and prevention of cross-contamination',
          h2Asks: [
            { h2AskId: 4003, h2Id: 402, active: true, name: 'Are effective measures applied to prevent physical, chemical, and microbiological contamination during the process?' },
            { h2AskId: 4004, h2Id: 402, active: true, name: 'Are critical process parameters (temperature, time, pH, pressure) monitored with updated records?' },
          ],
          h3s: [],
        },
      ],
    },
    {
      h1Id: 5,
      formTemplateId: 1,
      name: '5. Storage and Transportation',
      h1Asks: [],
      h2s: [
        {
          h2Id: 501,
          h1Id: 5,
          name: '5.1 Storage conditions',
          h2Asks: [
            { h2AskId: 5001, h2Id: 501, active: true, name: 'Are foods stowed on pallets with adequate separation from walls and floor (minimum 15 cm)?' },
            { h2AskId: 5002, h2Id: 501, active: true, name: 'Do cold rooms maintain regulatory temperatures with continuous thermograph records?' },
          ],
          h3s: [],
        },
        {
          h2Id: 502,
          h1Id: 5,
          name: '5.2 Transportation vehicles',
          h2Asks: [
            { h2AskId: 5003, h2Id: 502, active: true, name: 'Are food transportation vehicles clean, disinfected, and health-authorized?' },
          ],
          h3s: [],
        },
      ],
    },
    {
      h1Id: 6,
      formTemplateId: 1,
      name: '6. Sanitation and Pest Control',
      h1Asks: [],
      h2s: [
        {
          h2Id: 601,
          h1Id: 6,
          name: '6.1 Cleaning and disinfection',
          h2Asks: [
            { h2AskId: 6001, h2Id: 601, active: true, name: 'Is there a documented Master Cleaning and Disinfection Program with authorized products and safety data sheets?' },
            { h2AskId: 6002, h2Id: 601, active: true, name: 'Are chemical cleaning products and pesticides stored under lock and key separately from food?' },
          ],
          h3s: [],
        },
        {
          h2Id: 602,
          h1Id: 6,
          name: '6.2 Integrated pest management (IPM)',
          h2Asks: [
            { h2AskId: 6003, h2Id: 602, active: true, name: 'Is there a pest control program executed by a certified company, with a map of bait stations and light traps?' },
            { h2AskId: 6004, h2Id: 602, active: true, name: 'Do the facilities have physical barriers (mosquito nets, air curtains, seals) that prevent the entry of pests?' },
          ],
          h3s: [],
        },
      ],
    },
    {
      h1Id: 7,
      formTemplateId: 1,
      name: '7. Quality Assurance and Traceability',
      h1Asks: [],
      h2s: [
        {
          h2Id: 701,
          h1Id: 7,
          name: '7.1 Traceability and recall system',
          h2Asks: [
            { h2AskId: 7001, h2Id: 701, active: true, name: 'Does the establishment have a traceability system that allows tracking each batch from raw material to the customer?' },
            { h2AskId: 7002, h2Id: 701, active: true, name: 'Is there a documented and tested procedure for the rapid and safe withdrawal of products from the market (Recall)?' },
          ],
          h3s: [],
        },
      ],
    },
  ],
} as unknown as FormTemplateTree);


/**
 * Agrega un lote de respuestas a la cola de sincronización cuando se detecta modo offline.
 */
export async function enqueueSync(evaluationId: number, answers: FormAnswers): Promise<void> {
  const item: SyncQueueItem = {
    evaluationId,
    answers,
    queuedAt: new Date().toISOString(),
  };

  const queue = lsGet<SyncQueueItem[]>('radar_sync_queue') ?? [];
  // Actualizar si ya hay un pendiente para esta evaluación
  const existingIdx = queue.findIndex((q) => q.evaluationId === evaluationId);
  if (existingIdx >= 0) {
    queue[existingIdx] = item;
  } else {
    queue.push(item);
  }
  lsSet('radar_sync_queue', queue);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const cursorRequest = store.openCursor();
      cursorRequest.onerror = () => reject(cursorRequest.error);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          if ((cursor.value as SyncQueueItem).evaluationId === evaluationId) cursor.delete();
          cursor.continue();
          return;
        }
        store.add(item);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Fallo al encolar en IndexedDB:', error);
  }
}

/**
 * Obtiene todos los pendientes de la cola de sincronización.
 */
export async function getPendingSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openDB();
    const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as SyncQueueItem[]);
      req.onerror = () => reject(req.error);
    });

    if (items && items.length > 0) return items;
  } catch {
    /* fallback a localStorage */
  }

  return lsGet<SyncQueueItem[]>('radar_sync_queue') ?? [];
}

/**
 * Elimina un registro de la cola de sincronización tras enviarse exitosamente.
 */
export async function removeSyncQueueItem(evaluationId: number): Promise<void> {
  const queue = lsGet<SyncQueueItem[]>('radar_sync_queue') ?? [];
  const updated = queue.filter((item) => item.evaluationId !== evaluationId);
  lsSet('radar_sync_queue', updated);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if ((cursor.value as SyncQueueItem).evaluationId === evaluationId) cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* ignorar */
  }
}
