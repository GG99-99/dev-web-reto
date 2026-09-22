import { useState, useEffect } from 'react';
import { reportsService, evaluationsService, riskEngineService } from './services';
import type { EvaluationReportDetail, EvaluationListItem, EvaluationScore } from '@reto/shared';
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
  const [score, setScore] = useState<EvaluationScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Loading report data, evaluation and real risk engine score (RF-14)
  const loadReportData = async () => {
    setLoading(true);
    try {
      const [repRes, evalRes, scoreRes] = await Promise.all([
        reportsService.getByEvaluation(evaluationId).catch(() => null),
        evaluationsService.getById(evaluationId).catch(() => null),
        riskEngineService.getScore(evaluationId).catch(() => null),
      ]);

      if (repRes?.valid && repRes.data) {
        setReport(repRes.data);
      }
      if (evalRes?.valid && evalRes.data) {
        setEvaluation(evalRes.data);
      }
      if (scoreRes?.valid && scoreRes.data) {
        setScore(scoreRes.data);
      }
    } catch (err: unknown) {
      console.error('Error loading inspection report:', err);
      notify?.('Could not load the official evaluation report.');
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
        notify?.('✅ Report submitted to the Coordinator for official review.');
        await loadReportData();
      }
    } catch (err: unknown) {
      console.error('Error submitting report:', err);
      notify?.('An error occurred while submitting the report.');
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
        notify?.('✅ Report formally APPROVED.');
        await loadReportData();
      }
    } catch (err: unknown) {
      console.error('Error approving report:', err);
      notify?.('An error occurred while approving the report.');
    } finally {
      setBusy(false);
    }
  };

  const priorityLabel = (p?: string | null) => {
    if (!p) return '—';
    const map: Record<string, string> = { 'ALTA': 'High', 'MEDIA': 'Medium', 'BAJA': 'Low', 'NOT_SET': 'Not Set' };
    return map[p] ?? p.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const establishmentName = evaluation?.institution?.name ?? 'Not available';
  const address = evaluation?.institution?.streetName ?? 'Not available';
  const technicianName = evaluation?.technician?.person?.name ?? 'Not available';
  const technicianCedula = evaluation?.technician?.person?.cedula ?? 'Not available';
  const dateString = evaluation?.scheduledDate
    ? new Date(evaluation.scheduledDate).toLocaleDateString('en-US', {
        dateStyle: 'long',
      })
    : 'Not available';

  const executiveSummary = report?.resumenEjecutivo ?? '';

  const findings = report?.hallazgos ?? '';

  const nonConformities = report?.noConformidades ?? '';

  const recommendations = report?.recomendaciones ?? '';

  const reportStatus = report?.status;
  const reportVersion = report?.version;

  // Datos reales del motor de riesgo (RF-14). Si aún no se ha calculado
  // (evaluación no finalizada), se muestra un estado pendiente en vez de
  // inventar un porcentaje o nivel de riesgo.
  const hasScore = score !== null;
  const compliancePct = hasScore ? `${score!.porcentajeCumplimiento.toFixed(1)}%` : 'Pending';
  const riskIndex = hasScore ? `${score!.puntajeObtenido.toFixed(1)} / 10.0` : 'Pending';
  const riskLevel = score?.nivelRiesgo ?? null;
  const riskLevelLabel = riskLevel === 'ALTO' ? 'HIGH RISK' : riskLevel === 'MEDIO' ? 'MEDIUM RISK' : riskLevel === 'BAJO' ? 'LOW RISK' : 'PENDING';
  const frequencyLabel = score?.frecuenciaInspeccion
    ? score.frecuenciaInspeccion === 'ANUAL' ? 'Annual Inspection' : score.frecuenciaInspeccion === 'SEMESTRAL' ? 'Semi-annual Inspection' : 'Quarterly Inspection'
    : 'To be determined';

  return (
    <div className="irm-backdrop" onClick={onClose}>
      <div className="irm-container" onClick={(e) => e.stopPropagation()}>
        {/* Barra Superior de Herramientas */}
        <div className="irm-action-bar">
          <div className="irm-action-bar-title">
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>description</span>
            Official Inspection Report • No. #{evaluationId}
          </div>

          <div className="irm-action-buttons">
            <button className="irm-btn irm-btn-print" onClick={handlePrint} title="Imprimir o guardar como PDF" disabled={loading || !report}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>print</span>
              Print / PDF
            </button>

            {role === 'TECNICO_EVALUADOR' && reportStatus === 'BORRADOR' && (
              <button
                className="irm-btn irm-btn-submit"
                onClick={() => void handleSubmitReport()}
                disabled={busy}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>send</span>
                Submit to Coordinator
              </button>
            )}

            {['COORDINADOR', 'ADMIN'].includes(role ?? '') && reportStatus === 'ENVIADO' && (
              <button
                className="irm-btn irm-btn-review"
                onClick={() => void handleApproveReport()}
                disabled={busy}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>verified</span>
                Approve Report
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
              <p>Loading official inspection record...</p>
            </div>
          ) : !report ? (
            <div className="empty" role="status" style={{ margin: '2rem' }}>
              <p>No official inspection report has been generated for this assessment yet.</p>
              <small>Complete the field assessment and submit the generated report for review before publishing an official record.</small>
            </div>
          ) : (
            <article className="irm-paper">
              {/* Membrete Oficial */}
              <header className="irm-doc-header">
                <div className="irm-doc-country">Dominican Republic</div>
                <div className="irm-doc-ministry">Ministerio de Salud Pública y Asistencia Social (MISPAS)</div>
                <div className="irm-doc-department">
                  Viceministerio de Garantía de la Calidad • DIGEMAPS
                  <br />
                  Dirección de Vigilancia Sanitaria y Control de Riesgo
                </div>
                <div className="irm-doc-title-badge">
                  SANITARY INSPECTION RECORD & RISK-BASED EVALUATION (EBR / BPM)
                </div>
                <div className="irm-doc-folio">
                  Report No.: <strong>ACTA-2026-EBR-{evaluationId.toString().padStart(4, '0')}</strong> • Version {reportVersion}
                </div>
              </header>

              {/* 1. Datos del Establecimiento */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>domain</span>
                  1. Inspected Establishment Identification
                </div>
                <div className="irm-grid-2">
                  <div className="irm-field">
                    <span className="irm-label">Legal Name / Trade Name</span>
                    <span className="irm-val">{establishmentName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Location / Address</span>
                    <span className="irm-val">{address}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Municipality / Province</span>
                    <span className="irm-val">{evaluation?.institution?.municipality?.name ?? evaluation?.institution?.streetName ?? 'Not available'}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Activity Type</span>
                    <span className="irm-val">{evaluation?.institution?.actividadEconomica ?? 'Not specified'}</span>
                  </div>
                </div>
              </section>

              {/* 2. Metadatos de la Inspección */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>event</span>
                  2. Inspection Data & Official Auditor
                </div>
                <div className="irm-grid-3">
                  <div className="irm-field">
                    <span className="irm-label">Execution Date</span>
                    <span className="irm-val">{dateString}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Assigned Field Inspector</span>
                    <span className="irm-val">{technicianName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Inspector National ID</span>
                    <span className="irm-val">{technicianCedula}</span>
                  </div>
                </div>
              </section>

              {/* 3. Dictamen de Riesgo EBR */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>analytics</span>
                  3. Health Rating & Risk Level (EBR / BPM)
                </div>
                <div className="irm-risk-box">
                  <div className="irm-risk-stat">
                    <span className="irm-label">BPM Compliance</span>
                    <span className="irm-risk-stat-num">{compliancePct}</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">EBR Risk Index</span>
                    <span className="irm-risk-stat-num">{riskIndex}</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Risk Level</span>
                    <span className={`irm-risk-stat-badge ${riskLevel ?? ''}`}>{riskLevelLabel}</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Suggested Surveillance Frequency</span>
                    <span className="irm-val" style={{ fontWeight: 800, marginTop: '0.4rem' }}>
                      {frequencyLabel}
                    </span>
                  </div>
                </div>
                {!hasScore && (
                  <p style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                    The risk score is automatically calculated when the field evaluation is completed.
                  </p>
                )}
              </section>

              {/* 4. Resumen Ejecutivo */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>feed</span>
                  4. Executive Summary
                </div>
                <div className="irm-text-block">{executiveSummary}</div>
              </section>

              {/* 5. Hallazgos y No Conformidades */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>rule</span>
                  5. Findings & Non-Conformities Breakdown
                </div>
                <div className="irm-text-block">{findings}</div>
                {nonConformities && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <span className="irm-label" style={{ color: '#ba1a1a' }}>
                      Points Requiring Corrective Action:
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
                  6. Recommendations & Compliance Deadlines
                </div>
                <div className="irm-text-block">{recommendations}</div>
              </section>

              {/* 7. Firmas de Conformidad y Sello */}
              <footer className="irm-signatures">
                <div className="irm-signature-box">
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">{technicianName}</span>
                  <span className="irm-signature-role">Sanitary Field Inspector</span>
                  <small style={{ color: '#718096' }}>National ID: {technicianCedula}</small>
                  <div className="irm-stamp">DIGEMAPS • OFFICIAL INSPECTION</div>
                </div>

                <div className="irm-signature-box">
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">Legal / Quality Representative</span>
                  <span className="irm-signature-role">On behalf of the Inspected Establishment</span>
                  <small style={{ color: '#718096' }}>Signature & Receipt Seal</small>
                </div>
              </footer>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
