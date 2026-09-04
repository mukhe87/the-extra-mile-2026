import { Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGame } from '../games/registry'
import { isSlugAvailableToday } from '../lib/schedule'
import { useProfile } from '../lib/profile'
import { isAdmin } from '../lib/admin'
import { submitScore } from '../lib/scores'
import Leaderboard from '../components/Leaderboard'

export default function GamePage() {
  const { slug = '' } = useParams()
  const game = getGame(slug)
  const player = useProfile() // guaranteed by the app-level login gate
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setLastScore(null)
    setStatus('idle')
  }, [slug])

  if (!game) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        <p className="mb-4">That game isn’t part of the event.</p>
        <Link to="/" className="font-bold text-seven-orange">
          ← Back to today’s games
        </Link>
      </div>
    )
  }

  const availableToday = isSlugAvailableToday(slug)

  const handleScore = async (score: number) => {
    setLastScore(score)
    if (!player) return
    try {
      setStatus('saving')
      await submitScore(slug, player, score)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  const Game = game.load

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm font-bold text-seven-orange">
        ← Today’s games
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl">{game.title}</h1>
        <p className="text-seven-dark/70">{game.blurb}</p>
      </div>

      {!availableToday &&
        (isAdmin() ? (
          <div className="mb-6 rounded-xl border-2 border-seven-orange/40 bg-seven-orange/5 p-4 text-sm">
            Admin preview — this game isn’t on today’s public schedule, but you’re opening
            it from the admin panel. Scores you post here count; clear them from the panel’s
            reset when done.
          </div>
        ) : (
          <div className="mb-6 rounded-xl border-2 border-seven-red/40 bg-seven-red/5 p-4 text-sm">
            Heads up — this game isn’t on today’s schedule. You can still try it, but
            it’s featured on its own day.
          </div>
        ))}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <Suspense
            fallback={
              <div className="rounded-2xl bg-white p-8 text-center text-seven-dark/60 shadow">
                Loading game…
              </div>
            }
          >
            <Game
              slug={game.slug}
              title={game.title}
              scoreLabel={game.scoreLabel}
              onScore={handleScore}
            />
          </Suspense>
          {lastScore !== null && (
            <div className="mt-4 rounded-xl bg-white p-4 text-center shadow">
              <p className="font-display text-2xl">
                {lastScore.toLocaleString()}{' '}
                <span className="text-base font-normal text-seven-dark/60">{game.scoreLabel}</span>
              </p>
              <p className="text-sm text-seven-dark/60">
                {status === 'saving' && 'Saving your score…'}
                {status === 'saved' && 'Posted to the leaderboard ✓'}
                {status === 'error' && 'Could not save — check your connection.'}
                {status === 'idle' && 'Score recorded.'}
              </p>
            </div>
          )}
        </div>

        <Leaderboard
          gameSlug={game.slug}
          scoreLabel={game.scoreLabel}
          highlight={
            player
              ? { profileId: player.id, firstName: player.firstName, lastName: player.lastName }
              : undefined
          }
        />
      </div>
    </div>
  )
}
