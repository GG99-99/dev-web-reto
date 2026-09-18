import { Router } from 'express';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { rolesRouter } from './modules/roles/roles.router';
import { catalogsRouter } from './modules/catalogs/catalogs.router';
import { institutionsRouter } from './modules/institutions/institutions.router';
import { attachmentsRouter } from './modules/attachments/attachments.router';
import { bpmRequestsRouter } from './modules/bpm-requests/bpm-requests.router';
import { casesRouter } from './modules/cases/cases.router';
import { assignmentsRouter } from './modules/assignments/assignments.router';
import { evaluationsRouter } from './modules/evaluations/evaluations.router';
import { riskEngineRouter } from './modules/risk-engine/risk-engine.router';
import { reportsRouter } from './modules/reports/reports.router';
import { formExecutionRouter } from './modules/form-execution/form-execution.router';
import { evidencesRouter } from './modules/evidences/evidences.router';
import { lapchAlertsRouter } from './modules/lapch-alerts/lapch-alerts.router';
import { complaintsRouter } from './modules/complaints/complaints.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { historyRouter } from './modules/history/history.router';

/**
 * api.router.ts
 * ---------------------------------------------------------------------------
 * Punto de entrada único de la API. Se monta en app.ts bajo `/api/v1`
 * (sección 0 de API_CONTRACTS.md: "Base URL: /api/v1").
 *
 * Ver documentos/backend.txt para el checklist de avance por módulo.
 * ---------------------------------------------------------------------------
 */
export const apiRouter: Router = Router();

apiRouter.use(authRouter); // /auth/*
apiRouter.use(usersRouter); // /users/*
apiRouter.use(rolesRouter); // /roles
apiRouter.use(catalogsRouter); // /catalogs/*
apiRouter.use(institutionsRouter); // /institutions/*, /representatives/*
apiRouter.use(attachmentsRouter); // /attachments/*
apiRouter.use(bpmRequestsRouter); // /bpm-requests/*
apiRouter.use(casesRouter); // /cases/*
apiRouter.use(assignmentsRouter); // /cases/:id/assignments|assign|reassign
apiRouter.use(evaluationsRouter); // /evaluations/*, /evaluations/calendar
apiRouter.use(formExecutionRouter); // /form-templates/*, /evaluations/:id/{start,answers,finish}
apiRouter.use(riskEngineRouter); // /evaluations/:id/score, /catalogs/risk-frequency-rules
apiRouter.use(reportsRouter); // /evaluations/:id/report, /reports/*
apiRouter.use(evidencesRouter); // /evaluations/:id/evidences, /evidences/:id
apiRouter.use(lapchAlertsRouter); // /lapch-alerts/*
apiRouter.use(complaintsRouter); // /complaints/*
apiRouter.use(notificationsRouter); // /notifications/*
apiRouter.use(dashboardRouter); // /dashboard/{empresa,coordinador,tecnico}
apiRouter.use(historyRouter); // /history/search
