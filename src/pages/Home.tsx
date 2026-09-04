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
      <section className="mb-8 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="flex flex-col items-center px-6 pt-8 text-center">
          <h1 className="sr-only">The Extra Mile — 7-Eleven Customer Service Week 2026</h1>
          <img
            src="/extra-mile-logo.png"
            alt="The Extra Mile — 7-Eleven Customer Service Week 2026"
            className="w-full max-w-[280px]"
            width={623}
            height={640}
          />
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-seven-green">
            {isEventDay ? `${DAY_LABEL[day]} · Game of the Day` : 'See you on the road'}
          </p>
          <p className="mx-auto mb-8 mt-2 max-w-xl text-seven-dark/70">
            {isEventDay
              ? 'Play today’s games, post your score, and climb the live leaderboard. Games change every day this week.'
              : 'The games run Monday through Friday during Customer Service Week. Check back on a weekday to play.'}
          </p>
        </div>
        <div className="road-strip h-2" />
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
