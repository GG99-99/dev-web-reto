-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDIENTE_VALIDACION', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('CARTA_AUTORIZACION', 'DOCUMENTACION_OBLIGATORIA', 'EVIDENCIA_FOTO', 'EVIDENCIA_VIDEO', 'EVIDENCIA_DOCUMENTO', 'INFORME_ADJUNTO', 'INFORME_OFICIAL_PDF', 'OTRO');

-- CreateEnum
CREATE TYPE "BpmRequestStatus" AS ENUM ('BORRADOR', 'PENDIENTE_ASIGNACION', 'EN_REVISION', 'RECHAZADA', 'APROBADA');

-- CreateEnum
CREATE TYPE "CaseOrigin" AS ENUM ('SOLICITUD_EMPRESA', 'PROGRAMACION_INSTITUCIONAL', 'ALERTA_LAPCH', 'DENUNCIA');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ABIERTO', 'ASIGNADO', 'EN_EVALUACION', 'EN_REVISION', 'CERRADO');

-- CreateEnum
CREATE TYPE "LapchResult" AS ENUM ('PROCEDE', 'NO_PROCEDE');

-- CreateEnum
CREATE TYPE "ComplaintResult" AS ENUM ('PROCEDE', 'NO_PROCEDE', 'REMISION_OTRO_PROCESO');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PROGRAMADA', 'REPROGRAMADA', 'CANCELADA', 'EN_PROCESO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "InspectionFrequency" AS ENUM ('ANUAL', 'SEMESTRAL', 'TRIMESTRAL');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FOTO', 'VIDEO', 'DOCUMENTO');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('BORRADOR', 'ENVIADO', 'APROBADO', 'DEVUELTO', 'EN_CORRECCION');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('APROBAR', 'DEVOLVER', 'SOLICITAR_CORRECCION');

-- CreateEnum
CREATE TYPE "RepresentType" AS ENUM ('LEGAL', 'CALIDAD', 'CONTACTO');

-- CreateTable
CREATE TABLE "person" (
    "person_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("person_id")
);

-- CreateTable
CREATE TABLE "user" (
    "user_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "role_id" INTEGER,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "propietary" (
    "propietary_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,

    CONSTRAINT "propietary_pkey" PRIMARY KEY ("propietary_id")
);

-- CreateTable
CREATE TABLE "represent" (
    "represent_id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "institution_id" INTEGER,
    "type" "RepresentType",

    CONSTRAINT "represent_pkey" PRIMARY KEY ("represent_id")
);

-- CreateTable
CREATE TABLE "institution" (
    "institution_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "street_num" INTEGER NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rnc" TEXT NOT NULL,
    "propietary_id" INTEGER NOT NULL,
    "nombre_comercial" TEXT,
    "actividad_economica" TEXT,
    "municipality_id" INTEGER,

    CONSTRAINT "institution_pkey" PRIMARY KEY ("institution_id")
);

-- CreateTable
CREATE TABLE "institution_status" (
    "institution_status_id" SERIAL NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_status_pkey" PRIMARY KEY ("institution_status_id")
);

-- CreateTable
CREATE TABLE "institution_status_question" (
    "institution_status_question_id" SERIAL NOT NULL,
    "institution_status_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "institution_status_question_pkey" PRIMARY KEY ("institution_status_question_id")
);

-- CreateTable
CREATE TABLE "sa_permit" (
    "sa_permit_uuid" SERIAL NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "form_response_id" INTEGER NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "institution_id" INTEGER NOT NULL,

    CONSTRAINT "sa_permit_pkey" PRIMARY KEY ("sa_permit_uuid")
);

-- CreateTable
CREATE TABLE "category" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "sub_category" (
    "sub_category_id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "risk" INTEGER NOT NULL,

    CONSTRAINT "sub_category_pkey" PRIMARY KEY ("sub_category_id")
);

-- CreateTable
CREATE TABLE "food" (
    "food_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "food_pkey" PRIMARY KEY ("food_id")
);

-- CreateTable
CREATE TABLE "form_template" (
    "form_template_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_template_pkey" PRIMARY KEY ("form_template_id")
);

-- CreateTable
CREATE TABLE "form_response" (
    "form_response_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL,
    "form_template_id" INTEGER NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "represent_id" INTEGER NOT NULL,
    "food_id" INTEGER NOT NULL,
    "motive" TEXT NOT NULL,
    "answers" JSONB NOT NULL,

    CONSTRAINT "form_response_pkey" PRIMARY KEY ("form_response_id")
);

-- CreateTable
CREATE TABLE "h1" (
    "h1_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "form_id" INTEGER NOT NULL,
    "form_template_id" INTEGER NOT NULL,

    CONSTRAINT "h1_pkey" PRIMARY KEY ("h1_id")
);

-- CreateTable
CREATE TABLE "h1_ask" (
    "h1_ask_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "h1_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "h1_ask_pkey" PRIMARY KEY ("h1_ask_id")
);

