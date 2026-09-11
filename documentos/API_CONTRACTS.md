# Contratos de API — Sistema PWA de Evaluación Basada en Riesgo (EBR/BPM)

Este documento define **todos los endpoints del backend** y su contrato de request/response,
escrito de forma que cada tipo se pueda mapear 1:1 a un `type`/`interface` de TypeScript
reutilizando los tipos generados por Prisma Client (`@prisma/client`).

> Convención de tipos usada en todo el documento:
> - `Modelo` → tipo plano generado por Prisma (ej. `Institution`, `Case`).
> - `Prisma.ModeloGetPayload<{ include: {...} }>` → tipo con relaciones incluidas.
> - `Prisma.ModeloCreateInput` / `Prisma.ModeloUpdateInput` → base para bodies de creación/edición.
> - Los DTOs de request casi siempre son un `Pick`/`Omit` sobre el `CreateInput` de Prisma
>   (se excluyen columnas autogeneradas: ids, `createdAt`, `updatedAt`, campos calculados).

---

## 0. Convenciones generales

**Base URL:** `/api/v1`
**Auth:** `Authorization: Bearer <accessToken>` (JWT, RNF-02). Endpoints marcados **Público** no lo requieren.
**Roles:** `ADMIN`, `ADMIN_EMPRESA`, `USUARIO_DELEGADO`, `COORDINADOR`, `TECNICO_EVALUADOR` (tabla `role`, RF-02).
**Content-Type:** `application/json` (excepto uploads, `multipart/form-data`).

### 0.1 Tipos base compartidos

```ts
import type { Prisma } from '@prisma/client';

// Envoltorio estándar de toda respuesta exitosa
interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// Envoltorio estándar de error (4xx/5xx)
interface ApiError {
  error: {
    code: string;          // ej. "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED"
    message: string;
    details?: unknown;
  };
}

// Query params comunes de listados
interface PaginationQuery {
  page?: number;     // default 1
  pageSize?: number;  // default 20, max 100
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

### 0.2 Patrón CRUD estándar

Salvo que se indique lo contrario, todo recurso `Recurso` expone este patrón; en las secciones
siguientes solo se documentan las particularidades (filtros, reglas de negocio) y los endpoints
que **no** son CRUD simple se detallan completos.

| Método | Path | Body | Response 200/201 |
|---|---|---|---|
| `GET` | `/recursos` | — (query = filtros + `PaginationQuery`) | `ApiResponse<PaginatedResponse<Recurso>>` |
| `GET` | `/recursos/:id` | — | `ApiResponse<Recurso>` |
| `POST` | `/recursos` | `CreateRecursoRequest` | `ApiResponse<Recurso>` (201) |
| `PATCH` | `/recursos/:id` | `UpdateRecursoRequest` | `ApiResponse<Recurso>` |
| `DELETE` | `/recursos/:id` | — | `ApiResponse<{ id: number }>` (204 sin body también aceptable) |

Errores comunes a todos los endpoints: `400` validación, `401` sin token, `403` rol no autorizado,
`404` no encontrado, `409` conflicto (ej. RNC duplicado), `500` error interno.

---

## 1. Auth (RF-01)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| POST | `/auth/login` | Público | Inicio de sesión |
| POST | `/auth/logout` | Autenticado | Cierre de sesión (invalida refresh token) |
| POST | `/auth/refresh` | Público (requiere refreshToken) | Renueva `accessToken` |
| POST | `/auth/password/forgot` | Público | Solicita recuperación de contraseña |
| POST | `/auth/password/reset` | Público (requiere token) | Cambia contraseña con token de `PasswordResetToken` |
| POST | `/auth/password/change` | Autenticado | Cambia contraseña estando logueado |
| POST | `/auth/2fa/enable` | Autenticado | Activa doble factor (`TwoFactorAuth`) |
| POST | `/auth/2fa/verify` | Público (requiere `tempToken`) | Verifica código OTP y completa el login |

```ts
interface LoginRequest {
  usuario: string;   // email o cédula
  password: string;
}

