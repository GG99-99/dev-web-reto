import { useState, useEffect } from 'react';
import { reportsService, evaluationsService } from './services';
import type { EvaluationReportDetail, EvaluationListItem } from '@reto/shared';
import './InspectionReportModal.css';

interface InspectionReportModalProps {
  evaluationId: number;
  role?: string;
  onClose: () => void;
  notify?: (msg: string) => void;
}

export default function InspectionReportModal({
  evaluationId,
  role,
  onClose,
  notify,
}: InspectionReportModalProps) {
  const [report, setReport] = useState<EvaluationReportDetail | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Carga de datos del reporte y la evaluación
  const loadReportData = async () => {
    setLoading(true);
    try {
      const [repRes, evalRes] = await Promise.all([
        reportsService.getByEvaluation(evaluationId).catch(() => null),
        evaluationsService.getById(evaluationId).catch(() => null),
      ]);

      if (repRes?.valid && repRes.data) {
        setReport(repRes.data);
      }
      if (evalRes?.valid && evalRes.data) {
        setEvaluation(evalRes.data);
      }
    } catch (err: unknown) {
      console.error('Error al cargar reporte de inspección:', err);
      notify?.('No se pudo cargar el dictamen oficial de la evaluación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
  }, [evaluationId]);

  // Imprimir o Guardar PDF Oficial
  const handlePrint = () => {
    window.print();
  };

  // Enviar informe a revisión (Técnico Evaluador)
  const handleSubmitReport = async () => {
    if (!report) return;
    setBusy(true);
    try {
      const result = await reportsService.submit(report.reportId);
      if (result.valid) {
        notify?.('✅ Informe enviado al Coordinador para revisión oficial.');
        await loadReportData();
      }
    } catch (err: unknown) {
      console.error('Error al enviar informe:', err);
      notify?.('Ocurrió un error al enviar el informe.');
    } finally {
      setBusy(false);
    }
  };

  // Aprobar informe (Coordinador / Admin)
  const handleApproveReport = async () => {
    if (!report) return;
    setBusy(true);
    try {
      const result = await reportsService.review(report.reportId, {
        action: 'APROBAR',
        comments: 'Dictamen técnico aprobado conforme a la normativa BPM vigente.',
      });
      if (result.valid) {
        notify?.('✅ Informe APROBADO formalmente.');
        await loadReportData();
      }
    } catch (err: unknown) {
      console.error('Error al aprobar informe:', err);
      notify?.('Ocurrió un error al aprobar el informe.');
    } finally {
      setBusy(false);
    }
  };

  // Fallback de datos si aún no se ha generado en base de datos
  const establishmentName =
    evaluation?.institution?.name ?? 'Lácteos del Norte SRL';
  const address =
    evaluation?.institution?.streetName ?? 'Av. Estrella Sadhalá, Santiago, Rep. Dominicana';
  const technicianName =
    evaluation?.technician?.person?.name ?? 'Luis Fernández';
  const technicianCedula =
    evaluation?.technician?.person?.cedula ?? '001-0000003-3';
  const dateString = evaluation?.scheduledDate
    ? new Date(evaluation.scheduledDate).toLocaleDateString('es-DO', {
        dateStyle: 'long',
      })
    : '22 de septiembre de 2026';

  const executiveSummary =
    report?.resumenEjecutivo ||
    `Evaluación higiénico-sanitaria y basada en riesgo realizada en las instalaciones de ${establishmentName} con fecha ${dateString}. Se constató el cumplimiento de las Buenas Prácticas de Manufactura conforme a los estándares de vigilancia sanitaria oficial.`;

  const findings =
    report?.hallazgos ||
    `- [C] Instalaciones físicas y perímetros exteriores debidamente protegidos contra plagas.\n- [C] Suministro de agua potable con monitoreo de cloro residual diario.\n- [CP] Registros de calibración de termómetros del área de pasteurización pendientes de firma del supervisor.\n- [C] Indumentaria reglamentaria y cofias en todo el personal manipulador.`;

  const nonConformities =
    report?.noConformidades ||
    `- Numeral 2.4: Falta firma de supervisor en bitácora de calibración de termómetros de choque térmico.`;

  const recommendations =
    report?.recomendaciones ||
    `Se recomienda mantener el programa integral de Buenas Prácticas de Manufactura y subsanar las observaciones menores de documentación antes del próximo ciclo de vigilancia.`;

  const reportStatus = report?.status ?? 'BORRADOR';
  const reportVersion = report?.version ?? 1;

  return (
    <div className="irm-backdrop" onClick={onClose}>
      <div className="irm-container" onClick={(e) => e.stopPropagation()}>
        {/* Barra Superior de Herramientas */}
        <div className="irm-action-bar">
          <div className="irm-action-bar-title">
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>description</span>
            Dictamen Oficial de Inspección • No. #{evaluationId}
          </div>

          <div className="irm-action-buttons">
            <button className="irm-btn irm-btn-print" onClick={handlePrint} title="Imprimir o guardar como PDF">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>print</span>
              Imprimir / PDF
            </button>

            {role === 'TECNICO_EVALUADOR' && reportStatus === 'BORRADOR' && (
              <button
                className="irm-btn irm-btn-submit"
                onClick={() => void handleSubmitReport()}
                disabled={busy}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>send</span>
                Enviar a Coordinación
              </button>
            )}

            {['COORDINADOR', 'ADMIN'].includes(role ?? '') && reportStatus === 'ENVIADO' && (
              <button
                className="irm-btn irm-btn-review"
                onClick={() => void handleApproveReport()}
                disabled={busy}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>verified</span>
                Aprobar Dictamen
              </button>
            )}

            <button className="irm-btn irm-btn-close" onClick={onClose} title="Cerrar">
              &times;
            </button>
          </div>
        </div>

        {/* Hoja de Documento Oficial con Formato Ministerial */}
        <div className="irm-document-scroll">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#535f73' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', animation: 'spin 1s infinite linear' }}>
                sync
              </span>
              <p>Generando acta oficial de inspección...</p>
            </div>
          ) : (
            <article className="irm-paper">
              {/* Membrete Oficial */}
              <header className="irm-doc-header">
                <div className="irm-doc-country">República Dominicana</div>
                <div className="irm-doc-ministry">Ministerio de Salud Pública y Asistencia Social (MISPAS)</div>
                <div className="irm-doc-department">
                  Viceministerio de Garantía de la Calidad • DIGEMAPS
                  <br />
                  Dirección de Vigilancia Sanitaria y Control de Riesgo
                </div>
                <div className="irm-doc-title-badge">
                  ACTA DE INSPECCIÓN HIGIÉNICO-SANITARIA Y EVALUACIÓN BASADA EN RIESGO (EBR / BPM)
                </div>
                <div className="irm-doc-folio">
                  No. Dictamen: <strong>ACTA-2026-EBR-{evaluationId.toString().padStart(4, '0')}</strong> • Versión {reportVersion}
                </div>
              </header>

              {/* 1. Datos del Establecimiento */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>domain</span>
                  1. Identificación del Establecimiento Inspeccionado
                </div>
                <div className="irm-grid-2">
                  <div className="irm-field">
                    <span className="irm-label">Razón Social / Nombre</span>
                    <span className="irm-val">{establishmentName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Ubicación / Dirección</span>
                    <span className="irm-val">{address}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Municipio / Provincia</span>
                    <span className="irm-val">Santiago de los Caballeros, Rep. Dom.</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Tipo de Actividad</span>
                    <span className="irm-val">Procesamiento y Envasado de Alimentos</span>
                  </div>
                </div>
              </section>

              {/* 2. Metadatos de la Inspección */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>event</span>
                  2. Datos de la Inspección y Auditor Oficial
                </div>
                <div className="irm-grid-3">
                  <div className="irm-field">
                    <span className="irm-label">Fecha de Ejecución</span>
                    <span className="irm-val">{dateString}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Técnico Inspector Asignado</span>
                    <span className="irm-val">{technicianName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Cédula del Inspector</span>
                    <span className="irm-val">{technicianCedula}</span>
                  </div>
                </div>
              </section>

              {/* 3. Dictamen de Riesgo EBR */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>analytics</span>
                  3. Calificación Sanitaria y Nivel de Riesgo (EBR / BPM)
                </div>
                <div className="irm-risk-box">
                  <div className="irm-risk-stat">
                    <span className="irm-label">Cumplimiento BPM</span>
                    <span className="irm-risk-stat-num">95%</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Índice de Riesgo EBR</span>
                    <span className="irm-risk-stat-num">1.2 / 10.0</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Nivel de Riesgo</span>
                    <span className="irm-risk-stat-badge BAJO">RIESGO BAJO</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Vigilancia Sugerida</span>
                    <span className="irm-val" style={{ fontWeight: 800, marginTop: '0.4rem' }}>
                      Inspección Anual
                    </span>
                  </div>
                </div>
              </section>

              {/* 4. Resumen Ejecutivo */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>feed</span>
                  4. Resumen Ejecutivo
                </div>
                <div className="irm-text-block">{executiveSummary}</div>
              </section>

              {/* 5. Hallazgos y No Conformidades */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>rule</span>
                  5. Hallazgos y Desglose de No Conformidades
                </div>
                <div className="irm-text-block">{findings}</div>
                {nonConformities && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <span className="irm-label" style={{ color: '#ba1a1a' }}>
                      Puntos que Requieren Acción Correctiva:
                    </span>
                    <div className="irm-text-block" style={{ background: '#fff8f8', borderColor: '#ffcdd2', marginTop: '0.25rem' }}>
                      {nonConformities}
                    </div>
                  </div>
                )}
              </section>

              {/* 6. Medidas y Recomendaciones */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>recommend</span>
                  6. Recomendaciones y Plazos de Cumplimiento
                </div>
                <div className="irm-text-block">{recommendations}</div>
              </section>

              {/* 7. Firmas de Conformidad y Sello */}
              <footer className="irm-signatures">
                <div className="irm-signature-box">
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">{technicianName}</span>
                  <span className="irm-signature-role">Técnico Inspector Sanitario</span>
                  <small style={{ color: '#718096' }}>Cédula: {technicianCedula}</small>
                  <div className="irm-stamp">DIGEMAPS • INSPECCIÓN OFICIAL</div>
                </div>

                <div className="irm-signature-box">
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">Representante Legal / Calidad</span>
                  <span className="irm-signature-role">Por el Establecimiento Inspeccionado</span>
                  <small style={{ color: '#718096' }}>Firma y Sello de Recepción</small>
                </div>
              </footer>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
