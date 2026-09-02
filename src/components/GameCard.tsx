import { Link } from 'react-router-dom'
import type { GameMeta } from '../games/registry'

export default function GameCard({ game }: { game: GameMeta }) {
  return (
    <Link
      to={`/play/${game.slug}`}
      className="group flex flex-col rounded-2xl border-2 border-seven-dark/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-seven-orange hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-2">
        {game.mode === 'head-to-head' ? (
          <span className="rounded-full bg-seven-red px-2 py-0.5 text-xs font-bold text-white">
            Head-to-head
          </span>
        ) : (
          <span className="rounded-full bg-seven-green px-2 py-0.5 text-xs font-bold text-white">
            Leaderboard
          </span>
        )}
        {!game.built && (
          <span className="rounded-full bg-seven-dark/10 px-2 py-0.5 text-xs font-bold text-seven-dark/60">
            Preview
          </span>
        )}
      </div>
      <h3 className="mb-1 font-display text-xl">{game.title}</h3>
      <p className="flex-1 text-sm text-seven-dark/70">{game.blurb}</p>
      <span className="mt-4 font-bold text-seven-orange group-hover:underline">Play →</span>
    </Link>
  )
}
