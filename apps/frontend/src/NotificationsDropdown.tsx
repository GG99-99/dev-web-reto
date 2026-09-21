// @ts-nocheck
import { useState, useEffect } from 'react'
import { notificationsService } from './services'
import './NotificationsDropdown.css'

interface NotificationsDropdownProps {
  isOpen: boolean
  onClose: () => void
  onUpdateUnreadCount?: (count: number) => void
  notify: (msg: string) => void
}

export default function NotificationsDropdown({
  isOpen,
  onClose,
  onUpdateUnreadCount,
  notify,
}: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [loading, setLoading] = useState(false)

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await notificationsService.list({ pageSize: 30 })
      if (res.valid) {
        const items = res.data.items || []
        setNotifications(items)
        const unread = items.filter((n: any) => !n.read).length
        if (onUpdateUnreadCount) onUpdateUnreadCount(unread)
      }
    } catch {
      // Ignorar en fallback offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadNotifications()
    }
  }, [isOpen])

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      const res = await notificationsService.markAsRead(id)
      if (res.valid) {
        setNotifications((prev) =>
          prev.map((n) => (n.notificationId === id ? { ...n, read: true } : n))
        )
        const newUnread = notifications.filter((n) => n.notificationId !== id && !n.read).length
        if (onUpdateUnreadCount) onUpdateUnreadCount(newUnread)
      }
    } catch {
      notify('No se pudo marcar la notificación como leída.')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const res = await notificationsService.markAllAsRead()
      if (res.valid) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        if (onUpdateUnreadCount) onUpdateUnreadCount(0)
        notify('Todas las notificaciones han sido marcadas como leídas.')
      }
    } catch {
      notify('Error al actualizar las notificaciones.')
    }
  }

  const getBubbleType = (title: string = '', msg: string = '') => {
    const text = (title + ' ' + msg).toLowerCase()
    if (text.includes('alerta') || text.includes('lapch') || text.includes('urgente')) return 'alert'
    if (text.includes('bpm') || text.includes('solicitud')) return 'bpm'
    if (text.includes('evaluaci') || text.includes('inspecci') || text.includes('dictamen')) return 'eval'
    return 'system'
  }

  const getBubbleIcon = (type: string) => {
    switch (type) {
      case 'alert': return '🚨'
      case 'bpm': return '📋'
      case 'eval': return '🛡'
      default: return '🔔'
    }
  }

  const formatTime = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return new Intl.DateTimeFormat('es-DO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  if (!isOpen) return null

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read : true))
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <>
      <div className="notifications-dropdown-overlay" onClick={onClose} />
      <div className="notifications-dropdown" role="dialog" aria-label="Centro de notificaciones">
        <div className="notif-header">
          <div className="notif-header-title">
            <h3>Notificaciones</h3>
            {unreadCount > 0 && <span className="notif-badge-count">{unreadCount}</span>}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="notif-btn-clear"
              onClick={handleMarkAllAsRead}
              title="Marcar todas como leídas"
            >
              ✓ Marcar todo leído
            </button>
          )}
        </div>

        <div className="notif-filter-bar">
          <button
            type="button"
            className={`notif-filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas ({notifications.length})
          </button>
          <button
            type="button"
            className={`notif-filter-pill ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            No leídas ({unreadCount})
          </button>
        </div>

        <div className="notif-list">
          {loading && notifications.length === 0 ? (
            <div className="notif-empty">
              <p>Cargando notificaciones...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-icon">🔕</div>
              <p>No tienes notificaciones {filter === 'unread' ? 'pendientes' : ''}.</p>
            </div>
          ) : (
            filtered.map((item) => {
              const type = getBubbleType(item.title, item.message)
              return (
                <div
                  key={item.notificationId}
                  className={`notif-item ${!item.read ? 'unread' : ''}`}
                  onClick={() => {
                    if (!item.read) void handleMarkAsRead(item.notificationId)
                  }}
                >
                  <div className={`notif-icon-bubble ${type}`}>
                    {getBubbleIcon(type)}
                  </div>
                  <div className="notif-body">
                    <div className="notif-body-title">
                      <span>{item.title}</span>
                    </div>
                    <p className="notif-body-desc">{item.message}</p>
                    <div className="notif-meta">
                      <span>{formatTime(item.createdAt)}</span>
                      {!item.read && (
                        <button
                          type="button"
                          className="notif-mark-read-btn"
                          onClick={(e) => void handleMarkAsRead(item.notificationId, e)}
                        >
                          Marcar leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="notif-footer">
          <button
            type="button"
            className="notif-footer-link"
            onClick={onClose}
          >
            Cerrar panel
          </button>
        </div>
      </div>
    </>
  )
}
