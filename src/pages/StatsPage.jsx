import { useNavigate } from 'react-router-dom'

const StatsPage = () => {
  const navigate = useNavigate()
  return (
    <div className="card">
      <button className="back-link" onClick={() => navigate(-1)}>← חזור</button>
      <h2>📈 סטטיסטיקות אישיות</h2>
      <p className="text-muted mt-2">בקרוב — שלב 11</p>
    </div>
  )
}

export default StatsPage
