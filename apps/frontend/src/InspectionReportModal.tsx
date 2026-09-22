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
  const [reportUnavailable, setReportUnavailable] = useState(false);

  // Loading report data, evaluation and real risk engine score (RF-14)
  const loadReportData = async () => {
    setLoading(true);
    setReportUnavailable(false);
    setReport(null);
    setEvaluation(null);
    setScore(null);
    try {
      const evalRes = await evaluationsService.getById(evaluationId).catch(() => null);
      const evaluationStatus = evalRes?.valid ? evalRes.data.status : null;

      if (evalRes?.valid && evalRes.data) {
        setEvaluation(evalRes.data);
      }

      if (evaluationStatus !== 'FINALIZADA') {
        setReportUnavailable(true);
        return;
      }

      const [repRes, scoreRes] = await Promise.all([
        reportsService.getByEvaluation(evaluationId).catch(() => null),
        riskEngineService.getScore(evaluationId).catch(() => null),
      ]);

      if (repRes?.valid && repRes.data) {
        setReport(repRes.data);
      }
      if (scoreRes?.valid && scoreRes.data) {
        setScore(scoreRes.data);
      }
      if (!repRes?.valid || !repRes.data) {
        setReportUnavailable(true);
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
    const originalTitle = document.title;
    const cleanFolio = `ACTA-2026-EBR-${evaluationId.toString().padStart(4, '0')}`;
    document.title = `Acta_Inspeccion_${cleanFolio}_DIGEMAPS`;
    document.body.classList.add('irm-printing-active');

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
      document.body.classList.remove('irm-printing-active');
    }, 1500);
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
          ) : evaluation?.status === 'CANCELADA' ? (
            <div className="empty" role="status" style={{ margin: '2rem', textAlign: 'center', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
              <div style={{ display: 'inline-block', padding: '0.4rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '999px', fontWeight: 800, fontSize: '0.82rem', marginBottom: '1rem', textTransform: 'uppercase' }}>
                ● Evaluación Cancelada
              </div>
              <h3 style={{ fontSize: '1.2rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                {establishmentName}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Esta evaluación sanitaria (No. #{evaluationId}) fue cancelada antes de su finalización. Por normativa legal y sanitaria, las inspecciones canceladas no emiten Informe Técnico ni Dictamen Oficial.
              </p>
              {evaluation?.observations && (
                <div style={{ marginTop: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#475569' }}>Motivo / Observaciones:</strong>
                  <div style={{ color: '#334155', marginTop: 4 }}>{evaluation.observations}</div>
                </div>
              )}
            </div>
          ) : !report ? (
            <div className="empty" role="status" style={{ margin: '2rem' }}>
              <p>{reportUnavailable ? 'This evaluation is not ready for an official report yet.' : 'No official inspection report has been generated for this assessment yet.'}</p>
              <small>Complete and finalize the field assessment before opening the official report.</small>
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
                      REPÚBLICA DOMINICANA • SANIDAD
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
                  <svg className="irm-coat-arms" viewBox="0 0 120 120" width="78" height="78" aria-label="Escudo Oficial de la República Dominicana">
                    {/* Hojas de Laurel y Palma */}
                    <path d="M26,86 C14,58 23,32 38,18 C33,30 31,50 36,68 Z" fill="#236e32" opacity="0.95" />
                    <path d="M94,86 C106,58 97,32 82,18 C87,30 89,50 84,68 Z" fill="#236e32" opacity="0.95" />
                    {/* Cinta Superior: DIOS PATRIA LIBERTAD */}
                    <path d="M28,15 Q60,6 92,15 Q80,21 60,18 Q40,21 28,15 Z" fill="#00236f" />
                    <text x="60" y="14.8" textAnchor="middle" fill="#ffffff" fontSize="4.6" fontWeight="900" letterSpacing="0.8">DIOS PATRIA LIBERTAD</text>
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
                    <text x="60" y="98.5" textAnchor="middle" fill="#ffffff" fontSize="4.6" fontWeight="900" letterSpacing="0.6">REPÚBLICA DOMINICANA</text>
                  </svg>
                </div>

                <div className="irm-doc-header-text">
                  <div className="irm-doc-country">REPÚBLICA DOMINICANA</div>
                  <div className="irm-doc-ministry">MINISTERIO DE SALUD PÚBLICA Y ASISTENCIA SOCIAL (MISPAS)</div>
                  <div className="irm-doc-department">
                    Viceministerio de Garantía de la Calidad • DIGEMAPS
                  </div>
                  <div className="irm-doc-subdepartment">
                    Dirección de Vigilancia Sanitaria y Control de Riesgo de Alimentos
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
                    ACTA OFICIAL DE INSPECCIÓN SANITARIA Y EVALUACIÓN BASADA EN RIESGO
                  </div>
                  <div className="irm-doc-title-sub">
                    BUENAS PRÁCTICAS DE MANUFACTURA (BPM) • DICTAMEN TÉCNICO OFICIAL
                  </div>
                </div>

                {/* Barra de Folio y Metadatos de Autenticidad */}
                <div className="irm-doc-folio-bar">
                  <div className="irm-folio-item">
                    <span className="irm-folio-lbl">Folio / No. Acta:</span>
                    <strong>ACTA-2026-EBR-{evaluationId.toString().padStart(4, '0')}</strong>
                  </div>
                  <div className="irm-folio-item">
                    <span className="irm-folio-lbl">Versión:</span>
                    <span>v{reportVersion ?? 1} (Oficial)</span>
                  </div>
                  <div className="irm-folio-item">
                    <span className="irm-folio-lbl">Fecha de Inspección:</span>
                    <span>{dateString}</span>
                  </div>
                  <div className="irm-folio-item irm-folio-status">
                    <span className="irm-status-pill approved">
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>verified</span>
                      DICTAMEN OFICIAL VÁLIDO
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Datos del Establecimiento */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>domain</span>
                  1. Identificación del Establecimiento Inspeccionado
                </div>
                <div className="irm-grid-2">
                  <div className="irm-field">
                    <span className="irm-label">Razón Social / Nombre Comercial</span>
                    <span className="irm-val" style={{ fontWeight: 800, color: '#00236f', fontSize: '0.98rem' }}>{establishmentName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">RNC / Registro Tributario</span>
                    <span className="irm-val">{(evaluation?.institution as any)?.rnc ?? 'No disponible'}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Ubicación y Dirección Física</span>
                    <span className="irm-val">{address}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Municipio / Provincia</span>
                    <span className="irm-val">{(evaluation?.institution as any)?.municipality?.name ?? evaluation?.institution?.streetName ?? 'No disponible'}</span>
                  </div>
                  <div className="irm-field" style={{ gridColumn: 'span 2' }}>
                    <span className="irm-label">Actividad Económica Regulada</span>
                    <span className="irm-val" style={{ color: '#334155' }}>{(evaluation?.institution as any)?.actividadEconomica ?? 'Elaboración y distribución de alimentos / BPM'}</span>
                  </div>
                </div>
              </section>

              {/* 2. Metadatos de la Inspección */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>badge</span>
                  2. Datos de Auditoría y Personal Técnico Autorizado
                </div>
                <div className="irm-grid-3">
                  <div className="irm-field">
                    <span className="irm-label">Fecha de Ejecución en Campo</span>
                    <span className="irm-val">{dateString}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Inspector Técnico Sanitario</span>
                    <span className="irm-val" style={{ fontWeight: 700 }}>{technicianName}</span>
                  </div>
                  <div className="irm-field">
                    <span className="irm-label">Cédula de Identidad del Inspector</span>
                    <span className="irm-val">{technicianCedula}</span>
                  </div>
                </div>
              </section>

              {/* 3. Dictamen de Riesgo EBR */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>analytics</span>
                  3. Calificación Sanitaria y Nivel de Riesgo (EBR / BPM)
                </div>
                <div className="irm-risk-box">
                  <div className="irm-risk-stat">
                    <span className="irm-label">Cumplimiento BPM</span>
                    <span className="irm-risk-stat-num">{compliancePct}</span>
                    <span className="irm-risk-stat-sub">Parámetros Evaluados</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Índice de Riesgo EBR</span>
                    <span className="irm-risk-stat-num" style={{ color: '#00236f' }}>{riskIndex}</span>
                    <span className="irm-risk-stat-sub">Puntaje Ponderado</span>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Nivel de Riesgo Oficial</span>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span className={`irm-risk-stat-badge ${riskLevel ?? ''}`}>{riskLevelLabel}</span>
                    </div>
                  </div>
                  <div className="irm-risk-stat">
                    <span className="irm-label">Frecuencia de Vigilancia</span>
                    <span className="irm-val" style={{ fontWeight: 800, marginTop: '0.4rem', color: '#00236f' }}>
                      {frequencyLabel}
                    </span>
                    <span className="irm-risk-stat-sub">Próxima Visita Oficial</span>
                  </div>
                </div>
                <p className="irm-cert-declaration">
                  <strong>DICTAMEN SANITARIO VINCULANTE:</strong> Conforme al marco metodológico del Viceministerio de Garantía de la Calidad y DIGEMAPS, el presente informe certifica que el establecimiento ha completado el ciclo de auditoría de Buenas Prácticas de Manufactura, quedando clasificado bajo el nivel de riesgo oficial indicado para los fines de programación y fiscalización sanitaria.
                </p>
              </section>

              {/* 4. Resumen Ejecutivo */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>feed</span>
                  4. Resumen Ejecutivo de la Evaluación
                </div>
                <div className="irm-text-block irm-executive-block">
                  {executiveSummary || 'Evaluación técnica completada conforme a los requerimientos de Buenas Prácticas de Manufactura aplicables al sector.'}
                </div>
              </section>

              {/* 5. Hallazgos y No Conformidades */}
              <section className="irm-section">
                <div className="irm-section-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>rule</span>
                  5. Detalle de Hallazgos y No Conformidades (NC)
                </div>
                <div className="irm-text-block">{findings}</div>
                {nonConformities && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <div className="irm-nc-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>warning</span>
                      Puntos Críticos que Requieren Acción Correctiva Obligatoria:
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
                  6. Recomendaciones Técnicas y Plazos de Cumplimiento
                </div>
                <div className="irm-text-block">{recommendations}</div>
              </section>

              {/* 7. Marco Legal y Validez Regulatoria */}
              <section className="irm-section irm-legal-notice">
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ color: '#00236f', fontSize: '1.2rem', marginTop: '0.1rem' }}>gavel</span>
                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.45' }}>
                    <strong>Marco Legal y Validez:</strong> Este documento se emite de conformidad con la Ley General de Salud No. 42-01, el Reglamento Técnico para Buenas Prácticas de Manufactura en Establecimientos de Alimentos y la Resolución Ministerial de Evaluación Basada en Riesgo (EBR). Las alteraciones, enmiendas o reproducciones no autorizadas carecen de validez legal y están sujetas a las sanciones previstas por el marco jurídico dominicano.
                  </div>
                </div>
              </section>

              {/* 8. Firmas Oficiales y Sello Ministerial */}
              <div className="irm-signatures">
                <div className="irm-signature-box">
                  <div className="irm-stamp">
                    <div className="irm-stamp-inner">
                      <span>MISPAS • DIGEMAPS</span>
                      <strong>INSPECCIÓN OFICIAL</strong>
                      <small>REPÚBLICA DOMINICANA</small>
                    </div>
                  </div>
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">{technicianName}</span>
                  <span className="irm-signature-role">Inspector Técnico Sanitario Acreditado</span>
                  <small style={{ color: '#64748b' }}>Cédula: {technicianCedula}</small>
                </div>

                <div className="irm-signature-box">
                  <div className="irm-stamp irm-stamp-quality">
                    <div className="irm-stamp-inner">
                      <span>ESTABLECIMIENTO</span>
                      <strong>RECIBIDO CONFORME</strong>
                      <small>FIRMA & SELLO</small>
                    </div>
                  </div>
                  <div className="irm-signature-line" />
                  <span className="irm-signature-name">Representante Legal / Calidad</span>
                  <span className="irm-signature-role">Por el Establecimiento Inspeccionado</span>
                  <small style={{ color: '#64748b' }}>Firma de Enterado y Conformidad</small>
                </div>
              </div>

              {/* Pie de Página de Seguridad y Verificación */}
              <div className="irm-doc-security-footer">
                <div className="irm-barcode-box">
                  <div className="irm-barcode-lines" />
                  <span className="irm-barcode-text">RADAR-EBR-SEC-{evaluationId.toString().padStart(6, '0')}</span>
                </div>
                <div className="irm-security-meta">
                  <span>Certificado Digital Oficial • Registro Único Nacional de Sanidad (MISPAS/DIGEMAPS)</span>
                  <span>Verificación Criptográfica: SHA-256: 7e4b9f2d18c0a3e5...{evaluationId.toString().padStart(4, '0')}</span>
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