type AuthenticatedUser = Prisma.UserGetPayload<{
  include: { person: true; role: true };
}>;

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  requiresTwoFactor: boolean;
  tempToken?: string;         // presente si requiresTwoFactor = true
  user?: AuthenticatedUser;   // ausente si requiresTwoFactor = true
}

interface RefreshRequest { refreshToken: string; }
interface RefreshResponse { accessToken: string; refreshToken: string; }

interface ForgotPasswordRequest { email: string; }
interface ResetPasswordRequest { token: string; newPassword: string; }
interface ChangePasswordRequest { currentPassword: string; newPassword: string; }

interface Enable2FAResponse { secret: string; qrCodeUrl: string; }
interface Verify2FARequest { tempToken: string; code: string; }
```

---

## 2. Usuarios y Roles (RF-02 / RNF-02)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/users` | ADMIN | Lista usuarios (filtros: `status`, `roleId`) |
| GET | `/users/:id` | ADMIN, propio usuario | Detalle |
| POST | `/users/register` | Público | Autorregistro de Admin Empresa / Usuario Delegado |
| PATCH | `/users/:id` | ADMIN, propio usuario | Editar datos de persona |
| PATCH | `/users/:id/status` | ADMIN | Aprobar / rechazar registro |
| DELETE | `/users/:id` | ADMIN | Desactivar usuario (soft delete vía `isActive`) |
| GET | `/roles` | ADMIN | Catálogo de roles |

```ts
type UserWithPerson = Prisma.UserGetPayload<{ include: { person: true; role: true } }>;

interface RegisterUserRequest {
  person: Pick<Prisma.PersonCreateInput, 'name' | 'cedula' | 'phone' | 'email'>;
  password: string;
  roleId: number;                 // ADMIN_EMPRESA | USUARIO_DELEGADO
  cartaAutorizacionFileId?: number; // Attachment previamente subido (categoría CARTA_AUTORIZACION)
}

type RegisterUserResponse = UserWithPerson; // status = PENDIENTE_VALIDACION

interface UpdateUserStatusRequest {
  status: 'APROBADO' | 'RECHAZADO';
  motivoRechazo?: string;
}

type Role = Prisma.RoleGetPayload<{}>;
```

---

## 3. Empresas / Instituciones (RF-03)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/institutions` | ADMIN, COORDINADOR | Lista (filtros: `provinceId`, `municipalityId`, `rnc`, `q`) |
| GET | `/institutions/:id` | Todos los roles con acceso a la empresa | Detalle + representantes + histórico resumido |
| GET | `/institutions/:id/history` | Todos con acceso | RF-03 "Consultar historial" → casos + evaluaciones |
| GET | `/institutions/:id/evaluations` | Todos con acceso | RF-03 "Consultar evaluaciones previas" |
| POST | `/institutions` | ADMIN_EMPRESA | Registrar empresa |
| PATCH | `/institutions/:id` | ADMIN_EMPRESA, ADMIN | Editar información |
| POST | `/institutions/:id/representatives` | ADMIN_EMPRESA | Agregar representante (Legal/Calidad/Contacto) |
| PATCH | `/representatives/:id` | ADMIN_EMPRESA | Editar representante |
| DELETE | `/representatives/:id` | ADMIN_EMPRESA | Quitar representante |
| GET | `/catalogs/provinces` | Autenticado | Catálogo de provincias |
| GET | `/catalogs/municipalities?provinceId=` | Autenticado | Catálogo de municipios |

