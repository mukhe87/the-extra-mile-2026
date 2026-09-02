import { useState } from 'react'
import { setPlayer } from '../lib/player'

// Blocks scoring until a First + Last name is entered. Both required.
export default function NameGate({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [touched, setTouched] = useState(false)

  const firstOk = first.trim().length > 0
  const lastOk = last.trim().length > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!firstOk || !lastOk) return
    setPlayer({ firstName: first.trim(), lastName: last.trim() })
    onDone()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
      <h2 className="mb-1 font-display text-2xl">Before you play</h2>
      <p className="mb-6 text-sm text-seven-dark/70">
        Enter your name so your scores land on the leaderboard. Both fields are
        required.
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">First name</span>
        <input
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-orange focus:outline-none"
          placeholder="Alex"
        />
        {touched && !firstOk && (
          <span className="mt-1 block text-xs text-seven-red">First name is required.</span>
        )}
      </label>

      <label className="mb-6 block">
        <span className="mb-1 block text-sm font-bold">Last name</span>
        <input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-orange focus:outline-none"
          placeholder="Rivera"
        />
        {touched && !lastOk && (
          <span className="mt-1 block text-xs text-seven-red">Last name is required.</span>
        )}
      </label>

      <button
        type="submit"
        className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow"
      >
        Let&apos;s go
      </button>
    </form>
  )
}
