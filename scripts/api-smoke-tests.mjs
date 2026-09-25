const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3010/api/v1';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Password123!';

const accounts = {
  admin: { usuario: process.env.TEST_ADMIN ?? 'admin@salud.gob.do', password: PASSWORD },
  coordinator: { usuario: process.env.TEST_COORDINATOR ?? 'coordinador@salud.gob.do', password: PASSWORD },
  technician: { usuario: process.env.TEST_TECHNICIAN ?? 'tecnico1@salud.gob.do', password: PASSWORD },
  company: { usuario: process.env.TEST_COMPANY ?? 'admin@lacteosdelnorte.do', password: PASSWORD },
};

const tokens = {};
let passed = 0;
let failed = 0;

function printResult(ok, method, path, status, expected) {
  const marker = ok ? 'PASS' : 'FAIL';
  console.log(`${marker} ${method.padEnd(6)} ${path} -> ${status} (expected ${expected.join('/')})`);
}

async function request(method, path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers ?? {}) };
  const token = Object.prototype.hasOwnProperty.call(options, 'token') ? options.token : tokens.admin;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, data: { error: error.message } };
  }
}

async function test(method, path, expected, options = {}) {
  const result = await request(method, path, options);
  const ok = expected.includes(result.status);
  printResult(ok, method, path, result.status, expected);
  if (ok) passed++;
  else {
    failed++;
    console.log(`       response: ${JSON.stringify(result.data)}`);
  }
  return result;
}

async function login(name) {
  const result = await test('POST', '/auth/login', [200], {
    token: null,
    body: accounts[name],
  });
  if (result.status === 200 && result.data?.valid) {
    tokens[name] = result.data.data.accessToken;
    return result.data.data.refreshToken;
  }
  return null;
}

console.log(`Testing ${API_URL}`);
console.log('Read tests use seeded development records. Mutation tests intentionally send invalid data and should not modify records.\n');

const adminRefreshToken = await login('admin');
await login('coordinator');
await login('technician');
await login('company');

await test('POST', '/auth/login', [401], {
  token: null,
  body: { usuario: accounts.admin.usuario, password: 'wrong-password' },
});
await test('POST', '/auth/password/forgot', [400], { token: null, body: {} });
await test('POST', '/auth/password/reset', [400], { token: null, body: {} });
await test('POST', '/auth/2fa/verify', [400], { token: null, body: {} });
await test('POST', '/auth/password/change', [401], { token: null, body: {} });
await test('POST', '/auth/2fa/enable', [401], { token: null });
await test('POST', '/auth/refresh', [200], { token: null, body: { refreshToken: adminRefreshToken } });
await test('GET', '/roles', [401], { token: null });
await test('PATCH', '/users/1/status', [400], { body: {} });
await test('DELETE', '/users/999999', [404]);
await test('PATCH', '/users/999999', [404], { body: {} });

const adminGets = [
  '/roles',
  '/users?page=1&pageSize=20',
  '/users/1',
  '/users/999999',
  '/institutions?page=1&pageSize=20',
  '/institutions/1',
  '/institutions/1/history',
  '/institutions/1/evaluations?page=1&pageSize=20',
  '/bpm-requests?page=1&pageSize=20',
  '/bpm-requests/1',
  '/cases?page=1&pageSize=20',
  '/cases/1',
  '/cases/1/close/pdf',
  '/evaluations?page=1&pageSize=20',
  '/evaluations/1',
  '/evaluations/1/score',
  '/evaluations/1/report',
  '/reports/1/reviews',
  '/form-templates',
  '/form-templates/1/tree',
  '/catalogs/provinces',
  '/catalogs/municipalities?provinceId=1',
  '/catalogs/health-areas',
  '/catalogs/categories',
  '/catalogs/categories/1/subcategories',
  '/catalogs/foods?categoryId=1',
  '/catalogs/risk-frequency-rules',
  '/lapch-alerts?page=1&pageSize=20',
  '/lapch-alerts/1',
  '/complaints?page=1&pageSize=20',
  '/complaints/1',
  '/notifications?page=1&pageSize=20',
  '/history/search?page=1&pageSize=20',
  '/dashboard/coordinador',
];

for (const path of adminGets) await test('GET', path, [200, 404]);

const coordinatorGets = [
  '/cases?page=1&pageSize=20',
  '/bpm-requests?page=1&pageSize=20',
  '/evaluations?page=1&pageSize=20',
  '/dashboard/coordinador',
  '/cases/1/assignments',
  '/lapch-alerts?page=1&pageSize=20',
  '/complaints?page=1&pageSize=20',
];