```ts
type InstitutionDetail = Prisma.InstitutionGetPayload<{
  include: {
    municipality: { include: { province: true } };
    representantes: { include: { person: true } };
    propietary: { include: { person: true } };
  };
}>;

type CreateInstitutionRequest = Pick<
  Prisma.InstitutionCreateInput,
  | 'name' | 'streetName' | 'streetNum' | 'phoneNumber' | 'email' | 'rnc'
  | 'nombreComercial' | 'actividadEconomica'
> & {
  municipalityId: number;
};

type UpdateInstitutionRequest = Partial<CreateInstitutionRequest>;

type Represent = Prisma.RepresentGetPayload<{ include: { person: true } }>;

interface CreateRepresentRequest {
  person: Pick<Prisma.PersonCreateInput, 'name' | 'cedula' | 'phone' | 'email'>;
  type: 'LEGAL' | 'CALIDAD' | 'CONTACTO';
}

interface InstitutionHistoryResponse {
  cases: Case[];                 // ver sección 6
  evaluations: EvaluationListItem[]; // ver sección 7
  saPermits: Prisma.SaPermitGetPayload<{}>[];
}
```

---

## 4. Dashboard (RF-04)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/dashboard/empresa` | ADMIN_EMPRESA, USUARIO_DELEGADO | Widgets: solicitudes, evaluaciones, notificaciones |
| GET | `/dashboard/coordinador` | COORDINADOR | Casos pendientes, evaluaciones programadas, alertas, denuncias, asignaciones pendientes |
| GET | `/dashboard/tecnico` | TECNICO_EVALUADOR | Evaluaciones asignadas, calendario, pendientes de informe |

```ts
interface DashboardEmpresaResponse {
  misSolicitudes: BpmRequestListItem[];   // últimas N
  evaluaciones: EvaluationListItem[];
  notificacionesNoLeidas: number;
}

interface DashboardCoordinadorResponse {
  casosPendientes: number;
  evaluacionesProgramadas: EvaluationListItem[];
  alertasLapchAbiertas: LapchAlert[];
  denunciasAbiertas: Complaint[];
  asignacionesPendientes: Case[];
}

interface DashboardTecnicoResponse {
  evaluacionesAsignadas: EvaluationListItem[];
  calendario: Pick<Evaluation, 'evaluationId' | 'scheduledDate' | 'status'>[];
  pendientesDeInforme: EvaluationListItem[];
}
```

---

## 5. Solicitudes BPM (RF-05)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/bpm-requests` | ADMIN_EMPRESA, USUARIO_DELEGADO, COORDINADOR | Lista (filtro `status`, `institutionId`) |
| GET | `/bpm-requests/:id` | Con acceso a la empresa, COORDINADOR | Detalle |
| POST | `/bpm-requests` | ADMIN_EMPRESA, USUARIO_DELEGADO | Crear (guarda como `BORRADOR`) |
| PATCH | `/bpm-requests/:id` | Autor mientras esté en `BORRADOR` | Editar borrador |
| POST | `/bpm-requests/:id/attachments` | Autor | Adjuntar documentación obligatoria |
| POST | `/bpm-requests/:id/submit` | Autor | Enviar (`BORRADOR` → `PENDIENTE_ASIGNACION`, crea `Case` con `origin = SOLICITUD_EMPRESA`) |

```ts
type BpmRequestListItem = Prisma.BpmRequestGetPayload<{
  include: { institution: { select: { institutionId: true; name: true } } };
}>;

type BpmRequestDetail = Prisma.BpmRequestGetPayload<{
  include: { institution: true; attachments: true; case: true };
}>;

type CreateBpmRequestRequest = Pick<
  Prisma.BpmRequestCreateInput,
  'tipoEstablecimiento' | 'motivo' | 'observaciones'
> & { institutionId: number };

type UpdateBpmRequestRequest = Partial<CreateBpmRequestRequest>;

interface SubmitBpmRequestResponse {
  bpmRequest: BpmRequestDetail;   // status = PENDIENTE_ASIGNACION
  case: Case;                     // creado automáticamente
}
```

---

## 6. Casos / Expedientes (RF-06, RF-19)

