import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { usersService } from './services';
import type { UserWithPerson } from '@reto/shared';
import './UserApprovalPanel.css';

interface UserApprovalPanelProps {
  notify?: (message: string) => void;
}

type FilterTab = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ALL';

export default function UserApprovalPanel({ notify }: UserApprovalPanelProps) {
  const [users, setUsers] = useState<UserWithPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('PENDIENTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Modal para rechazo con motivo
  const [rejectModalUser, setRejectModalUser] = useState<UserWithPerson | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await usersService.list({ page: 1, pageSize: 100 });
      if (response.valid && response.data?.items) {
        setUsers(response.data.items);
      }
    } catch (err: unknown) {
      console.error('Error al cargar usuarios:', err);
      notify?.('No se pudieron cargar los usuarios. Verifica la conexión con el backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  // Conteos para los tabs y las métricas
  const counts = useMemo(() => {
    const pending = users.filter((u) => u.status === 'PENDIENTE_VALIDACION').length;
    const approved = users.filter((u) => u.status === 'APROBADO').length;
    const rejected = users.filter((u) => u.status === 'RECHAZADO').length;
    return { pending, approved, rejected, total: users.length };
  }, [users]);

  // Filtrado reactivo por pestaña y búsqueda
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Filtro de tab
      if (activeTab === 'PENDIENTE' && user.status !== 'PENDIENTE_VALIDACION') return false;
      if (activeTab === 'APROBADO' && user.status !== 'APROBADO') return false;
      if (activeTab === 'RECHAZADO' && user.status !== 'RECHAZADO') return false;

      // Filtro de búsqueda
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = user.person?.name?.toLowerCase() ?? '';
      const email = user.person?.email?.toLowerCase() ?? '';
      const cedula = user.person?.cedula?.toLowerCase() ?? '';
      const role = user.role?.name?.toLowerCase() ?? '';

      return name.includes(q) || email.includes(q) || cedula.includes(q) || role.includes(q);
    });
  }, [users, activeTab, searchQuery]);

  // Acción de Aprobar Usuario
  const handleApprove = async (user: UserWithPerson) => {
    setBusyId(user.userId);
    try {
      const result = await usersService.updateStatus(user.userId, { status: 'APROBADO' });
      if (result.valid) {
        notify?.(`✅ El usuario ${user.person?.name ?? 'solicitante'} ha sido APROBADO exitosamente.`);
        await loadUsers();
      }
    } catch (err: unknown) {
      console.error('Error al aprobar usuario:', err);
      notify?.('Ocurrió un error al intentar aprobar el usuario.');
    } finally {
      setBusyId(null);
    }
  };

  // Abrir Modal de Rechazo
  const openRejectModal = (user: UserWithPerson) => {
    setRejectModalUser(user);
    setMotivoRechazo('');
  };

  // Confirmar Rechazo con motivo
  const handleConfirmReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectModalUser) return;

    if (!motivoRechazo.trim()) {
      notify?.('Debe especificar un motivo de rechazo.');
      return;
    }

    setBusyId(rejectModalUser.userId);
    try {
      const result = await usersService.updateStatus(rejectModalUser.userId, {
        status: 'RECHAZADO',
        motivoRechazo: motivoRechazo.trim(),
      });

      if (result.valid) {
        notify?.(`❌ El registro de ${rejectModalUser.person?.name ?? 'usuario'} ha sido RECHAZADO.`);
        setRejectModalUser(null);
        await loadUsers();
      }
    } catch (err: unknown) {
      console.error('Error al rechazar usuario:', err);
      notify?.('Ocurrió un error al intentar rechazar el usuario.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="uap-container">
      {/* Encabezado Principal */}
      <div className="uap-header">
        <div>
          <small className="eyebrow" style={{ color: '#00236f', fontWeight: 700, textTransform: 'uppercase' }}>
            Administración Central • RF-02
          </small>
          <h1>Validación y Aprobación de Usuarios</h1>
          <p>
            Revisa, aprueba o rechaza solicitudes de acceso y autorregistros de representantes de empresas y técnicos en
            la plataforma sanitaria.
          </p>
        </div>
        <button className="uap-btn uap-btn-approve" onClick={() => void loadUsers()} disabled={loading}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>sync</span>
          Actualizar Lista
        </button>
      </div>

      {/* Tarjetas de Métricas Resumen */}
      <div className="uap-stats">
        <div className="uap-stat-card">
          <div className="uap-stat-icon pending">
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.pending}</span>
            <span className="uap-stat-label">Pendientes Validación</span>
          </div>
        </div>

        <div className="uap-stat-card">
          <div className="uap-stat-icon approved">
            <span className="material-symbols-outlined">how_to_reg</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.approved}</span>
            <span className="uap-stat-label">Usuarios Aprobados</span>
          </div>
        </div>

        <div className="uap-stat-card">
          <div className="uap-stat-icon rejected">
            <span className="material-symbols-outlined">person_cancel</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.rejected}</span>
            <span className="uap-stat-label">Solicitudes Rechazadas</span>
          </div>
        </div>

        <div className="uap-stat-card">
          <div className="uap-stat-icon total">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.total}</span>
            <span className="uap-stat-label">Total en Directorio</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="uap-controls">
        <div className="uap-filter-tabs" role="tablist">
          <button
            className={`uap-tab-btn ${activeTab === 'PENDIENTE' ? 'active' : ''}`}
            onClick={() => setActiveTab('PENDIENTE')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>hourglass_top</span>
            Pendientes
            {counts.pending > 0 && <span className="uap-badge-count">{counts.pending}</span>}
          </button>

          <button
            className={`uap-tab-btn ${activeTab === 'APROBADO' ? 'active' : ''}`}
            onClick={() => setActiveTab('APROBADO')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
            Aprobados ({counts.approved})
          </button>

          <button
            className={`uap-tab-btn ${activeTab === 'RECHAZADO' ? 'active' : ''}`}
            onClick={() => setActiveTab('RECHAZADO')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>cancel</span>
            Rechazados ({counts.rejected})
          </button>

          <button
            className={`uap-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>list</span>
            Todos ({counts.total})
          </button>
        </div>

        <div className="uap-search-box">
          <span className="material-symbols-outlined" style={{ color: '#535f73', fontSize: '1.2rem' }}>search</span>
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="uap-table-wrap">
        <table className="uap-table">
          <thead>
            <tr>
              <th>Usuario / Solicitante</th>
              <th>Cédula</th>
              <th>Teléfono</th>
              <th>Rol Asignado</th>
              <th>Fecha de Registro</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="uap-empty-state">
                  <div className="uap-empty-icon material-symbols-outlined">sync</div>
                  <p>Cargando directorio de usuarios...</p>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="uap-empty-state">
                  <div className="uap-empty-icon material-symbols-outlined">manage_accounts</div>
                  <p>No se encontraron usuarios bajo este filtro.</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isPending = user.status === 'PENDIENTE_VALIDACION';
                const isApproved = user.status === 'APROBADO';
                const isRejected = user.status === 'RECHAZADO';
                const isBusy = busyId === user.userId;
                const initials = user.person?.name
                  ? user.person.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'US';

                return (
                  <tr key={user.userId}>
                    <td>
                      <div className="uap-user-cell">
                        <div className="uap-avatar">{initials}</div>
                        <div className="uap-user-meta">
                          <span className="uap-user-name">{user.person?.name ?? `Usuario #${user.userId}`}</span>
                          <span className="uap-user-email">{user.person?.email ?? '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>{user.person?.cedula ?? '—'}</code>
                    </td>
                    <td>{user.person?.phone ?? '—'}</td>
                    <td>
                      <span className="uap-role-pill">{user.role?.name ?? 'SIN_ROL'}</span>
                    </td>
                    <td>
                      <small style={{ color: '#535f73' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-DO') : '—'}
                      </small>
                    </td>
                    <td>
                      {isPending && (
                        <span className="uap-status-badge pending">
                          <span className="uap-status-dot" />
                          Pendiente
                        </span>
                      )}
                      {isApproved && (
                        <span className="uap-status-badge approved">
                          <span className="uap-status-dot" />
                          Aprobado
                        </span>
                      )}
                      {isRejected && (
                        <span className="uap-status-badge rejected">
                          <span className="uap-status-dot" />
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="uap-actions-cell" style={{ justifyContent: 'flex-end' }}>
                        {isPending && (
                          <>
                            <button
                              className="uap-btn uap-btn-approve"
                              onClick={() => void handleApprove(user)}
                              disabled={isBusy}
                              title="Aprobar acceso a la plataforma"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                              Aprobar
                            </button>
                            <button
                              className="uap-btn uap-btn-reject"
                              onClick={() => openRejectModal(user)}
                              disabled={isBusy}
                              title="Rechazar solicitud con motivo"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                              Rechazar
                            </button>
                          </>
                        )}
                        {isRejected && (
                          <button
                            className="uap-btn uap-btn-approve"
                            onClick={() => void handleApprove(user)}
                            disabled={isBusy}
                            title="Reconsiderar y aprobar usuario"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                            Aprobar
                          </button>
                        )}
                        {isApproved && (
                          <button
                            className="uap-btn uap-btn-reject"
                            onClick={() => openRejectModal(user)}
                            disabled={isBusy}
                            title="Revocar acceso / Marcar como rechazado"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>block</span>
                            Revocar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para Rechazo con Motivo Obligatorio */}
      {rejectModalUser && (
        <div className="uap-modal-backdrop" onClick={() => setRejectModalUser(null)}>
          <div className="uap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uap-modal-header">
              <div className="uap-modal-icon">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="uap-modal-title">Rechazar Solicitud de Usuario</h3>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="uap-modal-body">
                <div className="uap-modal-target">
                  <strong>Solicitante:</strong> {rejectModalUser.person?.name} ({rejectModalUser.person?.email})
                  <br />
                  <strong>Cédula:</strong> {rejectModalUser.person?.cedula} | <strong>Rol:</strong>{' '}
                  {rejectModalUser.role?.name}
                </div>

                <label className="uap-modal-label">
                  Motivo de Rechazo (requerido por auditoría):
                  <textarea
                    className="uap-modal-textarea"
                    placeholder="Ejemplo: Cédula ilegible o falta de correspondencia con el RNC de la empresa solicitada..."
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="uap-modal-footer">
                <button
                  type="button"
                  className="uap-btn uap-btn-cancel"
                  onClick={() => setRejectModalUser(null)}
                  disabled={busyId !== null}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="uap-btn uap-btn-confirm-reject"
                  disabled={busyId !== null || !motivoRechazo.trim()}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                  Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
