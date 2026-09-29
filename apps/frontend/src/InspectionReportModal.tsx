import { useState, useEffect, Fragment } from 'react';
import { reportsService, evaluationsService } from './services';
import type { EvaluationListItem, FormAnswers, OfficialVerdictPreview } from '@reto/shared';
import './InspectionReportModal.css';

interface InspectionReportModalProps {
  evaluationId: number;
  role?: string;
  answers?: FormAnswers;
  onClose: () => void;
  notify?: (msg: string) => void;
}

const VALUE_LABEL: Record<string, string> = {
  C: 'Compliant',
  CP: 'Partial',
  NC: 'Non-compliant',
  'N/A': 'Not applicable',
};

export default function InspectionReportModal({
  evaluationId,
  role,
  answers,
  onClose,
  notify,
}: InspectionReportModalProps) {
  const [verdict, setVerdict] = useState<OfficialVerdictPreview | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reportUnavailable, setReportUnavailable] = useState(false);

  // The verdict is rebuilt from the evaluation as it stands, including the
  // answers currently on the inspector's screen when those were passed in.
  const loadReportData = async () => {
    setLoading(true);
    setReportUnavailable(false);
    setVerdict(null);
    setEvaluation(null);
    try {
      const evalRes = await evaluationsService.getById(evaluationId).catch(() => null);
      if (evalRes?.valid && evalRes.data) {
        setEvaluation(evalRes.data);
      }
      if (evalRes?.valid && evalRes.data.status === 'CANCELADA') {
        return;
      }

      const previewRes = await reportsService.preview(evaluationId, answers);
      if (previewRes.valid && previewRes.data) {
        setVerdict(previewRes.data);
      } else {
        setReportUnavailable(true);
      }
    } catch (err: unknown) {
      console.error('Error loading inspection report:', err);
      setReportUnavailable(true);
      notify?.('Could not load the official evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
  }, [evaluationId, answers]);

  // Print or Save Official PDF
  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanFolio = `ACTA-2026-EBR-${evaluationId.toString().padStart(4, '0')}`;
    document.title = `Inspection_Report_${cleanFolio}_DIGEMAPS`;
    document.body.classList.add('irm-printing-active');

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
      document.body.classList.remove('irm-printing-active');
    }, 1500);
  };

  // Submit report for review (Evaluator Technician)
  const handleSubmitReport = async () => {
    if (!verdict?.reportId) return;
    setBusy(true);
    try {
      const result = await reportsService.submit(verdict.reportId);
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

  // Approve report (Coordinator / Admin)
  const handleApproveReport = async () => {
    if (!verdict?.reportId) return;
    setBusy(true);
    try {
      const result = await reportsService.review(verdict.reportId, {
        action: 'APROBAR',
        comments: 'Technical report approved in accordance with current GMP regulations.',
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

  const establishmentName = verdict?.establishment.name || evaluation?.institution?.name || 'Not available';
  const address = verdict?.establishment.address || evaluation?.institution?.streetName || 'Not available';
  const technicianName = verdict?.inspector.name || evaluation?.technician?.person?.name || 'Not available';
  const technicianCedula = verdict?.inspector.cedula || evaluation?.technician?.person?.cedula || 'Not available';
  const scheduledSource = verdict?.scheduledDate || evaluation?.scheduledDate;
  const dateString = scheduledSource
    ? new Date(scheduledSource).toLocaleDateString('en-US', {
        dateStyle: 'long',
      })
    : 'Not available';

  const executiveSummary = verdict?.narrative.resumenEjecutivo ?? '';

  const findings = verdict?.narrative.hallazgos ?? '';

  const nonConformities = verdict?.narrative.noConformidades ?? '';

  const recommendations = verdict?.narrative.recomendaciones ?? '';

  const reportStatus = verdict?.reportStatus ?? undefined;
  const reportVersion = verdict?.reportVersion ?? undefined;
  const score = verdict?.score ?? null;

  const hasScore = score !== null;
  const compliancePct = hasScore ? `${score.porcentajeCumplimiento.toFixed(1)}%` : 'Pending';
  const riskIndex = hasScore ? `${score.puntajeObtenido.toFixed(1)} / 10.0` : 'Pending';
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
            <button className="irm-btn irm-btn-print" onClick={handlePrint} title="Print or save as PDF" disabled={loading || !verdict}>
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

            <button className="irm-btn irm-btn-close" onClick={onClose} title="Close">
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
          ) : evaluation?.status === 'CANCELADA' ? (
            <div className="empty" role="status" style={{ margin: '2rem', textAlign: 'center', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
              <div style={{ display: 'inline-block', padding: '0.4rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '999px', fontWeight: 800, fontSize: '0.82rem', marginBottom: '1rem', textTransform: 'uppercase' }}>
                ● Evaluation Cancelled
              </div>
              <h3 style={{ fontSize: '1.2rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                {establishmentName}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
                This sanitary evaluation (No. #{evaluationId}) was cancelled before its completion. According to legal and sanitary regulations, cancelled inspections do not issue a Technical Report or Official Statement.
              </p>
              {evaluation?.observations && (
                <div style={{ marginTop: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#475569' }}>Reason / Observations:</strong>
                  <div style={{ color: '#334155', marginTop: 4 }}>{evaluation.observations}</div>
                </div>
              )}
            </div>
          ) : !verdict ? (
            <div className="empty" role="status" style={{ margin: '2rem' }}>
              <p>{reportUnavailable ? 'The official verdict could not be prepared from this evaluation.' : 'No official inspection report has been generated for this assessment yet.'}</p>
              <small>Open it again after the assessment answers are available.</small>
            </div>
          ) : (
            <article className="irm-paper">
              {/* Sello de Agua Oficial en Fondo */}
              <div className="irm-watermark" aria-hidden="true">
                <svg viewBox="0 0 200 200" width="380" height="380">
                  <circle cx="100" cy="100" r="92" fill="none" stroke="#00236f" strokeWidth="3" strokeDasharray="6,4" />
                  <circle cx="100" cy="100" r="82" fill="none" stroke="#00236f" strokeWidth="1.5" />
                  <path id="curveTop" d="M 28,100 A 72,72 0 0,1 172,100" fill="none" />
                  <text fontSize="10.5" fontWeight="900" fill="#00236f" letterSpacing="2.5">
                    <textPath href="#curveTop" startOffset="50%" textAnchor="middle">
                      • DIGEMAPS • MISPAS •
                    </textPath>
                  </text>
                  <path id="curveBottom" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
                  <text fontSize="8" fontWeight="800" fill="#00236f" letterSpacing="1.8">
                    <textPath href="#curveBottom" startOffset="50%" textAnchor="middle">
                      DOMINICAN REPUBLIC • HEALTH
                    </textPath>
                  </text>
                  <g transform="translate(68, 68) scale(0.53)">
                    <rect x="0" y="0" width="60" height="60" fill="#00236f" />
                    <rect x="60" y="0" width="60" height="60" fill="#ce1126" />
                    <rect x="0" y="60" width="60" height="60" fill="#ce1126" />
                    <rect x="60" y="60" width="60" height="60" fill="#00236f" />
                    <rect x="48" y="0" width="24" height="120" fill="#ffffff" />
                    <rect x="0" y="48" width="120" height="24" fill="#ffffff" />
                  </g>
                </svg>
              </div>

              {/* Membrete Oficial del Estado */}
              <div className="irm-doc-header">
                {/* Escudo Nacional Dominicano Vectorial */}
                <div className="irm-coat-arms-wrapper">
                  <svg className="irm-coat-arms" viewBox="0 0 120 120" width="78" height="78" aria-label="Official Coat of Arms of the Dominican Republic">
                    {/* Hojas de Laurel y Palma */}
                    <path d="M26,86 C14,58 23,32 38,18 C33,30 31,50 36,68 Z" fill="#236e32" opacity="0.95" />
                    <path d="M94,86 C106,58 97,32 82,18 C87,30 89,50 84,68 Z" fill="#236e32" opacity="0.95" />
                    {/* Cinta Superior: DIOS PATRIA LIBERTAD */}
                    <path d="M28,15 Q60,6 92,15 Q80,21 60,18 Q40,21 28,15 Z" fill="#00236f" />
                    <text x="60" y="14.8" textAnchor="middle" fill="#ffffff" fontSize="4.6" fontWeight="900" letterSpacing="0.8">GOD HOMELAND LIBERTY</text>
                    {/* Escudo Cuartelado */}
                    <g transform="translate(36, 26) scale(0.4)">
                      <rect x="0" y="0" width="60" height="50" fill="#00236f" rx="3" />
                      <rect x="60" y="0" width="60" height="50" fill="#ce1126" rx="3" />
                      <rect x="0" y="50" width="60" height="65" fill="#ce1126" />
                      <rect x="60" y="50" width="60" height="65" fill="#00236f" />
                      {/* Cruz Blanca */}
                      <rect x="48" y="0" width="24" height="115" fill="#ffffff" />
                      <rect x="0" y="38" width="120" height="24" fill="#ffffff" />
                      {/* Biblia Dorada Central */}
                      <rect x="46" y="36" width="28" height="28" fill="#d4af37" rx="3" />
                      <path d="M49,42 Q59,38 60,42 Q61,38 71,42 L70,57 Q60,53 60,57 Q59,53 50,57 Z" fill="#ffffff" stroke="#8b4513" strokeWidth="1" />
                      <line x1="60" y1="41" x2="60" y2="57" stroke="#8b4513" strokeWidth="1.2" />
                      <path d="M58,45 L62,45 M60,43 L60,48" stroke="#ce1126" strokeWidth="1.2" />
                    </g>
                    {/* Cinta Inferior: REPÚBLICA DOMINICANA */}
                    <path d="M18,97 Q60,108 102,97 Q84,89 60,93 Q36,89 18,97 Z" fill="#ce1126" />
                    <text x="60" y="98.5" textAnchor="middle" fill="#ffffff" fontSize="4.6" fontWeight="900" letterSpacing="0.6">DOMINICAN REPUBLIC</text>
                  </svg>
                </div>

                <div className="irm-doc-header-text">
                  <div className="irm-doc-country">DOMINICAN REPUBLIC</div>
                  <div className="irm-doc-ministry">MINISTRY OF PUBLIC HEALTH AND SOCIAL ASSISTANCE (MISPAS)</div>
                  <div className="irm-doc-department">
                    Vice Ministry of Quality Assurance • DIGEMAPS
                  </div>
                  <div className="irm-doc-subdepartment">
                    Directorate of Health Surveillance and Food Risk Control
                  </div>
                </div>

                {/* Cinta Tricolor Nacional */}
                <div className="irm-doc-tricolor-line">
                  <span className="irm-tc-blue" />
                  <span className="irm-tc-white"><span className="irm-tc-star">★</span></span>
                  <span className="irm-tc-red" />
                </div>

                {/* Título Oficial del Certificado */}
                <div className="irm-doc-title-container">
                  <div className="irm-doc-title-main">
                    OFFICIAL HEALTH INSPECTION AND RISK-BASED EVALUATION RECORD
                  </div>
                  <div className="irm-doc-title-sub">
                    GOOD MANUFACTURING PRACTICES (GMP) • OFFICIAL TECHNICAL REPORT
                  </div>
                </div>

                {/* Barra de Folio y Metadatos de Autenticidad */}
                <div className="irm-doc-folio-bar">
                  <div className="irm-folio-item">
                    <span className="irm-folio-lbl">Folio / Record No.:</span>
                    <strong>ACTA-2026-EBR-{evaluationId.toString().padStart(4, '0')}</strong>
                  </div>
                  <div className="irm-folio-item">
                    <span className="irm-folio-lbl">Version:</span>
                    <span>{reportVersion ? `v${reportVersion}` : 'Working draft'}</span>
                  </div>
                  <div className="irm-folio-item">
                    <span className="irm-folio-lbl">Inspection Date:</span>
                    <span>{dateString}</span>
                  </div>
                  <div className="irm-folio-item irm-folio-status">
                    <span className={`irm-status-pill ${verdict.delivery === 'approved' ? 'approved' : verdict.delivery === 'with_coordinator' ? 'review' : verdict.delivery === 'ready_to_send' ? 'ready' : 'draft'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                        {verdict.delivery === 'approved' ? 'verified' : verdict.delivery === 'working' ? 'edit_note' : 'schedule_send'}
                      </span>
                      {verdict.delivery === 'approved'
                        ? 'APPROVED OFFICIAL REPORT'
                        : verdict.delivery === 'with_coordinator'
                          ? 'SUBMITTED TO COORDINATOR'
                          : verdict.delivery === 'ready_to_send'
                            ? 'READY TO SEND'
                            : 'WORKING DRAFT'}
                    </span>
                  </div>
                </div>
                <div className={`irm-state-banner ${verdict.delivery}`}>
                  <strong>
                    {verdict.answeredQuestions} of {verdict.requiredQuestions} required criteria answered
                    {hasScore ? ` · ${compliancePct} compliance` : ''}
                  </strong>
                  {verdict.delivery === 'working' && (
                    <span>This draft follows the assessment as it stands now. Finish the required chapters before it can be sent to the coordinator.</span>
                  )}
                  {verdict.delivery === 'ready_to_send' && reportStatus == null && (
                    <span>This is the verdict that will be issued when you finish the assessment and send it to the coordinator.</span>
                  )}
                  {verdict.delivery === 'ready_to_send' && reportStatus === 'BORRADOR' && (
                    <span>This is the exact verdict that will be sent when you submit it to the coordinator.</span>
                  )}
                  {verdict.delivery === 'ready_to_send' && (reportStatus === 'EN_CORRECCION' || reportStatus === 'DEVUELTO') && (
                    <span>This is the exact verdict that will be sent when you resubmit this evaluation to the coordinator.</span>
                  )}
                  {verdict.delivery === 'with_coordinator' && (
                    <span>The coordinator already has this verdict. The field record stays as it was submitted.</span>
                  )}
                  {verdict.delivery === 'approved' && (
                    <span>This approved verdict is the official record of the evaluation.</span>
                  )}
                  {verdict.pendingLocalChanges && (
                    <span> It includes answers that are still only on this screen. Resubmit from Field Assessment to send them.</span>
                  )}
                  {verdict.correctionReady === false && (
                    <span> Save the requested correction before this evaluation can be resubmitted.</span>
                  )}
                  {verdict.editedSections.length > 0 && (
                    <span> Edited by hand and sent as written: {verdict.editedSections.join(', ')}.</span>
                  )}
                </div>
              </div>

              {/* 1. Datos del Establecimiento */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>domain</span>
                  1. Identification of the Inspected Establishment
                </div>
                <div className="irm-grid-2">
                  <div className="irm-field">
                    <span className="irm-label">Legal Name / Trade Name</span>
                    <span className="irm-val" style={{ fontWeight: 800, color: '#00236f', fontSize: '0.98rem' }}>{establishmentName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">RNC / Tax Registry</span>
                    <span className="irm-val">{verdict?.establishment.rnc || evaluation?.institution?.rnc || 'Not available'}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Location and Physical Address</span>
                    <span className="irm-val">{address}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Municipality / Province</span>
                    <span className="irm-val">{verdict?.establishment.address || (evaluation?.institution as any)?.municipality?.name || evaluation?.institution?.streetName || 'Not available'}</span>
                  </div>
                  <div className="irm-field" style={{ gridColumn: 'span 2' }}>
                    <span className="irm-label">Regulated Economic Activity</span>
                    <span className="irm-val" style={{ color: '#334155' }}>{(evaluation?.institution as any)?.actividadEconomica ?? 'Food preparation and distribution / GMP'}</span>
                  </div>
                </div>
              </section>

              {/* 2. Metadatos de la Inspección */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>badge</span>
                  2. Audit Data and Authorized Technical Personnel
                </div>
                <div className="irm-grid-3">
                  <div className="irm-field">
                    <span className="irm-label">Field Execution Date</span>
                    <span className="irm-val">{dateString}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Sanitary Technical Inspector</span>
                    <span className="irm-val" style={{ fontWeight: 700 }}>{technicianName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Inspector's Identity Card</span>
                    <span className="irm-val">{technicianCedula}</span>
                  </div>
                </div>
              </section>

              {/* 3. Dictamen de Riesgo EBR */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>analytics</span>
                  3. Sanitary Rating and Risk Level (RBE / GMP)
                </div>
                <div className="irm-risk-box">
                  <div className="irm-risk-stat">
                    <span className="irm-label">GMP Compliance</span>
                    <span className="irm-risk-stat-num">{compliancePct}</span>
                    <span className="irm-risk-stat-sub">Evaluated Parameters</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">RBE Risk Index</span>
                    <span className="irm-risk-stat-num" style={{ color: '#00236f' }}>{riskIndex}</span>
                    <span className="irm-risk-stat-sub">Weighted Score</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Official Risk Level</span>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span className={`irm-risk-stat-badge ${riskLevel ?? ''}`}>{riskLevelLabel}</span>
                    </div>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Surveillance Frequency</span>
                    <span className="irm-val" style={{ fontWeight: 800, marginTop: '0.4rem', color: '#00236f' }}>
                      {frequencyLabel}
                    </span>
                    <span className="irm-risk-stat-sub">Next Official Visit</span>
                  </div>
                </div>
                <p className="irm-cert-declaration">
                  <strong>BINDING SANITARY REPORT:</strong> In accordance with the methodological framework of the Vice Ministry of Quality Assurance and DIGEMAPS, this report certifies that the establishment has completed the audit cycle for Good Manufacturing Practices, being classified under the indicated official risk level for scheduling and sanitary inspection purposes.
                </p>
              </section>

              {/* 4. Resumen Ejecutivo */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>feed</span>
                  4. Executive Summary of the Evaluation
                </div>
                <div className="irm-text-block irm-executive-block">
                  {executiveSummary || 'Technical evaluation completed in accordance with Good Manufacturing Practices requirements applicable to the sector.'}
                </div>
              </section>

              {/* 5. Hallazgos y No Conformidades */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>rule</span>
                  5. Details of Findings and Non-Conformities (NC)
                </div>
                <div className="irm-text-block">{findings}</div>
                {nonConformities && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <div className="irm-nc-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>warning</span>
                      Critical Points Requiring Mandatory Corrective Action:
                    </div>
                    <div className="irm-text-block irm-nc-block">
                      {nonConformities}
                    </div>
                  </div>
                )}
              </section>

              {/* 6. Medidas y Recomendaciones */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>recommend</span>
                  6. Technical Recommendations and Compliance Deadlines
                </div>
                <div className="irm-text-block">{recommendations}</div>
              </section>

              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>fact_check</span>
                  7. Criteria Record Used for This Verdict
                </div>
                <table className="irm-criteria">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Criterion</th>
                      <th>Result</th>
                      <th>Assessor note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verdict.entries.map((entry, index) => {
                      const previous = verdict.entries[index - 1];
                      const showChapter = !previous || previous.chapter !== entry.chapter;
                      const mark = entry.value ?? 'pending';
                      return (
                        <Fragment key={entry.key}>
                          {showChapter && (
                            <tr className="chapter">
                              <td colSpan={4}>{entry.chapter}</td>
                            </tr>
                          )}
                          <tr>
                            <td>{entry.code}</td>
                            <td>{entry.text}</td>
                            <td><span className={`irm-mark ${mark === 'N/A' ? 'na' : mark}`}>{entry.value ? VALUE_LABEL[entry.value] : 'Not answered'}</span></td>
                            <td>{entry.note || '—'}</td>
                          </tr>
                        </Fragment>
                      );
                    })}
                    {verdict.entries.length === 0 && (
                      <tr>
                        <td colSpan={4}>No criteria have been answered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {verdict.evidences.length > 0 && (
                <section className="irm-section">
                  <div className="irm-section-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>photo_camera</span>
                    8. Evidence Attached to This Evaluation
                  </div>
                  <ul className="irm-evidence-list">
                    {verdict.evidences.map((evidence) => (
                      <li key={evidence.evidenceId}>
                        <strong>{evidence.type}</strong>
                        {evidence.fileName ? ` · ${evidence.fileName}` : ''}
                        {evidence.comment ? ` — ${evidence.comment}` : ''}
                        {evidence.latitude != null && evidence.longitude != null
                          ? ` · GPS ${evidence.latitude.toFixed(3)}°, ${evidence.longitude.toFixed(3)}°`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 7. Marco Legal y Validez Regulatoria */}
              <section className="irm-section irm-legal-notice">
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ color: '#00236f', fontSize: '1.2rem', marginTop: '0.1rem' }}>gavel</span>
                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.45' }}>
                    <strong>Legal Framework and Validity:</strong> This document is issued in accordance with General Health Law No. 42-01, the Technical Regulation for Good Manufacturing Practices in Food Establishments and the Ministerial Resolution of Risk-Based Evaluation (RBE). Unauthorized alterations, amendments, or reproductions lack legal validity and are subject to the penalties provided by the Dominican legal framework.
                  </div>
                </div>
              </section>

              {/* 8. Firmas Oficiales y Sello Ministerial */}
              <div className="irm-signatures">
                <div className="irm-signature-box">
                  <div className="irm-stamp">
                    <div className="irm-stamp-inner">
                      <span>MISPAS • DIGEMAPS</span>
                      <strong>OFFICIAL INSPECTION</strong>
                      <small>DOMINICAN REPUBLIC</small>
                    </div>
                  </div>
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">{technicianName}</span>
                  <span className="irm-signature-role">Accredited Sanitary Technical Inspector</span>
                  <small style={{ color: '#64748b' }}>ID Card: {technicianCedula}</small>
                </div>

                <div className="irm-signature-box">
                  <div className="irm-stamp irm-stamp-quality">
                    <div className="irm-stamp-inner">
                      <span>ESTABLISHMENT</span>
                      <strong>RECEIVED IN CONFORMITY</strong>
                      <small>SIGNATURE & STAMP</small>
                    </div>
                  </div>
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">Legal / Quality Representative</span>
                  <span className="irm-signature-role">On Behalf of the Inspected Establishment</span>
                  <small style={{ color: '#64748b' }}>Signature of Acknowledgment and Conformity</small>
                </div>
              </div>

              {/* Pie de Página de Seguridad y Verificación */}
              <div className="irm-doc-security-footer">
                {verdict.authenticity ? (
                  <div className="irm-qr-seal">
                    <a href={verdict.authenticity.verificationUrl} target="_blank" rel="noreferrer">
                      <img src={verdict.authenticity.qrDataUrl} alt="QR code to verify this official report" />
                    </a>
                    <div className="irm-security-meta">
                      <strong>Verify this official report</strong>
                      <span>Scan the QR code to confirm RADAR Sanitario issued this document.</span>
                      <span>{verdict.authenticity.reference}</span>
                    </div>
                  </div>
                ) : (
                  <div className="irm-qr-pending">
                    <strong>Verification QR</strong>
                    <span>The QR code is added when this report is approved as an official record.</span>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