-- CreateTable
CREATE TABLE "h2" (
    "h2_id" SERIAL NOT NULL,
    "h1_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "h2_pkey" PRIMARY KEY ("h2_id")
);

-- CreateTable
CREATE TABLE "h2_ask" (
    "h2_ask_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "h2_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "h2_ask_pkey" PRIMARY KEY ("h2_ask_id")
);

-- CreateTable
CREATE TABLE "h3" (
    "h3_id" SERIAL NOT NULL,
    "h2_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "h3_pkey" PRIMARY KEY ("h3_id")
);

-- CreateTable
CREATE TABLE "h3_ask" (
    "h3_ask_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "h3_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "h3_ask_pkey" PRIMARY KEY ("h3_ask_id")
);

-- CreateTable
CREATE TABLE "h4" (
    "h4_id" SERIAL NOT NULL,
    "h3_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "h4_pkey" PRIMARY KEY ("h4_id")
);

-- CreateTable
CREATE TABLE "h4_ask" (
    "h4_ask_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "h4_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "h4_ask_pkey" PRIMARY KEY ("h4_ask_id")
);

-- CreateTable
CREATE TABLE "ask_auditory" (
    "ask_auditory_id" SERIAL NOT NULL,
    "h_id" TEXT NOT NULL,
    "h_num" INTEGER NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "ask_auditory_pkey" PRIMARY KEY ("ask_auditory_id")
);

