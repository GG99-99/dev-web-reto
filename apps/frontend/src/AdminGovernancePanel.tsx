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
        .catch(() => notify('Error al cargar la matriz de reglas de riesgo.'))
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
        .catch(() => notify('Error al cargar categorías de alimentos.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'users') {
      setLoading(true)
      usersService
        .list({ page: 1, pageSize: 50 })
        .then((res) => {
          if (res.valid) setUsers(res.data.items || [])
        })
        .catch(() => notify('Error al cargar directorio de usuarios.'))
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
  const handleSaveRule = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingRule) return
    const form = new FormData(e.currentTarget)
    const ruleId = editingRule.ruleId ?? editingRule.riskFrequencyRuleId
    const body = {
      frecuenciaMeses: Number(form.get('frecuenciaMeses')),
      puntajeMin: Number(form.get('puntajeMin')),
      puntajeMax: Number(form.get('puntajeMax')),
      prioridad: String(form.get('prioridad') || editingRule.prioridad),
    }

    setSavingRule(true)
    try {
      const res = await riskEngineService.updateFrequencyRule(ruleId, body)
      if (res.valid) {
        notify(`Regla "${editingRule.nivelRiesgo}" actualizada correctamente.`)
        setRules((prev) =>
          prev.map((r) =>
            (r.ruleId ?? r.riskFrequencyRuleId) === ruleId ? { ...r, ...body } : r
          )
        )
        setEditingRule(null)
      }
    } catch {
      notify('Error al guardar la regla de frecuencia.')
    } finally {
      setSavingRule(false)
    }
  }

  // Update user status
  const handleUpdateUserStatus = async (userId: number, newStatus: string) => {
    try {
      const res = await usersService.updateStatus(userId, { status: newStatus as any })
      if (res.valid) {
        notify(`Estado de usuario actualizado a "${newStatus}".`)
        setUsers((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, status: newStatus } : u))
        )
      }
    } catch {
      notify('No se pudo actualizar el estado del usuario.')
    }
  }

  // Delete user
  const handleDeleteUser = async (userId: number, name: string) => {
    if (!confirm(`¿Está seguro de eliminar o desactivar la cuenta de "${name}"?`)) return
    try {
      const res = await usersService.remove(userId)
      if (res.valid) {
        notify(`Usuario "${name}" eliminado del sistema.`)
        setUsers((prev) => prev.filter((u) => u.userId !== userId))
      }
    } catch {
      notify('Error al eliminar usuario.')
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
          <small>Administración Central · Sistema RADAR Sanitario</small>
          <h1>Gobernanza de Reglas, Catálogos y Usuarios</h1>
          <p>Parametrización de matrices de riesgo EBR, catálogo normalizado de alimentos y control global de acceso.</p>
        </div>
        <div className="gov-hero-badge">
          <span>⚙ Rol: <strong>ADMIN</strong></span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="gov-tabs">
        <button
          type="button"
          className={`gov-tab-btn ${activeTab === 'risk-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('risk-rules')}
        >
          <span>⚖</span> Matriz de Reglas de Riesgo (RF-14)
        </button>
        <button
          type="button"
          className={`gov-tab-btn ${activeTab === 'food-catalogs' ? 'active' : ''}`}
          onClick={() => setActiveTab('food-catalogs')}
        >
          <span>🥦</span> Catálogo de Alimentos & Riesgo
        </button>
        <button
          type="button"
          className={`gov-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span>👥</span> Control Global de Usuarios (RF-02)
        </button>
      </div>

      {/* 3. Tab 1: Risk Rules */}
      {activeTab === 'risk-rules' && (
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2><span>⚖</span> Matriz de Frecuencia de Inspección</h2>
              <div className="gov-card-desc">
                Define los umbrales de puntuación de riesgo total, la periodicidad de vigilancia y la prioridad regulatoria.
              </div>
            </div>
          </div>

          <div className="gov-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Nivel de Riesgo</th>
                  <th>Puntaje Mínimo</th>
                  <th>Puntaje Máximo</th>
                  <th>Frecuencia Reglamentaria</th>
                  <th>Prioridad de Inspección</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {loading ? 'Cargando reglas...' : 'No hay reglas de frecuencia configuradas.'}
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => {
                    const ruleId = rule.ruleId ?? rule.riskFrequencyRuleId
                    return (
                      <tr key={ruleId}>
                        <td>
                          <span className={`gov-badge ${getRiskBadgeClass(rule.nivelRiesgo)}`}>
                            {rule.nivelRiesgo}
                          </span>
                        </td>
                        <td><strong>{rule.puntajeMin} pts</strong></td>
                        <td><strong>{rule.puntajeMax} pts</strong></td>
                        <td>Cada <strong>{rule.frecuenciaMeses} meses</strong></td>
                        <td>
                          <span className="gov-badge gov-badge-role">{rule.prioridad || 'ESTÁNDAR'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="gov-btn gov-btn-secondary"
                            onClick={() => setEditingRule(rule)}
                          >
                            ✏ Editar Parámetros
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
              <h2><span>🥦</span> Catálogo de Categorías y Subcategorías Alimentarias</h2>
              <div className="gov-card-desc">
                Matriz de riesgo intrínseco por tipo de alimento según la normativa sanitaria.
              </div>
            </div>
            <div className="gov-search-row">
              <input
                type="text"
                className="gov-input"
                placeholder="Filtrar subcategoría..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="gov-category-grid">
            {/* Left: Category selector */}
            <div className="gov-cat-list">
              <div style={{ padding: '8px 6px', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Categorías ({categories.length})
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
                      <th>Subcategoría de Alimento</th>
                      <th>Nivel de Riesgo Intrínseco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubcategories.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          No hay subcategorías registradas para esta categoría.
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
                                Nivel {sub.risk} ({riskLabel})
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
                    Alimentos de Referencia ({foods.length}):
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
              <h2><span>👥</span> Directorio y Gobernanza de Cuentas de Usuario</h2>
              <div className="gov-card-desc">
                Gestión de roles institucionales, estados de validación y control de acceso RBAC.
              </div>
            </div>
            <div className="gov-search-row">
              <input
                type="text"
                className="gov-input"
                placeholder="Buscar por nombre, cédula o email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ width: '260px' }}
              />
              <select
                className="gov-select"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
              >
                <option value="ALL">Todos los roles</option>
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
                <option value="ALL">Todos los estados</option>
                <option value="APROBADO">Aprobados</option>
                <option value="PENDIENTE_VALIDACION">Pendiente Validación</option>
                <option value="RECHAZADO">Rechazados</option>
              </select>
            </div>
          </div>

          <div className="gov-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Nombre y Cédula</th>
                  <th>Contacto</th>
                  <th>Rol Asignado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {loading ? 'Cargando usuarios...' : 'No se encontraron usuarios con los filtros indicados.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <strong>{u.person?.name || 'Usuario sin nombre'}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Cédula: {u.person?.cedula || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div>{u.person?.email || 'Sin correo'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {u.person?.phone || ''}
                        </div>
                      </td>
                      <td>
                        <span className="gov-badge gov-badge-role">
                          {u.role?.name || 'SIN_ROL'}
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
                              title="Aprobar acceso al sistema"
                            >
                              ✓ Aprobar
                            </button>
                          )}
                          {u.status === 'APROBADO' && (
                            <button
                              type="button"
                              className="gov-btn gov-btn-secondary"
                              onClick={() => handleUpdateUserStatus(u.userId, 'RECHAZADO')}
                              title="Suspender acceso"
                            >
                              Suspender
                            </button>
                          )}
                          <button
                            type="button"
                            className="gov-btn gov-btn-danger"
                            onClick={() => handleDeleteUser(u.userId, u.person?.name || '')}
                            title="Eliminar usuario"
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
          <div className="gov-modal" role="dialog" aria-label="Editar regla de riesgo">
            <div className="gov-modal-header">
              <h3>Editar Regla: {editingRule.nivelRiesgo}</h3>
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
                <div className="gov-form-group">
                  <label htmlFor="frecuenciaMeses">Frecuencia de Inspección (meses):</label>
                  <input
                    id="frecuenciaMeses"
                    name="frecuenciaMeses"
                    type="number"
                    min="1"
                    max="60"
                    defaultValue={editingRule.frecuenciaMeses}
                    className="gov-input"
                    required
                  />
                  <small style={{ color: '#64748b' }}>
                    Intervalo reglamentario en meses entre evaluaciones sanitarias consecutivas.
                  </small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="gov-form-group">
                    <label htmlFor="puntajeMin">Puntaje Mínimo:</label>
                    <input
                      id="puntajeMin"
                      name="puntajeMin"
                      type="number"
                      step="0.1"
                      defaultValue={editingRule.puntajeMin}
                      className="gov-input"
                      required
                    />
                  </div>
                  <div className="gov-form-group">
                    <label htmlFor="puntajeMax">Puntaje Máximo:</label>
                    <input
                      id="puntajeMax"
                      name="puntajeMax"
                      type="number"
                      step="0.1"
                      defaultValue={editingRule.puntajeMax}
                      className="gov-input"
                      required
                    />
                  </div>
                </div>

                <div className="gov-form-group">
                  <label htmlFor="prioridad">Prioridad Regulatoria:</label>
                  <select
                    id="prioridad"
                    name="prioridad"
                    defaultValue={editingRule.prioridad || 'MEDIA'}
                    className="gov-select"
                  >
                    <option value="BAJA">BAJA</option>
                    <option value="MEDIA">MEDIA</option>
                    <option value="ALTA">ALTA</option>
                    <option value="CRITICA">CRÍTICA</option>
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="gov-btn gov-btn-primary"
                  disabled={savingRule}
                >
                  {savingRule ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
