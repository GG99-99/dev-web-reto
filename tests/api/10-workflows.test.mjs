/**
 * 10-workflows.test.mjs
 * ---------------------------------------------------------------------------
 * End-to-end API workflows using isolated records (not mutating seeded cases
 * into terminal states when avoidable). Covers:
 *  - company BPM request → submit → case
 *  - coordinator assign / reassign → schedule evaluation
 *  - technician start → answers → evidence → finish → risk score + report
 *  - report submit → coordinator review (return, correct, resend, approve)
 *  - case close + official report download
 *  - LAPCH alert → PROCEDE → generate case
 *  - public complaint → PROCEDE → generate case
 *  - cross-user isolation
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, upload, loginAll, tokens, sessionUsers, pngBytes, uid,
  assertOk, assertUnauthorized, assertForbidden, assertNotFound,
  assertValidationError, assertConflict,
} from './helpers.mjs';

async function companyInstitution() {
  const res = await request('GET', '/institutions?page=1&pageSize=50', { token: tokens.company });
  const data = assertOk(res, 200);
  assert.ok(data.items.length > 0, 'ADMIN_EMPRESA must own at least one institution');
  const seeded = data.items.find((i) => i.rnc === '130123456') ?? data.items[0];
  return seeded;
}

async function institutionDetail(id, token = tokens.company) {
  const res = await request('GET', `/institutions/${id}`, { token });
  return assertOk(res, 200);
}

async function firstFood() {
  const res = await request('GET', '/catalogs/foods', { token: tokens.admin });
  const foods = assertOk(res, 200);
  assert.ok(Array.isArray(foods) && foods.length > 0, 'catalogs/foods must be seeded');
  return foods[0];
}

describe('BPM inspection workflow', () => {
  before(async () => { await loginAll(); });

  test('company creates, updates, and submits a BPM request that opens a case', async () => {
    const inst = await companyInstitution();
    const created = await request('POST', '/bpm-requests', {
      token: tokens.company,
      body: {
        institutionId: inst.institutionId,
        tipoEstablecimiento: 'Dairy processing plant',
        motivo: `Annual BPM certification ${uid('wf')}`,
        observaciones: 'Morning shift available',
      },
    });
    const draft = assertOk(created, 201);
    assert.strictEqual(draft.status, 'BORRADOR');

    const updated = await request('PATCH', `/bpm-requests/${draft.bpmRequestId}`, {
      token: tokens.company,
      body: { observaciones: 'Updated availability window' },
    });
    assertOk(updated, 200);

    const asTech = await request('PATCH', `/bpm-requests/${draft.bpmRequestId}`, {
      token: tokens.technician,
      body: { motivo: 'hijack' },
    });
    assertForbidden(asTech);

    const submitted = await request('POST', `/bpm-requests/${draft.bpmRequestId}/submit`, {
      token: tokens.company,
    });
    const payload = assertOk(submitted, 200);
    assert.strictEqual(payload.bpmRequest.status, 'PENDIENTE_ASIGNACION');
    assert.ok(payload.case?.caseId);
    assert.strictEqual(payload.case.origin, 'SOLICITUD_EMPRESA');

    const twice = await request('POST', `/bpm-requests/${draft.bpmRequestId}/submit`, {
      token: tokens.company,
    });
    assertConflict(twice);
  });

  test('coordinator assigns, reassigns, schedules, and the technician completes field work through closure', async () => {
    const inst = await companyInstitution();
    const detail = await institutionDetail(inst.institutionId);
    let representId = detail.representantes?.[0]?.representId;
    if (!representId) {
      const added = await request('POST', `/institutions/${inst.institutionId}/representatives`, {
        token: tokens.company,
        body: {
          type: 'CONTACTO',
          person: {
            name: `Workflow Rep ${uid('r')}`,
            cedula: `088-${String(Date.now()).slice(-7)}-1`,
            phone: '809-555-0777',
            email: `${uid('rep')}@radar.test`,
          },
        },
      });
      representId = assertOk(added, 201).representId;
    }
    assert.ok(representId, 'Need a representative to start an evaluation');
    const food = await firstFood();
    const technicianId = sessionUsers.technician.userId;
    const otherTechId = sessionUsers.technician2.userId;

    const bpm = assertOk(await request('POST', '/bpm-requests', {
      token: tokens.company,
      body: {
        institutionId: inst.institutionId,
        tipoEstablecimiento: 'Industrial bakery',
        motivo: `Full workflow ${uid('full')}`,
      },
    }), 201);
    const submitted = assertOk(await request('POST', `/bpm-requests/${bpm.bpmRequestId}/submit`, {
      token: tokens.company,
    }), 200);
    const caseId = submitted.case.caseId;

    const listed = await request('GET', `/cases/${caseId}/assignments`, { token: tokens.coordinator });
    assertOk(listed, 200);

    const assigned = await request('POST', `/cases/${caseId}/assign`, {
      token: tokens.coordinator,
      body: { technicianId, notes: 'Primary evaluator' },
    });
    assertOk(assigned, 201);
    const already = await request('POST', `/cases/${caseId}/assign`, {
      token: tokens.coordinator,
      body: { technicianId },
    });
    assertConflict(already);

    const reassigned = await request('POST', `/cases/${caseId}/reassign`, {
      token: tokens.coordinator,
      body: { technicianId: otherTechId, notes: 'Coverage' },
    });
    assertOk(reassigned, 201);
    const back = await request('POST', `/cases/${caseId}/reassign`, {
      token: tokens.coordinator,
      body: { technicianId, notes: 'Return to original technician' },
    });
    assertOk(back, 201);

    const priority = await request('PATCH', `/cases/${caseId}/priority`, {
      token: tokens.coordinator,
      body: { priority: 'ALTA' },
    });
    assertOk(priority, 200);

    const asCompany = await request('POST', `/cases/${caseId}/assign`, {
      token: tokens.company,
      body: { technicianId },
    });
    assertForbidden(asCompany);

    const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const evaluation = assertOk(await request('POST', '/evaluations', {
      token: tokens.coordinator,
      body: {
        caseId,
        technicianId,
        scheduledDate,
        reason: 'BPM field evaluation',
        priority: 'ALTA',
      },
    }), 201);
    const evaluationId = evaluation.evaluationId;
    assert.strictEqual(evaluation.status, 'PROGRAMADA');

    const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const rescheduled = await request('PATCH', `/evaluations/${evaluationId}/reschedule`, {
      token: tokens.coordinator,
      body: { scheduledDate: later, observations: 'Plant requested Thursday' },
    });
    assertOk(rescheduled, 200);

    const calendar = await request(
      'GET',
      `/evaluations/calendar?from=2026-01-01&to=2027-12-31&view=month`,
      { token: tokens.technician },
    );
    assertOk(calendar, 200);

    const started = await request('POST', `/evaluations/${evaluationId}/start`, {
      token: tokens.technician,
      body: { representId, foodId: food.foodId },
    });
    assertOk(started, 200);

    const coordinatorStart = await request('POST', `/evaluations/${evaluationId}/start`, {
      token: tokens.coordinator,
      body: { representId, foodId: food.foodId },
    });
    assertForbidden(coordinatorStart);

    const answers = await request('PATCH', `/evaluations/${evaluationId}/answers`, {
      token: tokens.technician,
      body: {
        answers: [
          { key: 'h1_ask:test-1', txt: 'Establishment location is adequate', value: 'C' },
          { key: 'h1_ask:test-2', txt: 'Walls are washable', value: 'CP' },
          { key: 'h1_ask:test-3', txt: 'Pest control program documented', value: 'NC' },
        ],
      },
    });
    assertOk(answers, 200);

    const evidence = await upload('POST', `/evaluations/${evaluationId}/evidences`, {
      token: tokens.technician,
      fields: {
        type: 'FOTO',
        comment: 'Non-conformity photo',
        latitude: '19.45',
        longitude: '-70.69',
      },
      file: pngBytes(),
      filename: 'finding.png',
      mimeType: 'image/png',
    });
    const ev = assertOk(evidence, 201);
    const listedEv = await request('GET', `/evaluations/${evaluationId}/evidences`, { token: tokens.technician });
    assertOk(listedEv, 200);

    const finished = await request('POST', `/evaluations/${evaluationId}/finish`, { token: tokens.technician });
    const finishData = assertOk(finished, 200);
    assert.ok(finishData.score);
    assert.ok(['BAJO', 'MEDIO', 'ALTO'].includes(finishData.score.nivelRiesgo));
    assert.ok(finishData.report?.reportId);

    const score = await request('GET', `/evaluations/${evaluationId}/score`, { token: tokens.technician });
    assertOk(score, 200);

    const report = await request('GET', `/evaluations/${evaluationId}/report`, { token: tokens.technician });
    const reportData = assertOk(report, 200);
    const reportId = reportData.reportId;

    const submittedReport = await request('POST', `/reports/${reportId}/submit`, { token: tokens.technician });
    assertOk(submittedReport, 200);

    const returned = await request('POST', `/reports/${reportId}/review`, {
      token: tokens.coordinator,
      body: { action: 'SOLICITAR_CORRECCION', comments: 'Clarify non-conformity 3' },
    });
    assertOk(returned, 200);

    const corrected = await request('POST', `/reports/${reportId}/correct`, {
      token: tokens.technician,
      body: { recomendaciones: 'Correct pest control records before next visit.' },
    });
    assertOk(corrected, 200);

    const resent = await request('POST', `/reports/${reportId}/resend`, { token: tokens.technician });
    assertOk(resent, 200);

    const approved = await request('POST', `/reports/${reportId}/review`, {
      token: tokens.coordinator,
      body: { action: 'APROBAR', comments: 'Accepted' },
    });
    assertOk(approved, 200);

    const reviews = await request('GET', `/reports/${reportId}/reviews`, { token: tokens.coordinator });
    const reviewList = assertOk(reviews, 200);
    assert.ok(Array.isArray(reviewList) && reviewList.length >= 2);

    const closed = await request('POST', `/cases/${caseId}/close`, {
      token: tokens.coordinator,
      body: { resultadoFinal: 'Certification granted with observations', emitirInforme: true },
    });
    const closeData = assertOk(closed, 200);
    assert.ok(closeData.informeOficialUrl);

    const again = await request('POST', `/cases/${caseId}/close`, {
      token: tokens.coordinator,
      body: { resultadoFinal: 'duplicate', emitirInforme: false },
    });
    assertConflict(again);

    const pdf = await request('GET', `/cases/${caseId}/close/pdf`, {
      token: tokens.coordinator,
      redirect: 'manual',
    });
    assert.strictEqual(pdf.status, 200, `Expected the official PDF download, got ${pdf.status}`);
    assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/);
    const pdfBody = String(pdf.data);
    assert.ok(pdfBody.startsWith('%PDF-'), 'official report must be a PDF payload');
    assert.ok(pdfBody.includes(`Case #${caseId}`));
    assert.ok(pdfBody.includes('Official case report'));
    assert.ok(pdfBody.includes('Certification granted with observations'));

    const companyPdf = await request('GET', `/cases/${caseId}/close/pdf`, {
      token: tokens.company,
      redirect: 'manual',
    });
    assert.strictEqual(companyPdf.status, 200);
    assert.match(companyPdf.headers.get('content-type') ?? '', /application\/pdf/);
    assert.ok(String(companyPdf.data).startsWith('%PDF-'));

    const techPdf = await request('GET', `/cases/${caseId}/close/pdf`, {
      token: tokens.technician,
      redirect: 'manual',
    });
    assertForbidden(techPdf);

    await request('DELETE', `/evidences/${ev.evidenceId}`, { token: tokens.technician });
  });

  test('technician cannot finish an evaluation they do not own', async () => {
    const res = await request('POST', '/evaluations/1/finish', { token: tokens.company });
    assertForbidden(res);
  });
});

describe('LAPCH alert workflow', () => {
  before(async () => { await loginAll(); });

  test('coordinator records an alert, sets PROCEDE, and generates a case', async () => {
    const inst = await companyInstitution();
    const created = await request('POST', '/lapch-alerts', {
      token: tokens.coordinator,
      body: {
        institutionId: inst.institutionId,
        numeroAlerta: `LAPCH-${uid('a')}`,
        fecha: new Date().toISOString(),
        producto: 'Queso de freír',
        descripcion: 'Microbiology alert for isolated workflow test',
      },
    });
    const alert = assertOk(created, 201);

    const tooSoon = await request('POST', `/lapch-alerts/${alert.alertId}/generate-case`, {
      token: tokens.coordinator,
    });
    assertConflict(tooSoon);

    const result = await request('PATCH', `/lapch-alerts/${alert.alertId}/resultado`, {
      token: tokens.coordinator,
      body: { resultado: 'PROCEDE' },
    });
    assertOk(result, 200);

    const generated = await request('POST', `/lapch-alerts/${alert.alertId}/generate-case`, {
      token: tokens.coordinator,
    });
    const payload = assertOk(generated, 201);
    assert.ok(payload.case?.caseId);
    assert.strictEqual(payload.case.origin, 'ALERTA_LAPCH');

    const duplicate = await request('POST', `/lapch-alerts/${alert.alertId}/generate-case`, {
      token: tokens.coordinator,
    });
    assertConflict(duplicate);

    const closed = await request('POST', `/lapch-alerts/${alert.alertId}/close`, {
      token: tokens.coordinator,
    });
    assertOk(closed, 200);
  });

  test('company cannot list LAPCH alerts', async () => {
    const res = await request('GET', '/lapch-alerts', { token: tokens.company });
    assertForbidden(res);
  });
});

describe('Complaint workflow', () => {
  before(async () => { await loginAll(); });

  test('public complaint with institution can proceed to a case', async () => {
    const inst = await companyInstitution();
    const created = await request('POST', '/complaints', {
      token: null,
      body: {
        tipoDenuncia: 'Hygiene',
        fechaRecepcion: new Date().toISOString(),
        denunciante: `Citizen ${uid('d')}`,
        descripcion: 'Anonymous complaint used only for automated workflow coverage',
        institutionId: inst.institutionId,
      },
    });
    const complaint = assertOk(created, 201);

    const tooSoon = await request('POST', `/complaints/${complaint.complaintId}/generate-case`, {
      token: tokens.coordinator,
    });
    assertConflict(tooSoon);

    const result = await request('PATCH', `/complaints/${complaint.complaintId}/resultado`, {
      token: tokens.coordinator,
      body: { resultado: 'PROCEDE' },
    });
    assertOk(result, 200);

    const generated = await request('POST', `/complaints/${complaint.complaintId}/generate-case`, {
      token: tokens.coordinator,
    });
    const payload = assertOk(generated, 201);
    assert.ok(payload.case?.caseId);
    assert.strictEqual(payload.case.origin, 'DENUNCIA');
  });

  test('complaint without an institution cannot generate a case', async () => {
    const created = await request('POST', '/complaints', {
      token: null,
      body: {
        tipoDenuncia: 'Other',
        fechaRecepcion: new Date().toISOString(),
        denunciante: 'Anonymous',
        descripcion: 'No establishment identified',
      },
    });
    const complaint = assertOk(created, 201);
    const result = await request('PATCH', `/complaints/${complaint.complaintId}/resultado`, {
      token: tokens.coordinator,
      body: { resultado: 'PROCEDE' },
    });
    assertOk(result, 200);
    const generated = await request('POST', `/complaints/${complaint.complaintId}/generate-case`, {
      token: tokens.coordinator,
    });
    assertValidationError(generated);
  });
});

describe('Isolation and not-found', () => {
  before(async () => { await loginAll(); });

  test('company cannot read coordinator dashboard', async () => {
    const res = await request('GET', '/dashboard/coordinador', { token: tokens.company });
    assertForbidden(res);
  });

  test('technician cannot search global history', async () => {
    const res = await request('GET', '/history/search', { token: tokens.technician });
    assertForbidden(res);
  });

  test('unauthenticated history search returns 401', async () => {
    const res = await request('GET', '/history/search', { token: null });
    assertUnauthorized(res);
  });

  test('GET unknown evaluation returns 404', async () => {
    const res = await request('GET', '/evaluations/999999', { token: tokens.admin });
    assertNotFound(res);
  });

  test('GET unknown case returns 404', async () => {
    const res = await request('GET', '/cases/999999', { token: tokens.admin });
    assertNotFound(res);
  });
});