-- CreateTable
CREATE TABLE "role" (
    "role_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "role_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "token_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "two_factor_auth" (
    "user_id" INTEGER NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "province" (
    "province_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "province_pkey" PRIMARY KEY ("province_id")
);

-- CreateTable
CREATE TABLE "municipality" (
    "municipality_id" SERIAL NOT NULL,
    "province_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "municipality_pkey" PRIMARY KEY ("municipality_id")
);

-- CreateTable
CREATE TABLE "health_area" (
    "health_area_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "health_area_pkey" PRIMARY KEY ("health_area_id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "attachment_id" SERIAL NOT NULL,
    "category" "AttachmentCategory" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "uploaded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_registration_id" INTEGER,
    "bpm_request_id" INTEGER,
    "evaluation_report_id" INTEGER,
    "case_id" INTEGER,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateTable
CREATE TABLE "bpm_request" (
    "bpm_request_id" SERIAL NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "tipo_establecimiento" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "observaciones" TEXT,
    "status" "BpmRequestStatus" NOT NULL DEFAULT 'BORRADOR',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "form_response_id" INTEGER,

    CONSTRAINT "bpm_request_pkey" PRIMARY KEY ("bpm_request_id")
);

-- CreateTable
CREATE TABLE "case" (
    "case_id" SERIAL NOT NULL,
    "origin" "CaseOrigin" NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "priority" "CasePriority" NOT NULL DEFAULT 'MEDIA',
    "status" "CaseStatus" NOT NULL DEFAULT 'ABIERTO',
    "coordinator_id" INTEGER,
    "technician_id" INTEGER,
    "bpm_request_id" INTEGER,
    "lapch_alert_id" INTEGER,
    "complaint_id" INTEGER,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "resultado_final" TEXT,

    CONSTRAINT "case_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "lapch_alert" (
    "alert_id" SERIAL NOT NULL,
    "numero_alerta" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "producto" TEXT NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "resultado" "LapchResult",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lapch_alert_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "complaint" (
    "complaint_id" SERIAL NOT NULL,
    "tipo_denuncia" TEXT NOT NULL,
    "fecha_recepcion" TIMESTAMP(3) NOT NULL,
    "denunciante" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "resultado" "ComplaintResult",
    "institution_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_pkey" PRIMARY KEY ("complaint_id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "assignment_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "assigned_to" INTEGER NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "is_reassignment" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "evaluation" (
    "evaluation_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "technician_id" INTEGER NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "priority" "CasePriority" NOT NULL DEFAULT 'MEDIA',
    "observations" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "form_response_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_pkey" PRIMARY KEY ("evaluation_id")
);

-- CreateTable
CREATE TABLE "risk_frequency_rule" (
    "rule_id" SERIAL NOT NULL,
    "min_score" DOUBLE PRECISION NOT NULL,
    "max_score" DOUBLE PRECISION,
    "risk_level" "RiskLevel" NOT NULL,
    "frequency" "InspectionFrequency" NOT NULL,

    CONSTRAINT "risk_frequency_rule_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "evaluation_score" (
    "evaluation_id" INTEGER NOT NULL,
    "puntaje_obtenido" DOUBLE PRECISION NOT NULL,
    "porcentaje_cumplimiento" DOUBLE PRECISION NOT NULL,
    "nivel_riesgo" "RiskLevel" NOT NULL,
    "frecuencia_inspeccion" "InspectionFrequency" NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_score_pkey" PRIMARY KEY ("evaluation_id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "evidence_id" SERIAL NOT NULL,
    "evaluation_id" INTEGER NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "comment" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "h1_ask_id" INTEGER,
    "h2_ask_id" INTEGER,
    "h3_ask_id" INTEGER,
    "h4_ask_id" INTEGER,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "evaluation_report" (
    "report_id" SERIAL NOT NULL,
    "evaluation_id" INTEGER NOT NULL,
    "resumen_ejecutivo" TEXT NOT NULL,
    "hallazgos" TEXT NOT NULL,
    "no_conformidades" TEXT NOT NULL,
    "recomendaciones" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_report_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "report_review" (
    "review_id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "coordinator_id" INTEGER NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "comments" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_review_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_person_id_key" ON "user"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "propietary_person_id_key" ON "propietary"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_token_key" ON "password_reset_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "province_name_key" ON "province"("name");

-- CreateIndex
CREATE UNIQUE INDEX "health_area_name_key" ON "health_area"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bpm_request_form_response_id_key" ON "bpm_request"("form_response_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_bpm_request_id_key" ON "case"("bpm_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_lapch_alert_id_key" ON "case"("lapch_alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_complaint_id_key" ON "case"("complaint_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_form_response_id_key" ON "evaluation"("form_response_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_report_evaluation_id_key" ON "evaluation_report"("evaluation_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propietary" ADD CONSTRAINT "propietary_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "represent" ADD CONSTRAINT "represent_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "represent" ADD CONSTRAINT "represent_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution" ADD CONSTRAINT "institution_propietary_id_fkey" FOREIGN KEY ("propietary_id") REFERENCES "propietary"("propietary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution" ADD CONSTRAINT "institution_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipality"("municipality_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_status" ADD CONSTRAINT "institution_status_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_status_question" ADD CONSTRAINT "institution_status_question_institution_status_id_fkey" FOREIGN KEY ("institution_status_id") REFERENCES "institution_status"("institution_status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sa_permit" ADD CONSTRAINT "sa_permit_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "form_response"("form_response_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sa_permit" ADD CONSTRAINT "sa_permit_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_category" ADD CONSTRAINT "sub_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response" ADD CONSTRAINT "form_response_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "form_template"("form_template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response" ADD CONSTRAINT "form_response_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response" ADD CONSTRAINT "form_response_represent_id_fkey" FOREIGN KEY ("represent_id") REFERENCES "represent"("represent_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response" ADD CONSTRAINT "form_response_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("food_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1" ADD CONSTRAINT "h1_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "form_template"("form_template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_ask" ADD CONSTRAINT "h1_ask_h1_id_fkey" FOREIGN KEY ("h1_id") REFERENCES "h1"("h1_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h2" ADD CONSTRAINT "h2_h1_id_fkey" FOREIGN KEY ("h1_id") REFERENCES "h1"("h1_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h2_ask" ADD CONSTRAINT "h2_ask_h2_id_fkey" FOREIGN KEY ("h2_id") REFERENCES "h2"("h2_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h3" ADD CONSTRAINT "h3_h2_id_fkey" FOREIGN KEY ("h2_id") REFERENCES "h2"("h2_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h3_ask" ADD CONSTRAINT "h3_ask_h3_id_fkey" FOREIGN KEY ("h3_id") REFERENCES "h3"("h3_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h4" ADD CONSTRAINT "h4_h3_id_fkey" FOREIGN KEY ("h3_id") REFERENCES "h3"("h3_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h4_ask" ADD CONSTRAINT "h4_ask_h4_id_fkey" FOREIGN KEY ("h4_id") REFERENCES "h4"("h4_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipality" ADD CONSTRAINT "municipality_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_bpm_request_id_fkey" FOREIGN KEY ("bpm_request_id") REFERENCES "bpm_request"("bpm_request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_evaluation_report_id_fkey" FOREIGN KEY ("evaluation_report_id") REFERENCES "evaluation_report"("report_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpm_request" ADD CONSTRAINT "bpm_request_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpm_request" ADD CONSTRAINT "bpm_request_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpm_request" ADD CONSTRAINT "bpm_request_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "form_response"("form_response_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_bpm_request_id_fkey" FOREIGN KEY ("bpm_request_id") REFERENCES "bpm_request"("bpm_request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_lapch_alert_id_fkey" FOREIGN KEY ("lapch_alert_id") REFERENCES "lapch_alert"("alert_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaint"("complaint_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lapch_alert" ADD CONSTRAINT "lapch_alert_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "form_response"("form_response_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_score" ADD CONSTRAINT "evaluation_score_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluation"("evaluation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluation"("evaluation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_report" ADD CONSTRAINT "evaluation_report_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluation"("evaluation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_review" ADD CONSTRAINT "report_review_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "evaluation_report"("report_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_review" ADD CONSTRAINT "report_review_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
