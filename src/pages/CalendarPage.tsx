import { useMemo, useState } from 'react'

interface Props {
  dates: Set<string>
  checkIn: () => void
  toggleDate: (key: string) => void
  checkedInToday: boolean
  onBack: () => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function buildMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarPage({ dates, checkIn, toggleDate, checkedInToday, onBack }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const cells = useMemo(() => buildMonth(year, month), [year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0) }
    else setMonth(month + 1)
  }

  // Stats
  const monthKeys = cells
    .filter((d): d is number => d !== null)
    .map((d) => dateKey(year, month, d))
  const checkedCount = monthKeys.filter((k) => dates.has(k)).length

  const totalDays = dates.size
  const nowKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate())
  const streakDays = (() => {
    let streak = 0
    const d = new Date()
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!dates.has(key)) break
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  })()

  return (
    <div className="h-dvh overflow-auto flex flex-col items-center px-5 text-cedar pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 w-full max-w-md flex items-center justify-between py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-cedar-soft hover:text-cedar transition-colors"
        >
          ← 返回
        </button>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-cedar">
          练习日历
        </h1>
        <div className="w-10" />
      </header>

      {/* Stats */}
      <div className="w-full max-w-md flex gap-3 mb-4">
        <div className="flex-1 rounded-2xl bg-cream-soft border border-cedar/10 p-3 text-center">
          <div className="text-2xl font-bold text-rose">{totalDays}</div>
          <div className="text-xs text-cedar-soft">累计打卡</div>
        </div>
        <div className="flex-1 rounded-2xl bg-cream-soft border border-cedar/10 p-3 text-center">
          <div className="text-2xl font-bold text-rose">{streakDays}</div>
          <div className="text-xs text-cedar-soft">连续打卡</div>
        </div>
        <div className="flex-1 rounded-2xl bg-cream-soft border border-cedar/10 p-3 text-center">
          <div className="text-2xl font-bold text-rose">{checkedCount}</div>
          <div className="text-xs text-cedar-soft">本月打卡</div>
        </div>
      </div>

      {/* Manual check-in */}
      <button
        type="button"
        onClick={checkIn}
        disabled={checkedInToday}
        className={`w-full max-w-md py-3 rounded-full text-base font-serif font-semibold tracking-wide transition-colors ${
          checkedInToday
            ? 'bg-cream-soft border border-cedar/10 text-cedar-soft cursor-default'
            : 'bg-rose text-cream-soft shadow-[0_3px_0_rgba(44,74,110,0.25)] hover:bg-rose-soft hover:text-cedar active:translate-y-[1px]'
        }`}
      >
        {checkedInToday ? '✓ 今日已打卡' : '打卡'}
      </button>

      {/* Month navigation */}
      <div className="w-full max-w-md flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="px-3 py-1 rounded-full text-cedar-soft hover:text-cedar hover:bg-cream-soft transition-colors"
        >
          ‹
        </button>
        <span className="font-serif text-lg font-semibold text-cedar">
          {year} 年 {month + 1} 月
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="px-3 py-1 rounded-full text-cedar-soft hover:text-cedar hover:bg-cream-soft transition-colors"
        >
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="w-full max-w-md bg-cream-soft border border-cedar/10 rounded-2xl p-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs text-cedar-soft py-1"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} />
            const key = dateKey(year, month, day)
            const checked = dates.has(key)
            const isToday = key === nowKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDate(key)}
                className={`
                  relative flex items-center justify-center h-9 rounded-full text-sm transition-colors
                  ${checked ? 'bg-rose text-cream-soft font-semibold' : 'hover:bg-rose-soft/50'}
                  ${isToday && !checked ? 'ring-2 ring-rose/40 font-semibold text-cedar' : ''}
                  ${!checked && !isToday ? 'text-cedar-soft' : ''}
                `}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
