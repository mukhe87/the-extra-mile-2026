import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { getPlayer, clearPlayer, fullName } from '../lib/player'

// The branded shell: Extra Mile header on a road strip, content, footer.
export default function Layout({ children }: { children: ReactNode }) {
  const player = getPlayer()
  return (
    <div className="min-h-screen">
      <header className="bg-seven-dark text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3" aria-label="The Extra Mile — home">
            <img
              src="/extra-mile-logo.png"
              alt="The Extra Mile — 7-Eleven Customer Service Week 2026"
              className="h-12 w-auto sm:h-14"
              width={1238}
              height={1271}
            />
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-xl tracking-wide">
                THE <span className="text-seven-orange">EXTRA</span>{' '}
                <span className="text-seven-red">MILE</span>
              </span>
              <span className="block text-xs uppercase tracking-widest text-white/70">
                Customer Service Week 2026
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {player ? (
              <>
                <span className="hidden sm:inline text-white/80">{fullName(player)}</span>
                <button
                  onClick={() => {
                    clearPlayer()
                    location.reload()
                  }}
                  className="rounded-full border border-white/30 px-3 py-1 hover:bg-white/10"
                >
                  Not you?
                </button>
              </>
            ) : null}
          </nav>
        </div>
        <div className="road-strip h-2" />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

      <footer className="road-strip mt-12 h-2" />
      <div className="bg-seven-dark py-4 text-center text-xs text-white/60">
        Going the Extra Mile · 7-Eleven Customer Service Week 2026
        <Link to="/admin" className="ml-3 text-white/40 hover:text-white/70">
          Admin
        </Link>
      </div>
    </div>
  )
}
