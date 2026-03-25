import { createContext, useContext, useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../services/firebase/config'

const TournamentContext = createContext(null)

export const TournamentProvider = ({ children }) => {
  const [activeTournament, setActiveTournament] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  // Listen for all tournaments, pick the active one
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(20))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setTournaments(list)
      const active = list.find((t) => t.status === 'active') || list[0] || null
      setActiveTournament(active)
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <TournamentContext.Provider value={{ activeTournament, tournaments, loading }}>
      {children}
    </TournamentContext.Provider>
  )
}

export const useTournament = () => {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider')
  return ctx
}