for (const path of coordinatorGets) await test('GET', path, [200, 404], { token: tokens.coordinator });

await test('POST', '/cases/1/assign', [400, 404], { token: tokens.coordinator, body: {} });
await test('POST', '/cases/1/reassign', [400, 404], { token: tokens.coordinator, body: {} });

const technicianGets = [
  '/evaluations/calendar?from=2026-09-01&to=2026-10-01&view=month',
  '/evaluations?page=1&pageSize=20',
  '/evaluations/1',
  '/evaluations/1/evidences',
  '/evaluations/1/score',
  '/form-templates',
  '/form-templates/1/tree',
  '/dashboard/tecnico',
  '/notifications?page=1&pageSize=20',
];

for (const path of technicianGets) {
  const expected = path === '/evaluations/1' || path === '/evaluations/1/evidences' || path === '/evaluations/1/score'
    ? [200, 403, 404]
    : [200, 404];
  await test('GET', path, expected, { token: tokens.technician });
}

const companyGets = [
  '/bpm-requests?page=1&pageSize=20',
  '/bpm-requests/1',
  '/dashboard/empresa',
  '/notifications?page=1&pageSize=20',
];

for (const path of companyGets) await test('GET', path, [200, 404], { token: tokens.company });

await test('POST', '/attachments', [400], { token: tokens.admin, body: {} });
await test('GET', '/attachments/1', [200, 404]);
await test('DELETE', '/attachments/999999', [404]);
await test('POST', '/evaluations/1/evidences', [400, 403], { token: tokens.technician, body: {} });
await test('DELETE', '/evidences/999999', [404]);
await test('POST', '/bpm-requests/1/attachments', [400, 404], { token: tokens.company, body: {} });
await test('POST', '/bpm-requests/1/submit', [200, 400, 403, 404, 409], { token: tokens.company });
await test('POST', '/evaluations/1/cancel', [200, 400, 403, 404, 409], { token: tokens.coordinator });
await test('POST', '/evaluations/1/finish', [400, 403, 404], { token: tokens.technician });
await test('POST', '/reports/1/submit', [200, 400, 403, 404, 409]);
await test('POST', '/reports/1/resend', [200, 400, 403, 404, 409]);
await test('PATCH', '/notifications/read-all', [200, 204]);
await test('PATCH', '/notifications/999999/read', [404]);
await test('POST', '/lapch-alerts/1/generate-case', [200, 400, 403, 404, 409]);
await test('POST', '/lapch-alerts/1/close', [200, 400, 403, 404]);
await test('POST', '/complaints/1/generate-case', [200, 400, 403, 404, 409]);
await test('POST', '/institutions/1/representatives', [400, 403], { token: tokens.company, body: {} });
await test('PATCH', '/representatives/999999', [400, 403, 404], { token: tokens.company, body: {} });
await test('DELETE', '/representatives/999999', [403, 404], { token: tokens.company });

const protectedWithoutToken = [
  '/users',
  '/institutions',
  '/bpm-requests',
  '/cases',
  '/evaluations',
  '/form-templates',
  '/catalogs/provinces',
  '/lapch-alerts',
  '/complaints/1',
  '/notifications',
  '/history/search',
];

for (const path of protectedWithoutToken) await test('GET', path, [401], { token: null });

const invalidMutationTests = [
  ['POST', '/users/register'],
  ['POST', '/institutions'],
  ['PATCH', '/institutions/999999'],
  ['POST', '/bpm-requests'],
  ['PATCH', '/bpm-requests/1'],
  ['POST', '/cases'],
  ['PATCH', '/cases/1/priority'],
  ['POST', '/cases/1/close'],
  ['POST', '/evaluations'],
  ['PATCH', '/evaluations/1/reschedule'],
  ['POST', '/lapch-alerts'],
  ['PATCH', '/lapch-alerts/1/resultado'],
  ['POST', '/complaints'],
  ['PATCH', '/complaints/1/resultado'],
  ['POST', '/reports/1/review'],
  ['POST', '/reports/1/correct'],
  ['PATCH', '/catalogs/risk-frequency-rules/999999'],
  ['POST', '/evaluations/1/start'],
  ['PATCH', '/evaluations/1/answers'],
];

for (const [method, path] of invalidMutationTests) {
  await test(method, path, [400, 401, 403, 404], { body: {} });
}

await test('POST', '/auth/logout', [200, 204, 401], {
  token: tokens.admin,
  body: { refreshToken: adminRefreshToken },
});

console.log(`\nFinished: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