Un `Case` se origina desde una `BpmRequest`, una programación institucional directa, una
`LapchAlert` o una `Complaint` (RF-06, `origin`).

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/cases` | COORDINADOR, ADMIN | Lista (filtros: `origin`, `status`, `priority`, `institutionId`, `technicianId`) |
| GET | `/cases/:id` | COORDINADOR, técnico asignado, ADMIN | Detalle completo |
| POST | `/cases` | COORDINADOR | Origina caso por **programación institucional** (`origin = PROGRAMACION_INSTITUCIONAL`) |
| PATCH | `/cases/:id/priority` | COORDINADOR | Cambiar prioridad |
| POST | `/cases/:id/close` | COORDINADOR | RF-19: Cierre de expediente |
| GET | `/cases/:id/close/pdf` | COORDINADOR, ADMIN_EMPRESA (de esa empresa) | Descargar informe oficial PDF |

```ts
type Case = Prisma.CaseGetPayload<{}>;

type CaseDetail = Prisma.CaseGetPayload<{
  include: {
    institution: true;
    coordinator: { include: { person: true } };
    technician: { include: { person: true } };
    bpmRequest: true;
    lapchAlert: true;
    complaint: true;
    evaluations: true;
    assignments: true;
    attachments: true;
  };
}>;

interface CreateInstitutionalCaseRequest {
  institutionId: number;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
  motivo: string; // se usa para crear el Evaluation.reason inicial
}

interface CloseCaseRequest {
  resultadoFinal: string;
  emitirInforme: boolean;   // si true, genera y adjunta el PDF oficial
}

interface CloseCaseResponse {
  case: CaseDetail;             // status = CERRADO, closedAt seteado
  informeOficialUrl?: string;
}
```

---

## 7. Programación de Evaluaciones (RF-07) y Calendario (RF-11)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/evaluations` | COORDINADOR, TECNICO_EVALUADOR (propias) | Lista (filtros: `status`, `technicianId`, `institutionId`, rango de fechas) |
| GET | `/evaluations/:id` | Con acceso | Detalle |
| POST | `/evaluations` | COORDINADOR | Programar evaluación sobre un `Case` |
| PATCH | `/evaluations/:id/reschedule` | COORDINADOR | Reprogramar (`status = REPROGRAMADA`) |
| POST | `/evaluations/:id/cancel` | COORDINADOR | Cancelar (`status = CANCELADA`) |
| GET | `/evaluations/calendar` | TECNICO_EVALUADOR | RF-11: vista día/semana/mes del propio calendario |

```ts
type EvaluationListItem = Prisma.EvaluationGetPayload<{
  include: {
    institution: { select: { institutionId: true; name: true; streetName: true } };
    technician: { include: { person: true } };
  };
}>;

interface CreateEvaluationRequest {
  caseId: number;
  technicianId: number;
  scheduledDate: string;     // ISO 8601
  reason?: string;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
  observations?: string;
}

interface RescheduleEvaluationRequest {
  scheduledDate: string;
  observations?: string;
}

interface CalendarQuery {
  from: string;               // ISO date
  to: string;                 // ISO date
  view: 'day' | 'week' | 'month';
}

type CalendarResponse = Pick<
  Evaluation,
  'evaluationId' | 'scheduledDate' | 'status' | 'institutionId'
>[];
```

---

## 8. Alertas LAPCH (RF-08)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/lapch-alerts` | COORDINADOR, ADMIN | Lista (filtro `resultado`) |
| GET | `/lapch-alerts/:id` | COORDINADOR, ADMIN | Detalle |
| POST | `/lapch-alerts` | COORDINADOR, ADMIN | Registrar alerta |
| PATCH | `/lapch-alerts/:id/resultado` | COORDINADOR | Definir `PROCEDE` / `NO_PROCEDE` |
| POST | `/lapch-alerts/:id/generate-case` | COORDINADOR | Genera `Case` (`origin = ALERTA_LAPCH`) cuando `resultado = PROCEDE` |
| POST | `/lapch-alerts/:id/close` | COORDINADOR | Cerrar caso sin generar evaluación |

