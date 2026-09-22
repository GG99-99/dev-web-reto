// @ts-nocheck
import { useState, useEffect, useMemo, FormEvent } from 'react'
import {
  riskEngineService,
  catalogsService,
  usersService,
} from './services'
import './AdminGovernancePanel.css'

interface AdminGovernancePanelProps {
  notify: (msg: string) => void
}

type GovTab = 'risk-rules' | 'food-catalogs' | 'users'

export default function AdminGovernancePanel({ notify }: AdminGovernancePanelProps) {
  const [activeTab, setActiveTab] = useState<GovTab>('risk-rules')
  const [loading, setLoading] = useState(false)

  // 1. Risk Rules State
  const [rules, setRules] = useState<any[]>([])
  const [editingRule, setEditingRule] = useState<any | null>(null)
  const [savingRule, setSavingRule] = useState(false)

  // 2. Food Catalogs State
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [foods, setFoods] = useState<any[]>([])
  const [foodSearch, setFoodSearch] = useState('')

  // 3. User Governance State
  const [users, setUsers] = useState<any[]>([])
  const [userRoleFilter, setUserRoleFilter] = useState('ALL')
  const [userStatusFilter, setUserStatusFilter] = useState('ALL')
  const [userSearch, setUserSearch] = useState('')

  // Initial data loader per tab
  useEffect(() => {
    if (activeTab === 'risk-rules') {
      setLoading(true)
      riskEngineService
        .listFrequencyRules()
        .then((res) => {
          if (res.valid) setRules(res.data)
        })
        .catch(() => notify('Error loading the risk rules matrix.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'food-catalogs') {
      setLoading(true)
      catalogsService
        .listCategories()
        .then((res) => {
          if (res.valid) {
            setCategories(res.data)
            if (res.data.length > 0 && !selectedCatId) {
              setSelectedCatId(res.data[0].categoryId)
            }
          }
        })
        .catch(() => notify('Error loading food categories.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'users') {
      setLoading(true)
      usersService
        .list({ page: 1, pageSize: 50 })
        .then((res) => {
          if (res.valid) setUsers(res.data.items || [])
        })
        .catch(() => notify('Error loading users directory.'))
        .finally(() => setLoading(false))
    }
  }, [activeTab])

  // Load subcategories & foods when category changes
  useEffect(() => {
    if (!selectedCatId || activeTab !== 'food-catalogs') return
    let cancelled = false

    Promise.allSettled([
      catalogsService.listSubcategories(selectedCatId),
      catalogsService.listFoods(selectedCatId),
    ]).then(([subRes, foodRes]) => {
      if (cancelled) return
      if (subRes.status === 'fulfilled' && subRes.value.valid) {
        setSubcategories(subRes.value.data)
      } else {
        setSubcategories([])
      }
      if (foodRes.status === 'fulfilled' && foodRes.value.valid) {
        setFoods(foodRes.value.data)
      } else {
        setFoods([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedCatId, activeTab])

  // Save edited risk frequency rule
  // NOTE: RiskFrequencyRule per schema.prisma / @reto/shared/riskEngine.ts has
  // fields ruleId, minScore, maxScore (nullable), riskLevel (BAJO|MEDIO|ALTO),
  // frequency (ANUAL|SEMESTRAL|TRIMESTRAL). There is no "prioridad" or
  // "frecuenciaMeses" field on the backend model.
  const handleSaveRule = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingRule) return
    const form = new FormData(e.currentTarget)
    const ruleId = editingRule.ruleId
    const maxScoreRaw = String(form.get('maxScore') || '').trim()
    const body = {
      minScore: Number(form.get('minScore')),
      maxScore: maxScoreRaw === '' ? null : Number(maxScoreRaw),
      riskLevel: String(form.get('riskLevel') || editingRule.riskLevel) as 'BAJO' | 'MEDIO' | 'ALTO',
      frequency: String(form.get('frequency') || editingRule.frequency) as 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL',
    }

    setSavingRule(true)
    try {
      const res = await riskEngineService.updateFrequencyRule(ruleId, body)
      if (res.valid) {
        notify(`Rule "${editingRule.riskLevel}" updated successfully.`)
        setRules((prev) =>
          prev.map((r) => (r.ruleId === ruleId ? { ...r, ...body } : r))
        )
        setEditingRule(null)
      }
    } catch {
      notify('Error saving the frequency rule.')
    } finally {
      setSavingRule(false)
    }
  }

  // Update user status
  const handleUpdateUserStatus = async (userId: number, newStatus: string) => {
    try {
      const res = await usersService.updateStatus(userId, { status: newStatus as any })
      if (res.valid) {
        notify(`User status updated to "${newStatus}".`)
        setUsers((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, status: newStatus } : u))
        )
      }
    } catch {
      notify('Could not update user status.')
    }
  }

  // Delete user (soft delete via isActive=false — see users.service.ts:deactivate)
  const handleDeleteUser = async (userId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete or deactivate the account of "${name}"?`)) return
    try {
      const res = await usersService.deactivate(userId)
      if (res.valid) {
        notify(`User "${name}" deactivated from the system.`)
        setUsers((prev) => prev.filter((u) => u.userId !== userId))
      }
    } catch {
      notify('Error deleting user.')
    }
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userRoleFilter !== 'ALL' && u.role?.name !== userRoleFilter) return false
      if (userStatusFilter !== 'ALL' && u.status !== userStatusFilter) return false
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase()
        const matchName = (u.person?.name || '').toLowerCase().includes(q)
        const matchEmail = (u.person?.email || '').toLowerCase().includes(q)
        const matchCedula = (u.person?.cedula || '').toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchCedula) return false
      }
      return true
    })
  }, [users, userRoleFilter, userStatusFilter, userSearch])

  // Filtered subcategories & foods
  const filteredSubcategories = useMemo(() => {
    if (!foodSearch.trim()) return subcategories
    const q = foodSearch.toLowerCase()
    return subcategories.filter((s) => s.name.toLowerCase().includes(q))
  }, [subcategories, foodSearch])

  const getRiskBadgeClass = (riskLevel: string) => {
    switch ((riskLevel || '').toUpperCase()) {
      case 'BAJO': return 'gov-badge-bajo'
      case 'MEDIO': return 'gov-badge-medio'
      case 'ALTO': return 'gov-badge-alto'
      case 'CRITICO': return 'gov-badge-critico'
      default: return 'gov-badge-bajo'
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APROBADO': return 'gov-badge-aprobado'
      case 'PENDIENTE_VALIDACION': return 'gov-badge-pendiente'
      case 'RECHAZADO': return 'gov-badge-rechazado'
      default: return 'gov-badge-pendiente'
    }
  }

  return (
    <div className="admin-governance">
      {/* 1. Header Hero */}
      <div className="gov-hero">
        <div className="gov-hero-info">
          <small>Central Administration · Health RADAR System</small>
          <h1>Governance of Rules, Catalogs, and Users</h1>
          <p>Parameterization of EBR risk matrices, standardized food catalog, and global access control.</p>
        </div>
        <div className="gov-hero-badge">
          <span>⚙ Role: <strong>ADMIN</strong></span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="gov-tabs">
        <button
          type="button"
          className={`gov-tab-btn ${activeTab === 'risk-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('risk-rules')}
        >
          <span>⚖</span> Risk Rules Matrix (RF-14)
        </button>
        <button
          type="button"
          className={`gov-tab-btn ${activeTab === 'food-catalogs' ? 'active' : ''}`}
          onClick={() => setActiveTab('food-catalogs')}
        >
          <span>🥦</span> Food & Risk Catalog
        </button>
        <button
          type="button"
          className={`gov-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span>👥</span> Global User Control (RF-02)
        </button>
      </div>

      {/* 3. Tab 1: Risk Rules */}
      {activeTab === 'risk-rules' && (
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2><span>⚖</span> Inspection Frequency Matrix</h2>
              <div className="gov-card-desc">
                Defines total risk score thresholds, surveillance periodicity, and regulatory priority.
              </div>
            </div>
          </div>

          <div className="gov-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Risk Level</th>
                  <th>Minimum Score</th>
                  <th>Maximum Score</th>
                  <th>Regulatory Frequency</th>
                  <th>Inspection Priority</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {loading ? 'Loading rules...' : 'No frequency rules configured.'}
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => {
                    const ruleId = rule.ruleId
                    return (
                      <tr key={ruleId}>
                        <td>
                          <span className={`gov-badge ${getRiskBadgeClass(rule.riskLevel)}`}>
                            {rule.riskLevel}
                          </span>
                        </td>
                        <td><strong>{rule.minScore} pts</strong></td>
                        <td><strong>{rule.maxScore ?? '∞'} pts</strong></td>
                        <td>{rule.frequency}</td>
                        <td>
                          <span className="gov-badge gov-badge-role">{rule.riskLevel}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="gov-btn gov-btn-secondary"
                            onClick={() => setEditingRule(rule)}
                          >
                            ✏ Edit Parameters
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Tab 2: Food Catalogs */}
      {activeTab === 'food-catalogs' && (
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2><span>🥦</span> Food Categories and Subcategories Catalog</h2>
              <div className="gov-card-desc">
                Intrinsic risk matrix by food type according to health regulations.
              </div>
            </div>
            <div className="gov-search-row">
              <input
                type="text"
                className="gov-input"
                placeholder="Filter subcategory..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="gov-category-grid">
            {/* Left: Category selector */}
            <div className="gov-cat-list">
              <div style={{ padding: '8px 6px', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Categories ({categories.length})
              </div>
              {categories.map((cat) => (
                <div
                  key={cat.categoryId}
                  className={`gov-cat-item ${selectedCatId === cat.categoryId ? 'active' : ''}`}
                  onClick={() => setSelectedCatId(cat.categoryId)}
                >
                  <span>{cat.name}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>→</span>
                </div>
              ))}
            </div>

            {/* Right: Subcategories table */}
            <div className="gov-subcat-detail">
              <div className="gov-table-wrapper">
                <table className="gov-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Food Subcategory</th>
                      <th>Intrinsic Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubcategories.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          No subcategories registered for this category.
                        </td>
                      </tr>
                    ) : (
                      filteredSubcategories.map((sub) => {
                        const riskLabel = sub.risk === 3 ? 'ALTO' : sub.risk === 2 ? 'MEDIO' : 'BAJO'
                        return (
                          <tr key={sub.subCategoryId}>
                            <td style={{ color: '#94a3b8' }}>#{sub.subCategoryId}</td>
                            <td><strong>{sub.name}</strong></td>
                            <td>
                              <span className={`gov-badge ${getRiskBadgeClass(riskLabel)}`}>
                                Level {sub.risk} ({riskLabel})
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {foods.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#475569' }}>
                    Reference Foods ({foods.length}):
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {foods.map((food) => (
                      <span
                        key={food.foodId}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          color: '#334155',
                        }}
                      >
                        {food.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 3: Users Governance */}
      {activeTab === 'users' && (
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2><span>👥</span> User Account Directory and Governance</h2>
              <div className="gov-card-desc">
                Management of institutional roles, validation statuses, and RBAC access control.
              </div>
            </div>
            <div className="gov-search-row">
              <input
                type="text"
                className="gov-input"
                placeholder="Search by name, ID, or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ width: '260px' }}
              />
              <select
                className="gov-select"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
              >
                <option value="ALL">All roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="COORDINADOR">COORDINADOR</option>
                <option value="TECNICO_EVALUADOR">TECNICO_EVALUADOR</option>
                <option value="ADMIN_EMPRESA">ADMIN_EMPRESA</option>
                <option value="USUARIO_DELEGADO">USUARIO_DELEGADO</option>
              </select>
              <select
                className="gov-select"
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="APROBADO">Approved</option>
                <option value="PENDIENTE_VALIDACION">Pending Validation</option>
                <option value="RECHAZADO">Rejected</option>
              </select>
            </div>
          </div>

          <div className="gov-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Name and ID</th>
                  <th>Contact</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {loading ? 'Loading users...' : 'No users found with the specified filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <strong>{u.person?.name || 'Unnamed user'}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ID: {u.person?.cedula || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div>{u.person?.email || 'No email'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {u.person?.phone || ''}
                        </div>
                      </td>
                      <td>
                        <span className="gov-badge gov-badge-role">
                          {u.role?.name || 'NO_ROLE'}
                        </span>
                      </td>
                      <td>
                        <span className={`gov-badge ${getStatusBadgeClass(u.status)}`}>
                          {u.status || 'PENDIENTE_VALIDACION'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {u.status !== 'APROBADO' && (
                            <button
                              type="button"
                              className="gov-btn gov-btn-primary"
                              onClick={() => handleUpdateUserStatus(u.userId, 'APROBADO')}
                              title="Approve system access"
                            >
                              ✓ Approve
                            </button>
                          )}
                          {u.status === 'APROBADO' && (
                            <button
                              type="button"
                              className="gov-btn gov-btn-secondary"
                              onClick={() => handleUpdateUserStatus(u.userId, 'RECHAZADO')}
                              title="Suspend access"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            type="button"
                            className="gov-btn gov-btn-danger"
                            onClick={() => handleDeleteUser(u.userId, u.person?.name || '')}
                            title="Delete user"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Edit Rule Modal */}
      {editingRule && (
        <div className="gov-modal-overlay">
          <div className="gov-modal" role="dialog" aria-label="Edit risk rule">
            <div className="gov-modal-header">
              <h3>Edit Rule: {editingRule.riskLevel}</h3>
              <button
                type="button"
                className="gov-btn gov-btn-secondary"
                onClick={() => setEditingRule(null)}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveRule}>
              <div className="gov-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="gov-form-group">
                    <label htmlFor="minScore">Minimum Score:</label>
                    <input
                      id="minScore"
                      name="minScore"
                      type="number"
                      step="0.1"
                      defaultValue={editingRule.minScore}
                      className="gov-input"
                      required
                    />
                  </div>
                  <div className="gov-form-group">
                    <label htmlFor="maxScore">Maximum Score (empty = no limit):</label>
                    <input
                      id="maxScore"
                      name="maxScore"
                      type="number"
                      step="0.1"
                      defaultValue={editingRule.maxScore ?? ''}
                      className="gov-input"
                    />
                  </div>
                </div>

                <div className="gov-form-group">
                  <label htmlFor="riskLevel">Risk Level:</label>
                  <select
                    id="riskLevel"
                    name="riskLevel"
                    defaultValue={editingRule.riskLevel || 'BAJO'}
                    className="gov-select"
                  >
                    <option value="BAJO">BAJO</option>
                    <option value="MEDIO">MEDIO</option>
                    <option value="ALTO">ALTO</option>
                  </select>
                </div>

                <div className="gov-form-group">
                  <label htmlFor="frequency">Regulatory Inspection Frequency:</label>
                  <select
                    id="frequency"
                    name="frequency"
                    defaultValue={editingRule.frequency || 'ANUAL'}
                    className="gov-select"
                  >
                    <option value="ANUAL">ANUAL</option>
                    <option value="SEMESTRAL">SEMESTRAL</option>
                    <option value="TRIMESTRAL">TRIMESTRAL</option>
                  </select>
                </div>
              </div>

              <div className="gov-modal-footer">
                <button
                  type="button"
                  className="gov-btn gov-btn-secondary"
                  onClick={() => setEditingRule(null)}
                  disabled={savingRule}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gov-btn gov-btn-primary"
                  disabled={savingRule}
                >
                  {savingRule ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
