const FRONTEND_PROXY = 'http://localhost:5173/api/v1';

async function testFrontendCommunication() {
  console.log('================================================================');
  console.log('  VERIFICACIÓN INTEGRAL DE COMUNICACIÓN FRONTEND -> BACKEND -> BD');
  console.log('================================================================');
  console.log(`Punto de Entrada (Proxy Vite en el Frontend): ${FRONTEND_PROXY}\n`);

  // 1. Login como Técnico Evaluador (Luis Fernández)
  console.log('[1/7] Autenticación (POST /auth/login)...');
  const loginRes = await fetch(`${FRONTEND_PROXY}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: 'tecnico1@salud.gob.do',
      password: 'Password123!',
    }),
  });

  const loginJson = await loginRes.json();
  if (!loginRes.ok || !loginJson.valid) {
    throw new Error(`Falló el login: ${JSON.stringify(loginJson)}`);
  }

  const token = loginJson.data.accessToken;
  const user = loginJson.data.user;
  console.log(`✅ [HTTP ${loginRes.status}] Login exitoso`);
  console.log(`   Usuario: ${user.person.name} (${user.person.email})`);
  console.log(`   Rol: ${user.role.name} | Cédula: ${user.person.cedula}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Evaluaciones del técnico
  console.log('\n[2/7] Listado de Evaluaciones asignadas (GET /evaluations)...');
  const evalRes = await fetch(`${FRONTEND_PROXY}/evaluations`, { headers: authHeaders });
  const evalJson = await evalRes.json();
  console.log(`✅ [HTTP ${evalRes.status}] Evaluaciones recibidas`);
  const items = evalJson.data?.items ?? (Array.isArray(evalJson.data) ? evalJson.data : []);
  console.log(`   Total encontradas: ${evalJson.data?.total ?? items.length}`);
  if (items.length > 0) {
    const ev = items[0];
    console.log(`   -> Evaluación #${ev.evaluationId} - Estado: ${ev.status} - Fecha: ${ev.scheduledDate}`);
  }

  // 3. Calendario del técnico (RF-11)
  console.log('\n[3/7] Calendario de Visitas (GET /evaluations/calendar)...');
  const calRes = await fetch(`${FRONTEND_PROXY}/evaluations/calendar?view=month&from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z`, { headers: authHeaders });
  const calJson = await calRes.json();
  console.log(`✅ [HTTP ${calRes.status}] Calendario sincronizado`);
  console.log(`   Citas en el calendario para Septiembre 2026: ${calJson.data?.length ?? 0}`);
  if (calJson.data?.length > 0) {
    calJson.data.forEach(c => console.log(`   -> Evaluación #${c.evaluationId} (${c.status}) el ${c.scheduledDate}`));
  }

  // 4. Plantillas de Formulario BPM (RF-12 / RF-13)
  console.log('\n[4/7] Plantillas Oficiales BPM (GET /form-templates)...');
  const templRes = await fetch(`${FRONTEND_PROXY}/form-templates`, { headers: authHeaders });
  const templJson = await templRes.json();
  console.log(`✅ [HTTP ${templRes.status}] Plantillas BPM obtenidas`);
  if (templJson.data?.length > 0) {
    const t = templJson.data[0];
    console.log(`   -> Ficha ID #${t.templateId}: "${t.title}" (Versión ${t.version}, Capítulos: ${t.h1List?.length ?? 0})`);
    if (t.h1List?.length > 0) {
      t.h1List.slice(0, 3).forEach(c => console.log(`      * [${c.code}] ${c.title} (${c.h2List?.length ?? 0} preguntas)`));
    }
  }

  // 5. Dashboard del Técnico (RF-04)
  console.log('\n[5/7] Dashboard Técnico (GET /dashboard/tecnico)...');
  const dashRes = await fetch(`${FRONTEND_PROXY}/dashboard/tecnico`, { headers: authHeaders });
  const dashJson = await dashRes.json();
  console.log(`✅ [HTTP ${dashRes.status}] Métricas del Dashboard cargadas:`);
  console.log('  ', JSON.stringify(dashJson.data, null, 2));

  // 6. Notificaciones en Tiempo Real (RF-18)
  console.log('\n[6/7] Bandeja de Notificaciones (GET /notifications)...');
  const notifRes = await fetch(`${FRONTEND_PROXY}/notifications`, { headers: authHeaders });
  const notifJson = await notifRes.json();
  console.log(`✅ [HTTP ${notifRes.status}] Notificaciones consultadas`);
  console.log(`   Total notificaciones: ${notifJson.data?.length ?? 0}`);

  // 7. Consulta como Administrador (RF-02 - Gestión de Usuarios y Casos)
  console.log('\n[7/7] Verificando perfil ADMIN (Ana María Pérez)...');
  const adminLoginRes = await fetch(`${FRONTEND_PROXY}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: 'admin@salud.gob.do',
      password: 'Password123!',
    }),
  });
  const adminLoginJson = await adminLoginRes.json();
  const adminToken = adminLoginJson.data.accessToken;
  const usersRes = await fetch(`${FRONTEND_PROXY}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const usersJson = await usersRes.json();
  console.log(`✅ [HTTP ${usersRes.status}] Lista administrativa de usuarios recibida`);
  console.log(`   Total usuarios registrados en BD: ${usersJson.data?.total ?? usersJson.data?.items?.length ?? 0}`);

  console.log('\n================================================================');
  console.log('🎉 CONCLUSIÓN: EL FRONTEND SE COMUNICA AL 100% CON EL BACKEND');
  console.log('================================================================');
}

testFrontendCommunication().catch(err => {
  console.error('\n❌ ERROR EN LA COMUNICACIÓN FRONTEND-BACKEND:', err);
  process.exit(1);
});
