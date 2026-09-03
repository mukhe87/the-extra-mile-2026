import { currentDayKey, todaysGameSlugs, DAY_LABEL, SCHEDULE, type DayKey } from '../lib/schedule'
import { getGame } from '../games/registry'
import GameCard from '../components/GameCard'
import OverallLeaderboard from '../components/OverallLeaderboard'

const WEEK_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

export default function Home() {
  const day = currentDayKey()
  const slugs = todaysGameSlugs()
  const isEventDay = day !== 'weekend'

  return (
    <div>
      <section className="mb-8 rounded-3xl bg-seven-green p-8 text-white">
        <p className="mb-1 text-sm font-bold uppercase tracking-widest text-white/80">
          {isEventDay ? `${DAY_LABEL[day]} · Game of the Day` : 'See you on the road'}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl">
          Go the <span className="text-seven-orange">Extra</span> Mile
        </h1>
        <p className="mt-2 max-w-xl text-white/85">
          {isEventDay
            ? 'Play today’s games, post your score, and climb the live leaderboard. Games change every day this week.'
            : 'The games run Monday through Friday during Customer Service Week. Check back on a weekday to play.'}
        </p>
      </section>

      {isEventDay ? (
        <section className="mb-12 grid gap-5 sm:grid-cols-2">
          {slugs.map((slug) => {
            const game = getGame(slug)
            return game ? <GameCard key={slug} game={game} /> : null
          })}
        </section>
      ) : null}

      <section className="mb-12">
        <OverallLeaderboard limit={10} />
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl">This week’s lineup</h2>
        <div className="grid gap-3">
          {WEEK_ORDER.map((d) => (
            <div
              key={d}
              className={`rounded-xl border-2 p-4 ${
                d === day ? 'border-seven-orange bg-seven-orange/5' : 'border-seven-dark/10 bg-white'
              }`}
            >
              <p className="mb-1 text-sm font-bold uppercase tracking-wide text-seven-dark/60">
                {DAY_LABEL[d]}
                {d === day && <span className="ml-2 text-seven-orange">• Today</span>}
              </p>
              <p className="text-sm text-seven-dark/80">
                {SCHEDULE[d]
                  .map((s) => getGame(s)?.title ?? s)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
