// API configuration: allows overriding via VITE_API_BASE_URL
// Falls back to Render deployment OR localhost:8000
export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  'https://ampcraft-backend.onrender.com' || 
  'http://localhost:8000'

