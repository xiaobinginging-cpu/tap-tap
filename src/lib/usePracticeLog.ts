import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tap-tap-practice-log'

/** Return today's date as a YYYY-MM-DD string (local timezone). */
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadLog(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveLog(dates: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...dates]))
}

export function usePracticeLog() {
  const [dates, setDates] = useState<Set<string>>(loadLog)

  // Persist whenever dates change.
  useEffect(() => {
    saveLog(dates)
  }, [dates])

  /** Record a practice session for today. */
  const checkIn = useCallback(() => {
    toggleDate(todayKey())
  }, [])

  /** Toggle check-in for an arbitrary date (YYYY-MM-DD). */
  const toggleDate = useCallback((key: string) => {
    setDates((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /** Whether today has been checked in. */
  const checkedInToday = dates.has(todayKey())

  return { dates, checkIn, toggleDate, checkedInToday }
}
