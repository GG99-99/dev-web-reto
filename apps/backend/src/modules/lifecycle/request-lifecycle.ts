import prisma, { type Prisma, type BpmRequestStatus } from '@reto/db';
import { deriveLifecycleStatus, pickCurrentEvaluation } from '@reto/shared';
import { notificationsService } from '../notifications/notifications.service';

/**
 * Keeps the BPM request row aligned with the case, evaluation, and report,
 * and tells the company users who own the establishment when the outcome changes.
 * The company UI reads `lifecycleStatus`, which is derived at read time so a
 * stored request status cannot stay on "pending assignment" after approval.
 */

type LifecycleDb = {
  case: Prisma.TransactionClient['case'];
  bpmRequest: Prisma.TransactionClient['bpmRequest'];
};

const STORED_RANK: Record<string, number> = {
  BORRADOR: 0,
  PENDIENTE_ASIGNACION: 1,
  EN_REVISION: 2,
  APROBADA: 3,
  RECHAZADA: 3,
};

export const bpmCaseInclude = {
  case: {
    include: {
      technician: { include: { person: true } },
      assignments: {
        orderBy: { assignedAt: 'asc' as const },
        include: { assignedTo: { include: { person: true } } },
      },
      evaluations: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          technician: { include: { person: true } },
          score: true,
          report: {
            select: {
              reportId: true,
              status: true,
              locked: true,
              reviews: {
                orderBy: { reviewedAt: 'asc' as const },
                select: { reviewId: true, action: true, reviewedAt: true, comments: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BpmRequestInclude;

type BpmLifecycleRow = {
  bpmRequestId: number;
  status: string;
  case?: {
    status?: string | null;
    technicianId?: number | null;
    evaluations?: Array<{
      status?: string | null;
      createdAt?: Date | string | null;
      report?: { status?: string | null } | null;
    }>;
  } | null;
};

function snapshotOf(row: BpmLifecycleRow) {
  const evaluation = pickCurrentEvaluation(row.case?.evaluations);
  return {
    requestStatus: row.status,
    caseStatus: row.case?.status,
    technicianId: row.case?.technicianId,
    evaluationStatus: evaluation?.status,
    reportStatus: evaluation?.report?.status,
  };
}

/** BPM enum value that may be persisted. Field progress stays on the case and evaluation. */
export function storedBpmStatus(row: BpmLifecycleRow): BpmRequestStatus | null {
  if (row.status === 'BORRADOR' || row.status === 'RECHAZADA') return null;
  const snap = snapshotOf(row);
  if (snap.caseStatus === 'CERRADO' || snap.reportStatus === 'APROBADO') return 'APROBADA';
  if (
    snap.reportStatus === 'ENVIADO'
    || snap.reportStatus === 'EN_CORRECCION'
    || snap.reportStatus === 'DEVUELTO'
    || snap.evaluationStatus === 'EN_CORRECCION'
    || snap.caseStatus === 'EN_REVISION'
  ) {
    return 'EN_REVISION';
  }
  return null;
}

function canAdvance(current: string, next: string) {
  if (current === 'BORRADOR' || current === 'RECHAZADA' || current === 'APROBADA') return false;
  return (STORED_RANK[next] ?? 0) >= (STORED_RANK[current] ?? 0);
}

export function withLifecycleStatus<T extends BpmLifecycleRow>(row: T): T & { lifecycleStatus: string } {
  return { ...row, lifecycleStatus: deriveLifecycleStatus(snapshotOf(row)) };
}

/** Advance the stored request status inside the same transaction as the workflow change. */
export async function syncBpmRequestForCase(tx: LifecycleDb, caseId: number) {
  const linked = await tx.case.findUnique({
    where: { caseId },
    select: {
      bpmRequestId: true,
      status: true,
      technicianId: true,
      evaluations: {
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, report: { select: { status: true } } },
      },
    },
  });
  if (!linked?.bpmRequestId) return;

  const current = await tx.bpmRequest.findUnique({
    where: { bpmRequestId: linked.bpmRequestId },
    select: { status: true },
  });
  if (!current) return;

  const next = storedBpmStatus({
    bpmRequestId: linked.bpmRequestId,
    status: current.status,
    case: linked,
  });
  if (!next || next === current.status || !canAdvance(current.status, next)) return;

  await tx.bpmRequest.update({
    where: { bpmRequestId: linked.bpmRequestId },
    data: { status: next },
  });
}

/** Heal rows that were approved or sent to review before this sync existed. */
export async function reconcileBpmRows<T extends BpmLifecycleRow>(rows: T[]): Promise<T[]> {
  await Promise.all(rows.map(async (row) => {
    const next = storedBpmStatus(row);
    if (!next || next === row.status || !canAdvance(row.status, next)) return;
    await prisma.bpmRequest.update({
      where: { bpmRequestId: row.bpmRequestId },
      data: { status: next },
    });
    row.status = next;
  }));
  return rows;
}

export async function notifyInstitution(
  institutionId: number,
  title: string,
  message: string,
  extraUserIds: number[] = [],
) {
  const institution = await prisma.institution.findUnique({
    where: { institutionId },
    select: {
      propietary: {
        select: { person: { select: { user: { select: { userId: true, isActive: true } } } } },
      },
      representantes: {
        select: { person: { select: { user: { select: { userId: true, isActive: true } } } } },
      },
    },
  });

  const ids = new Set<number>();
  const add = (user?: { userId: number; isActive: boolean } | null) => {
    if (user?.isActive) ids.add(user.userId);
  };
  add(institution?.propietary.person.user);
  for (const rep of institution?.representantes ?? []) add(rep.person.user);
  for (const userId of extraUserIds) {
    if (Number.isInteger(userId) && userId > 0) ids.add(userId);
  }

  await Promise.all([...ids].map(async (userId) => {
    try {
      await notificationsService.notify(userId, title, message);
    } catch {
      // A notification failure must not undo the workflow transition.
    }
  }));
}
