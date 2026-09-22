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

  // Modal for rejection with reason
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
      console.error('Error loading users:', err);
      notify?.('Could not load users. Check connection to the backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  // Counts for tabs and metrics
  const counts = useMemo(() => {
    const pending = users.filter((u) => u.status === 'PENDIENTE_VALIDACION').length;
    const approved = users.filter((u) => u.status === 'APROBADO').length;
    const rejected = users.filter((u) => u.status === 'RECHAZADO').length;
    return { pending, approved, rejected, total: users.length };
  }, [users]);

  // Reactive filtering by tab and search
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Tab filter
      if (activeTab === 'PENDIENTE' && user.status !== 'PENDIENTE_VALIDACION') return false;
      if (activeTab === 'APROBADO' && user.status !== 'APROBADO') return false;
      if (activeTab === 'RECHAZADO' && user.status !== 'RECHAZADO') return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = user.person?.name?.toLowerCase() ?? '';
      const email = user.person?.email?.toLowerCase() ?? '';
      const cedula = user.person?.cedula?.toLowerCase() ?? '';
      const role = user.role?.name?.toLowerCase() ?? '';

      return name.includes(q) || email.includes(q) || cedula.includes(q) || role.includes(q);
    });
  }, [users, activeTab, searchQuery]);

  // Approve User Action
  const handleApprove = async (user: UserWithPerson) => {
    setBusyId(user.userId);
    try {
      const result = await usersService.updateStatus(user.userId, { status: 'APROBADO' });
      if (result.valid) {
        notify?.(`✅ User ${user.person?.name ?? 'applicant'} has been successfully APPROVED.`);
        await loadUsers();
      }
    } catch (err: unknown) {
      console.error('Error approving user:', err);
      notify?.('An error occurred while attempting to approve the user.');
    } finally {
      setBusyId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (user: UserWithPerson) => {
    setRejectModalUser(user);
    setMotivoRechazo('');
  };

  // Confirm Reject with reason
  const handleConfirmReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectModalUser) return;

    if (!motivoRechazo.trim()) {
      notify?.('A rejection reason must be specified.');
      return;
    }

    setBusyId(rejectModalUser.userId);
    try {
      const result = await usersService.updateStatus(rejectModalUser.userId, {
        status: 'RECHAZADO',
        motivoRechazo: motivoRechazo.trim(),
      });

      if (result.valid) {
        notify?.(`❌ The record for ${rejectModalUser.person?.name ?? 'user'} has been REJECTED.`);
        setRejectModalUser(null);
        await loadUsers();
      }
    } catch (err: unknown) {
      console.error('Error rejecting user:', err);
      notify?.('An error occurred while attempting to reject the user.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="uap-container">
      {/* Main Header */}
      <div className="uap-header">
        <div>
          <small className="eyebrow" style={{ color: '#00236f', fontWeight: 700, textTransform: 'uppercase' }}>
            Central Administration • RF-02
          </small>
          <h1>User Validation and Approval</h1>
          <p>
            Review, approve, or reject access requests and self-registrations of company representatives and technicians on the sanitary platform.
          </p>
        </div>
        <button className="uap-btn uap-btn-approve" onClick={() => void loadUsers()} disabled={loading}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>sync</span>
          Refresh List
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div className="uap-stats">
        <div className="uap-stat-card">
          <div className="uap-stat-icon pending">
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.pending}</span>
            <span className="uap-stat-label">Pending Validation</span>
          </div>
        </div>

        <div className="uap-stat-card">
          <div className="uap-stat-icon approved">
            <span className="material-symbols-outlined">how_to_reg</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.approved}</span>
            <span className="uap-stat-label">Approved Users</span>
          </div>
        </div>

        <div className="uap-stat-card">
          <div className="uap-stat-icon rejected">
            <span className="material-symbols-outlined">person_cancel</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.rejected}</span>
            <span className="uap-stat-label">Rejected Requests</span>
          </div>
        </div>

        <div className="uap-stat-card">
          <div className="uap-stat-icon total">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div className="uap-stat-info">
            <span className="uap-stat-value">{counts.total}</span>
            <span className="uap-stat-label">Total in Directory</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="uap-controls">
        <div className="uap-filter-tabs" role="tablist">
          <button
            className={`uap-tab-btn ${activeTab === 'PENDIENTE' ? 'active' : ''}`}
            onClick={() => setActiveTab('PENDIENTE')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>hourglass_top</span>
            Pending
            {counts.pending > 0 && <span className="uap-badge-count">{counts.pending}</span>}
          </button>

          <button
            className={`uap-tab-btn ${activeTab === 'APROBADO' ? 'active' : ''}`}
            onClick={() => setActiveTab('APROBADO')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
            Approved ({counts.approved})
          </button>

          <button
            className={`uap-tab-btn ${activeTab === 'RECHAZADO' ? 'active' : ''}`}
            onClick={() => setActiveTab('RECHAZADO')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>cancel</span>
            Rejected ({counts.rejected})
          </button>

          <button
            className={`uap-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>list</span>
            All ({counts.total})
          </button>
        </div>

        <div className="uap-search-box">
          <span className="material-symbols-outlined" style={{ color: '#535f73', fontSize: '1.2rem' }}>search</span>
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="uap-table-wrap">
        <table className="uap-table">
          <thead>
            <tr>
              <th>User / Applicant</th>
              <th>ID</th>
              <th>Phone</th>
              <th>Assigned Role</th>
              <th>Registration Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="uap-empty-state">
                  <div className="uap-empty-icon material-symbols-outlined">sync</div>
                  <p>Loading user directory...</p>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="uap-empty-state">
                  <div className="uap-empty-icon material-symbols-outlined">manage_accounts</div>
                  <p>No users found under this filter.</p>
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
                          <span className="uap-user-name">{user.person?.name ?? `User #${user.userId}`}</span>
                          <span className="uap-user-email">{user.person?.email ?? '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>{user.person?.cedula ?? '—'}</code>
                    </td>
                    <td>{user.person?.phone ?? '—'}</td>
                    <td>
                      <span className="uap-role-pill">{user.role?.name ?? 'NO_ROLE'}</span>
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
                          Pending
                        </span>
                      )}
                      {isApproved && (
                        <span className="uap-status-badge approved">
                          <span className="uap-status-dot" />
                          Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="uap-status-badge rejected">
                          <span className="uap-status-dot" />
                          Rejected
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
                              title="Approve access to the platform"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                              Approve
                            </button>
                            <button
                              className="uap-btn uap-btn-reject"
                              onClick={() => openRejectModal(user)}
                              disabled={isBusy}
                              title="Reject request with reason"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                              Reject
                            </button>
                          </>
                        )}
                        {isRejected && (
                          <button
                            className="uap-btn uap-btn-approve"
                            onClick={() => void handleApprove(user)}
                            disabled={isBusy}
                            title="Reconsider and approve user"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                            Approve
                          </button>
                        )}
                        {isApproved && (
                          <button
                            className="uap-btn uap-btn-reject"
                            onClick={() => openRejectModal(user)}
                            disabled={isBusy}
                            title="Revoke access / Mark as rejected"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>block</span>
                            Revoke
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

      {/* Modal for Mandatory Reason Rejection */}
      {rejectModalUser && (
        <div className="uap-modal-backdrop" onClick={() => setRejectModalUser(null)}>
          <div className="uap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uap-modal-header">
              <div className="uap-modal-icon">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="uap-modal-title">Reject User Request</h3>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="uap-modal-body">
                <div className="uap-modal-target">
                  <strong>Applicant:</strong> {rejectModalUser.person?.name} ({rejectModalUser.person?.email})
                  <br />
                  <strong>ID:</strong> {rejectModalUser.person?.cedula} | <strong>Role:</strong>{' '}
                  {rejectModalUser.role?.name}
                </div>

                <label className="uap-modal-label">
                  Rejection Reason (required for auditing):
                  <textarea
                    className="uap-modal-textarea"
                    placeholder="Example: Illegible ID or mismatch with the requested company's tax ID..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="uap-btn uap-btn-confirm-reject"
                  disabled={busyId !== null || !motivoRechazo.trim()}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
