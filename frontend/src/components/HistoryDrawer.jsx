import React, { useRef, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Search, Pin, Trash2, Edit3, Copy, RefreshCw, 
  MoreVertical, Music2, Calendar, Clock
} from 'lucide-react'
import { useHistory } from '../context/HistoryContext'
import { formatTime } from '../utils/formatTime'

// Time helper to show relative time (e.g., "12 mins ago")
function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp
  const secs = Math.floor(diff / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (secs < 60) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function HistoryDrawer({ isOpen, onClose, onSelectProject }) {
  const {
    projects,
    filteredProjects,
    activeProjectId,
    searchQuery,
    setSearchQuery,
    togglePinProject,
    renameProject,
    duplicateProject,
    deleteProject,
    clearAllProjects,
    clearProjectCache
  } = useHistory()

  const drawerRef = useRef(null)
  const searchInputRef = useRef(null)

  // State to track which project card has its context menu open
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      // Focus search input when drawer opens
      setTimeout(() => searchInputRef.current?.focus(), 150)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Close context menu when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Start editing name
  const handleStartRename = (e, project) => {
    e.stopPropagation()
    setEditingId(project.id)
    setEditName(project.name)
    setActiveMenuId(null)
  }

  // Save renamed name
  const handleSaveRename = (id) => {
    renameProject(id, editName)
    setEditingId(null)
  }

  // Handle context menu click
  const toggleMenu = (e, id) => {
    e.stopPropagation()
    setActiveMenuId(prev => prev === id ? null : id)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sliding Drawer Container */}
          <motion.div
            ref={drawerRef}
            className="drawer-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            aria-modal="true"
            role="dialog"
            aria-label="Project History"
          >
            {/* Header */}
            <div className="drawer-header">
              <div className="drawer-title-row">
                <div className="drawer-title-group">
                  <h3>Studio Projects</h3>
                  {projects.length > 0 && (
                    <span className="drawer-count-badge">{projects.length}</span>
                  )}
                </div>
                <div className="drawer-header-actions">
                  {projects.length > 0 && (
                    confirmClearAll ? (
                      <div className="clear-confirm-group">
                        <button
                          className="btn-confirm-clear"
                          onClick={() => {
                            clearAllProjects()
                            setConfirmClearAll(false)
                          }}
                        >
                          Clear All
                        </button>
                        <button
                          className="btn-cancel-clear"
                          onClick={() => setConfirmClearAll(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-clear-history"
                        onClick={() => setConfirmClearAll(true)}
                        title="Clear all history"
                      >
                        Clear History
                      </button>
                    )
                  )}
                  <button 
                    className="btn-close-drawer" 
                    onClick={onClose}
                    aria-label="Close History"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="drawer-search-container">
                <Search size={14} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="drawer-search-input"
                />
                {searchQuery && (
                  <button 
                    className="search-clear-btn" 
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear Search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* List Content */}
            <div className="drawer-content-scrollable">
              {filteredProjects.length === 0 ? (
                /* Empty state */
                <div className="drawer-empty-state">
                  <span className="empty-icon" role="img" aria-label="Music Note">🎵</span>
                  <h4>No songs yet</h4>
                  <p>Upload your first song to begin.</p>
                </div>
              ) : (
                <div className="drawer-project-list">
                  {filteredProjects.map((project) => {
                    const isActive = project.id === activeProjectId
                    const isEditing = project.id === editingId
                    const relativeTime = formatRelativeTime(project.lastOpened)

                    // Deterministic thumbnail waveform
                    const thumbnailBars = (() => {
                      let seed = 0
                      const name = project.name
                      for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i)
                      const rng = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }
                      return Array.from({ length: 15 }, (_, i) => Math.round(5 + rng(seed + i * 9.2) * 20))
                    })()

                    return (
                      <motion.div
                        key={project.id}
                        layoutId={`proj-card-${project.id}`}
                        onClick={() => {
                          if (isEditing) return
                          onSelectProject(project.id)
                          onClose()
                        }}
                        className={`project-card-item ${isActive ? 'active' : ''} ${project.isPinned ? 'pinned' : ''}`}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {/* Pinned Indicator / Icon */}
                        {project.isPinned && (
                          <div className="pinned-badge-icon" title="Pinned Project">
                            <Pin size={10} className="pin-filled" />
                          </div>
                        )}

                        <div className="project-card-body">
                          {/* Title block */}
                          <div className="project-card-title-row">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => handleSaveRename(project.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(project.id)
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="rename-input"
                                autoFocus
                              />
                            ) : (
                              <span className="project-name-text" title={project.name}>
                                {project.name}
                              </span>
                            )}

                            {/* Card Action Controls */}
                            <div className="card-actions-group">
                              {/* Direct Remove Cross Button */}
                              <button
                                className="btn-remove-project"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteProject(project.id)
                                }}
                                aria-label="Remove from history"
                                title="Remove from history"
                              >
                                <X size={13} />
                              </button>

                              {/* Menu Trigger */}
                              <div className="context-menu-wrapper">
                                <button
                                  className="btn-context-menu"
                                  onClick={(e) => toggleMenu(e, project.id)}
                                  aria-label="Project actions"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                  {activeMenuId === project.id && (
                                    <motion.div
                                      className="context-dropdown"
                                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                      transition={{ duration: 0.12 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button onClick={(e) => { togglePinProject(project.id); setActiveMenuId(null); }}>
                                        <Pin size={12} />
                                        {project.isPinned ? 'Unpin' : 'Pin to top'}
                                      </button>
                                      <button onClick={(e) => handleStartRename(e, project)}>
                                        <Edit3 size={12} />
                                        Rename
                                      </button>
                                      <button onClick={() => { duplicateProject(project.id); setActiveMenuId(null); }}>
                                        <Copy size={12} />
                                        Duplicate metadata
                                      </button>
                                      <button onClick={() => { clearProjectCache(project.id); setActiveMenuId(null); }} className="warning-item">
                                        <RefreshCw size={12} />
                                        Delete cached data
                                      </button>
                                      <button onClick={() => { deleteProject(project.id); setActiveMenuId(null); }} className="danger-item">
                                        <X size={12} />
                                        Remove from history
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>

                          {/* Stats Info */}
                          <div className="project-card-meta-row">
                            <span className="meta-info-item">
                              <Clock size={11} />
                              {formatTime(project.duration)}
                            </span>
                            <span className="meta-info-item">
                              <Calendar size={11} />
                              {relativeTime}
                            </span>
                          </div>

                          {/* Thumbnail Waveform & Badges */}
                          <div className="project-card-footer">
                            {/* Tiny waveform thumbnail */}
                            <div className="tiny-waveform">
                              {thumbnailBars.map((h, idx) => (
                                <div 
                                  key={idx} 
                                  className="tiny-bar" 
                                  style={{ height: `${h}px` }} 
                                />
                              ))}
                            </div>

                            {/* Completed modules Badges */}
                            <div className="project-badges">
                              {project.stemResult && (
                                <span className="p-badge stems-badge">Stems</span>
                              )}
                              {project.backingResult && (
                                <span className="p-badge backing-badge">Backing</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