```ts
type LapchAlert = Prisma.LapchAlertGetPayload<{}>;

type CreateLapchAlertRequest = Pick<
  Prisma.LapchAlertCreateInput,
  'numeroAlerta' | 'fecha' | 'producto' | 'descripcion'
> & { institutionId: number };

interface SetLapchResultRequest { resultado: 'PROCEDE' | 'NO_PROCEDE'; }

interface GenerateCaseFromAlertResponse { case: Case; }
```

---

## 9. Denuncias (RF-09)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/complaints` | COORDINADOR, ADMIN | Lista (filtro `resultado`) |
| GET | `/complaints/:id` | COORDINADOR, ADMIN | Detalle |
| POST | `/complaints` | COORDINADOR, ADMIN, Público (formulario de denuncia) | Registrar denuncia |
| PATCH | `/complaints/:id/resultado` | COORDINADOR | `PROCEDE` / `NO_PROCEDE` / `REMISION_OTRO_PROCESO` |
| POST | `/complaints/:id/generate-case` | COORDINADOR | Genera `Case` (`origin = DENUNCIA`) cuando procede |

```ts
type Complaint = Prisma.ComplaintGetPayload<{}>;

type CreateComplaintRequest = Pick<
  Prisma.ComplaintCreateInput,
  'tipoDenuncia' | 'fechaRecepcion' | 'denunciante' | 'descripcion'
> & { institutionId?: number };

interface SetComplaintResultRequest {
  resultado: 'PROCEDE' | 'NO_PROCEDE' | 'REMISION_OTRO_PROCESO';
}
```

---

## 10. Asignación de Evaluador (RF-10)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/cases/:id/assignments` | COORDINADOR | Historial de asignaciones |
| POST | `/cases/:id/assign` | COORDINADOR | Asignar evaluador |
| POST | `/cases/:id/reassign` | COORDINADOR | Reasignar (crea nuevo `Assignment` con `isReassignment = true`) |

```ts
type Assignment = Prisma.AssignmentGetPayload<{
  include: { assignedTo: { include: { person: true } } };
}>;

interface AssignTechnicianRequest {
  technicianId: number;
  notes?: string;
}
```

---

## 11. Ejecución de Evaluación (RF-12) y Formulario EBR (RF-13)

### 11.1 Plantillas / árbol de preguntas (solo lectura para el técnico)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/form-templates` | ADMIN, COORDINADOR | Lista plantillas activas |
| GET | `/form-templates/:id/tree` | Todos los roles operativos | Árbol completo `h1 → h2 → h3 → h4` con sus `*_ask` |

```ts
type FormTemplateTree = Prisma.FormTemplateGetPayload<{
  include: {
    h1s: {
      include: {
        h1Asks: true;
        h2s: { include: { h2Asks: true; h3s: { include: { h3Asks: true; h4s: { include: { h4Asks: true } } } } } };
      };
    };
  };
}>;
```

### 11.2 Ejecución en campo

| Método | Path | Roles | Descripción |
|---|---|---|---|
| POST | `/evaluations/:id/start` | TECNICO_EVALUADOR asignado | `status → EN_PROCESO`, crea `FormResponse` vacío |
| PATCH | `/evaluations/:id/answers` | TECNICO_EVALUADOR asignado | Guardar avance (upsert parcial del JSON `answers`) |
| POST | `/evaluations/:id/finish` | TECNICO_EVALUADOR asignado | Finalizar → dispara motor de riesgo (RF-14) y genera informe (RF-16) |

```ts
// Estructura del JSON `form_response.answers`, tipada para el front:
type AskValue = 'C' | 'CP' | 'IT' | 'N/A' | 'NC';

interface AskAnswer {
  askId: string;              // ej. "h3_ask:123"
  value: AskValue;
  observaciones?: string;
  comentarios?: string;
}

interface FormAnswersPayload {
  answers: AskAnswer[];
}

type EvaluationExecutionDetail = Prisma.EvaluationGetPayload<{
  include: { formResponse: true; evidences: true };
}>;

interface FinishEvaluationResponse {
  evaluation: EvaluationExecutionDetail; // status = FINALIZADA
  score: EvaluationScore;                 // ver sección 12
  report: EvaluationReportDetail;         // ver sección 13
}
```

