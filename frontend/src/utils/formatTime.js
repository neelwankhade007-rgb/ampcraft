// Helper for formatting duration e.g. 75.3 -> "1:15"
export const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
