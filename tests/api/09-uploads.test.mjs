/**
 * 09-uploads.test.mjs
 * ---------------------------------------------------------------------------
 * Binary upload/download for POST /attachments and BPM request attachments.
 * Evidence uploads are covered in 10-workflows.test.mjs (need a live evaluation).
 * ---------------------------------------------------------------------------
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, upload, loginAll, tokens, sessionUsers, pngBytes, uid,
  assertOk, assertUnauthorized, assertForbidden, assertNotFound, assertValidationError,
} from './helpers.mjs';

describe('Attachments uploads', () => {
  before(async () => { await loginAll(); });

  test('unauthenticated POST /attachments returns 401', async () => {
    const res = await upload('POST', '/attachments', {
      token: null,
      fields: { category: 'OTRO' },
      file: pngBytes(),
      filename: 'dot.png',
      mimeType: 'image/png',
    });
    assertUnauthorized(res);
  });

  test('POST /attachments without a file returns 400', async () => {
    const res = await upload('POST', '/attachments', {
      token: tokens.admin,
      fields: { category: 'OTRO' },
    });
    assertValidationError(res);
  });

  test('POST /attachments without category returns 400', async () => {
    const res = await upload('POST', '/attachments', {
      token: tokens.admin,
      file: pngBytes(),
      filename: 'dot.png',
      mimeType: 'image/png',
    });
    assertValidationError(res);
  });

  test('POST /attachments with JSON body (no multipart file) returns 400', async () => {
    const res = await request('POST', '/attachments', {
      token: tokens.admin,
      body: { category: 'OTRO' },
    });
    assertValidationError(res);
  });

  test('ADMIN can upload, fetch, and delete a PNG', async () => {
    const name = `evidence-${uid('f')}.png`;
    const created = await upload('POST', '/attachments', {
      token: tokens.admin,
      fields: { category: 'EVIDENCIA_FOTO' },
      file: pngBytes(),
      filename: name,
      mimeType: 'image/png',
    });
    const attachment = assertOk(created, 201);
    assert.ok(attachment.attachmentId);
    assert.strictEqual(attachment.category, 'EVIDENCIA_FOTO');
    assert.strictEqual(attachment.fileName, name);
    assert.ok(attachment.fileUrl.startsWith('/uploads/'));

    const fetched = await request('GET', `/attachments/${attachment.attachmentId}`, { token: tokens.admin });
    const data = assertOk(fetched, 200);
    assert.strictEqual(data.attachmentId, attachment.attachmentId);

    const asTech = await request('GET', `/attachments/${attachment.attachmentId}`, { token: tokens.technician });
    assertForbidden(asTech);

    const techDelete = await request('DELETE', `/attachments/${attachment.attachmentId}`, { token: tokens.technician });
    assertForbidden(techDelete);

    const removed = await request('DELETE', `/attachments/${attachment.attachmentId}`, { token: tokens.admin });
    assertOk(removed, 200);

    const missing = await request('GET', `/attachments/${attachment.attachmentId}`, { token: tokens.admin });
    assertNotFound(missing);
  });

  test('GET /attachments/:id returns 404 for a missing id', async () => {
    const res = await request('GET', '/attachments/999999', { token: tokens.admin });
    assertNotFound(res);
  });

  test('DELETE /attachments/:id returns 404 for a missing id', async () => {
    const res = await request('DELETE', '/attachments/999999', { token: tokens.admin });
    assertNotFound(res);
  });

  test('uploader can read their own attachment', async () => {
    const created = await upload('POST', '/attachments', {
      token: tokens.company,
      fields: { category: 'CARTA_AUTORIZACION' },
      file: pngBytes(),
      filename: `carta-${uid('c')}.png`,
      mimeType: 'image/png',
    });
    const attachment = assertOk(created, 201);
    const own = await request('GET', `/attachments/${attachment.attachmentId}`, { token: tokens.company });
    assertOk(own, 200);
    const other = await request('GET', `/attachments/${attachment.attachmentId}`, { token: tokens.delegate });
    assertForbidden(other);
    const cleanup = await request('DELETE', `/attachments/${attachment.attachmentId}`, { token: tokens.company });
    assertOk(cleanup, 200);
  });

  test('oversized file is rejected with 400', async () => {
    const oversized = Buffer.alloc(25 * 1024 * 1024 + 1, 1);
    const res = await upload('POST', '/attachments', {
      token: tokens.admin,
      fields: { category: 'OTRO' },
      file: oversized,
      filename: 'too-big.bin',
      mimeType: 'application/octet-stream',
    });
    assertValidationError(res);
  });

  test('repeated uploads of the same bytes create distinct attachments', async () => {
    const bytes = pngBytes();
    const first = await upload('POST', '/attachments', {
      token: tokens.admin,
      fields: { category: 'OTRO' },
      file: bytes,
      filename: 'same.png',
      mimeType: 'image/png',
    });
    const second = await upload('POST', '/attachments', {
      token: tokens.admin,
      fields: { category: 'OTRO' },
      file: bytes,
      filename: 'same.png',
      mimeType: 'image/png',
    });
    const a = assertOk(first, 201);
    const b = assertOk(second, 201);
    assert.notStrictEqual(a.attachmentId, b.attachmentId);
    await request('DELETE', `/attachments/${a.attachmentId}`, { token: tokens.admin });
    await request('DELETE', `/attachments/${b.attachmentId}`, { token: tokens.admin });
  });
});

describe('BPM request attachments', () => {
  before(async () => { await loginAll(); });

  test('author can attach documentation to a draft BPM request', async () => {
    const institutions = await request('GET', '/institutions?page=1&pageSize=5', { token: tokens.company });
    const inst = assertOk(institutions, 200).items[0];
    assert.ok(inst?.institutionId, 'Seeded company must own at least one institution');

    const created = await request('POST', '/bpm-requests', {
      token: tokens.company,
      body: {
        institutionId: inst.institutionId,
        tipoEstablecimiento: 'Dairy plant',
        motivo: `Upload coverage ${uid('bpm')}`,
      },
    });
    const bpm = assertOk(created, 201);

    const attached = await upload('POST', `/bpm-requests/${bpm.bpmRequestId}/attachments`, {
      token: tokens.company,
      file: pngBytes(),
      filename: 'registry.png',
      mimeType: 'image/png',
    });
    const doc = assertOk(attached, 201);
    assert.strictEqual(doc.category, 'DOCUMENTACION_OBLIGATORIA');
    assert.strictEqual(doc.bpmRequestId, bpm.bpmRequestId);

    const asOther = await upload('POST', `/bpm-requests/${bpm.bpmRequestId}/attachments`, {
      token: tokens.delegate,
      file: pngBytes(),
      filename: 'other.png',
      mimeType: 'image/png',
    });
    assertForbidden(asOther);
  });

  test('unauthenticated BPM attachment upload returns 401', async () => {
    const res = await upload('POST', '/bpm-requests/1/attachments', {
      token: null,
      file: pngBytes(),
      filename: 'x.png',
      mimeType: 'image/png',
    });
    assertUnauthorized(res);
  });
});

void sessionUsers;