---

## 12. Motor de Riesgo (RF-14)

Cálculo automático; no expone escritura directa, solo lectura y el catálogo de reglas.

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/evaluations/:id/score` | Con acceso a la evaluación | Puntaje, % cumplimiento y nivel de riesgo |
| GET | `/catalogs/risk-frequency-rules` | ADMIN | Matriz de frecuencia de inspección (editable solo por ADMIN) |
| PATCH | `/catalogs/risk-frequency-rules/:id` | ADMIN | Ajustar umbrales de la matriz |

```ts
type EvaluationScore = Prisma.EvaluationScoreGetPayload<{}>;

type RiskFrequencyRule = Prisma.RiskFrequencyRuleGetPayload<{}>;
```

---

## 13. Captura de Evidencias (RF-15)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/evaluations/:id/evidences` | Con acceso | Lista de evidencias |
| POST | `/evaluations/:id/evidences` | TECNICO_EVALUADOR asignado | Subir foto/video/documento (`multipart/form-data`) |
| DELETE | `/evidences/:id` | TECNICO_EVALUADOR asignado, antes de finalizar | Eliminar evidencia |

```ts
type Evidence = Prisma.EvidenceGetPayload<{}>;

interface CreateEvidenceRequest {
  // multipart/form-data:
  file: File;
  type: 'FOTO' | 'VIDEO' | 'DOCUMENTO';
  comment?: string;
  latitude?: number;   // geolocalización opcional
  longitude?: number;
  h1AskId?: number;
  h2AskId?: number;
  h3AskId?: number;
  h4AskId?: number;
}
```

---

## 14. Informe de Evaluación (RF-16), Revisión (RF-17) y Correcciones (RF-18)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/evaluations/:id/report` | Con acceso | Obtener informe (autogenerado al finalizar) |
| POST | `/reports/:id/submit` | TECNICO_EVALUADOR | Enviar a revisión (`status: BORRADOR → ENVIADO`, `locked = true`) |
| POST | `/reports/:id/review` | COORDINADOR | RF-17: aprobar / devolver / solicitar corrección |
| GET | `/reports/:id/reviews` | Con acceso | Historial de revisiones |
| POST | `/reports/:id/correct` | TECNICO_EVALUADOR | RF-18: editar tras devolución (incrementa `version`, `locked = false` mientras se corrige) |
| POST | `/reports/:id/resend` | TECNICO_EVALUADOR | Reenviar corrección (`status → ENVIADO`, `locked = true`) |

```ts
type EvaluationReportDetail = Prisma.EvaluationReportGetPayload<{
  include: { attachments: true; reviews: { include: { coordinator: { include: { person: true } } } } };
}>;

interface ReviewReportRequest {
  action: 'APROBAR' | 'DEVOLVER' | 'SOLICITAR_CORRECCION';
  comments?: string;
}

type ReportReview = Prisma.ReportReviewGetPayload<{}>;

interface CorrectReportRequest {
  resumenEjecutivo?: string;
  hallazgos?: string;
  noConformidades?: string;
  recomendaciones?: string;
}
```

> Restricción de negocio (RF-17): el backend debe rechazar (`403`) cualquier `PATCH` sobre
> `FormResponse.answers` de una evaluación cuyo `EvaluationReport.locked = true`.

---

## 15. Consulta Histórica (RF-20)

Endpoint de búsqueda transversal; no es un recurso propio, sino un agregador de lectura.

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/history/search` | COORDINADOR, ADMIN, ADMIN_EMPRESA (limitado a su empresa) | Búsqueda combinada |

```ts
interface HistorySearchQuery extends PaginationQuery {
  institutionId?: number;
  bpmRequestId?: number;
  evaluationId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  status?: string;    // status de Case | Evaluation | BpmRequest, según `entityType`
  entityType?: 'CASE' | 'EVALUATION' | 'BPM_REQUEST';
}

