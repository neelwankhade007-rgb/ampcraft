import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

const HistoryContext = createContext(null)

const LOCAL_STORAGE_KEY = 'ampcraft_project_history'

export function HistoryProvider({ children }) {
  const [projects, setProjects] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      console.error('Failed to parse history from localStorage:', e)
      return []
    }
  })

  const [activeProjectId, setActiveProjectId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects))
    } catch (e) {
      console.error('Failed to save history to localStorage:', e)
    }
  }, [projects])

  // Get currently active project
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || null
  }, [projects, activeProjectId])

  // Add a new project (with deduplication for same file loaded recently or re-renders)
  const addProject = useCallback((name, duration, sampleRate) => {
    let existingId = null
    setProjects(prev => {
      // If the latest project has the same name and was created within the last 5 seconds, reuse it
      const top = prev[0]
      if (top && top.name === name && Math.abs(top.duration - duration) < 1 && (Date.now() - top.createdTime < 5000)) {
        existingId = top.id
        return prev
      }

      const id = 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
      existingId = id
      const newProj = {
        id,
        name,
        duration,
        sampleRate,
        createdTime: Date.now(),
        lastOpened: Date.now(),
        startSec: 0,
        endSec: duration || 30,
        hasSelection: false,
        stemResult: null,
        backingResult: null,
        isPinned: false,
      }
      return [newProj, ...prev]
    })
    if (existingId) {
      setActiveProjectId(existingId)
    }
    return existingId;
  }, [])

  // Update specific fields of a project
  const updateProject = useCallback((id, fields) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, ...fields }
      }
      return p
    }))
  }, [])

  // Mark project as opened (updates lastOpened timestamp)
  const touchProject = useCallback((id) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, lastOpened: Date.now() }
      }
      return p
    }))
  }, [])

  // Pin / Unpin project
  const togglePinProject = useCallback((id) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, isPinned: !p.isPinned }
      }
      return p
    }))
  }, [])

  // Rename project
  const renameProject = useCallback((id, newName) => {
    if (!newName.trim()) return
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, name: newName.trim() }
      }
      return p
    }))
  }, [])

  // Duplicate project metadata (creates a copy without sharing ID)
  const duplicateProject = useCallback((id) => {
    const orig = projects.find(p => p.id === id)
    if (!orig) return
    const newId = 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    const copy = {
      ...orig,
      id: newId,
      name: `${orig.name} Copy`,
      createdTime: Date.now(),
      lastOpened: Date.now(),
      isPinned: false,
    }
    setProjects(prev => [copy, ...prev])
    return newId
  }, [projects])

  // Delete project from history
  const deleteProject = useCallback((id) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    if (activeProjectId === id) {
      setActiveProjectId(null)
    }
  }, [activeProjectId])

  // Clear all projects from history
  const clearAllProjects = useCallback(() => {
    setProjects([])
    setActiveProjectId(null)
  }, [])

  // Delete cached data (stems and backing track results) but keep metadata
  const clearProjectCache = useCallback((id) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          stemResult: null,
          backingResult: null,
        }
      }
      return p
    }))
  }, [])

  // Sorted and filtered list
  const filteredProjects = useMemo(() => {
    let list = [...projects]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }

    // Sort by Pinned first, then by lastOpened descending
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return b.lastOpened - a.lastOpened
    })

    return list
  }, [projects, searchQuery])

  return (
    <HistoryContext.Provider
      value={{
        projects,
        filteredProjects,
        activeProjectId,
        activeProject,
        searchQuery,
        setSearchQuery,
        setActiveProjectId,
        addProject,
        updateProject,
        touchProject,
        togglePinProject,
        renameProject,
        duplicateProject,
        deleteProject,
        clearAllProjects,
        clearProjectCache,
      }}
    >
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider')
  }
  return context
}