interface HistorySearchItem {
  entityType: 'CASE' | 'EVALUATION' | 'BPM_REQUEST';
  id: number;
  institution: Pick<Institution, 'institutionId' | 'name'>;
  status: string;
  createdAt: string;
  score?: EvaluationScore;
  reportSummary?: Pick<EvaluationReport, 'reportId' | 'status'>;
}

type HistorySearchResponse = PaginatedResponse<HistorySearchItem>;
```

---

## 16. Notificaciones (soporte a RF-04)

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/notifications` | Autenticado | Lista propias (filtro `read`) |
| PATCH | `/notifications/:id/read` | Autenticado | Marcar como leída |
| PATCH | `/notifications/read-all` | Autenticado | Marcar todas como leídas |

```ts
type Notification = Prisma.NotificationGetPayload<{}>;
```

---

## 17. Catálogos y Adjuntos genéricos

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/catalogs/categories` | Autenticado | Categorías de alimento |
| GET | `/catalogs/categories/:id/subcategories` | Autenticado | Subcategorías + nivel de riesgo (Matriz_Riesgo_Alimentos) |
| GET | `/catalogs/foods?categoryId=` | Autenticado | Alimentos por categoría |
| GET | `/catalogs/health-areas` | Autenticado | Áreas de salud |
| POST | `/attachments` | Autenticado | Subida genérica (`multipart/form-data`); retorna `attachmentId` para asociar luego |
| GET | `/attachments/:id` | Con acceso a la entidad dueña | Descargar/ver metadato |
| DELETE | `/attachments/:id` | Dueño del recurso, ADMIN | Eliminar |

```ts
type Category = Prisma.CategoryGetPayload<{}>;
type SubCategory = Prisma.SubCategoryGetPayload<{}>;
type Food = Prisma.FoodGetPayload<{}>;
type HealthArea = Prisma.HealthAreaGetPayload<{}>;

interface UploadAttachmentRequest {
  file: File;
  category:
    | 'CARTA_AUTORIZACION'
    | 'DOCUMENTACION_OBLIGATORIA'
    | 'EVIDENCIA_FOTO'
    | 'EVIDENCIA_VIDEO'
    | 'EVIDENCIA_DOCUMENTO'
    | 'INFORME_ADJUNTO'
    | 'INFORME_OFICIAL_PDF'
    | 'OTRO';
}

type Attachment = Prisma.AttachmentGetPayload<{}>;
```

---

## 18. Mapa de errores estándar

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query no cumple el schema (zod/class-validator sobre los tipos de arriba) |
| `UNAUTHORIZED` | 401 | Token ausente o inválido |
| `FORBIDDEN` | 403 | Rol sin permiso, o recurso bloqueado (`locked`, `status` no editable) |
| `NOT_FOUND` | 404 | Id inexistente |
| `CONFLICT` | 409 | Duplicado (RNC, `numeroAlerta`, etc.) o transición de estado inválida |
| `INTERNAL_ERROR` | 500 | No controlado |

---

## 19. Siguiente paso sugerido para el mapeo a TS

1. Generar el cliente Prisma (`npx prisma generate`) para tener `Prisma.*` y los tipos base
   (`User`, `Institution`, `Case`, etc.) disponibles como import `import type { Prisma, User, ... } from '@prisma/client'`.
2. Copiar cada interfaz de este documento a `src/api/contracts/<modulo>.ts`, un archivo por
   sección (ej. `contracts/cases.ts`, `contracts/evaluations.ts`).
3. Los `Request` (`Create*Request`, `Update*Request`) se validan en runtime con `zod`
   generado a partir del mismo `Pick<Prisma.XCreateInput, ...>` para no duplicar la fuente de verdad.
4. Los `Response`/`*Detail`/`*ListItem` se derivan siempre de `Prisma.XGetPayload<{ include / select }>`
   para que cualquier cambio de relación en `schema.prisma` rompa la compilación de TS donde falte
   actualizar el `include`.
