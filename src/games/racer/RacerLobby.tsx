import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameProps } from '../PlaceholderGame'
import { supabase, supabaseReady } from '../../lib/supabase'
import { getPlayer } from '../../lib/player'
import RacerScene from '../phaser/RacerScene'
import { RACE_GOAL, seedFromCode, type RaceBridge, type RaceMode } from './raceBridge'

type Phase = 'menu' | 'lobby' | 'racing'

function randomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// The Extra Mile Racer lobby: pick Solo or Head-to-Head, then mount the Phaser
// race. In versus mode a Supabase Realtime channel (keyed by a room code)
// carries presence + live progress + finish between the two players. All of
// that lives here; the scene only reads the bridge.
export default function RacerLobby({ onScore }: GameProps) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [mode, setMode] = useState<RaceMode>('solo')
  const [code, setCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [opponents, setOpponents] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const opponentPctRef = useRef(-1)
  const opponentResultRef = useRef<{ points: number } | null>(null)
  const meRef = useRef(Math.random().toString(36).slice(2))

  const player = getPlayer()

  const startRace = useCallback(
    (raceMode: RaceMode, seed: number) => {
      setPhase('racing')
      // Defer so the parent div is mounted.
      setTimeout(() => {
        if (!parentRef.current) return
        const bridge: RaceBridge = {
          seed,
          mode: raceMode,
          goal: RACE_GOAL,
          onProgress: (pct) => {
            if (raceMode === 'versus' && channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'progress',
                payload: { id: meRef.current, pct },
              })
            }
          },
          onFinish: (_elapsedMs, points) => {
            onScore(points)
            if (raceMode === 'versus' && channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'finish',
                payload: { id: meRef.current, points },
              })
            }
          },
          opponentPct: () => opponentPctRef.current,
          opponentResult: () => opponentResultRef.current,
        }
        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: parentRef.current,
          width: 360,
          height: 600,
          backgroundColor: '#101820',
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
          callbacks: { preBoot: (g) => g.registry.set('raceBridge', bridge) },
          scene: [RacerScene],
        })
        gameRef.current = game
      }, 30)
    },
    [onScore],
  )

  // Clean up Phaser + channel on unmount.
  useEffect(() => {
    return () => {
      gameRef.current?.destroy(true)
      if (channelRef.current && supabase) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const joinRoom = useCallback(
    (roomCode: string) => {
      if (!supabase) return
      const ch = supabase.channel(`race:${roomCode}`, {
        config: { presence: { key: meRef.current } },
      })
      ch.on('broadcast', { event: 'progress' }, ({ payload }) => {
        if (payload.id !== meRef.current) opponentPctRef.current = payload.pct
      })
      ch.on('broadcast', { event: 'finish' }, ({ payload }) => {
        if (payload.id !== meRef.current) opponentResultRef.current = { points: payload.points }
      })
      ch.on('presence', { event: 'sync' }, () => {
        const others = Object.keys(ch.presenceState()).filter((k) => k !== meRef.current).length
        setOpponents(others)
      })
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') ch.track({ name: player ? `${player.firstName}` : 'Racer' })
      })
      channelRef.current = ch
    },
    [player],
  )

  const hostVersus = () => {
    if (!supabaseReady) {
      setNotice('Head-to-head needs the live server configured — playing solo instead.')
      setMode('solo')
      startRace('solo', Math.floor(Math.random() * 1e9))
      return
    }
    const c = randomCode()
    setCode(c)
    setMode('versus')
    setPhase('lobby')
    joinRoom(c)
  }

  const joinVersus = () => {
    const c = joinCode.trim().toUpperCase()
    if (c.length < 4) {
      setNotice('Enter the 4-character room code from the other player.')
      return
    }
    if (!supabaseReady) {
      setNotice('Head-to-head needs the live server configured — playing solo instead.')
      startRace('solo', Math.floor(Math.random() * 1e9))
      return
    }
    setCode(c)
    setMode('versus')
    setPhase('lobby')
    joinRoom(c)
  }

  // --- Render ---
  if (phase === 'racing') {
    return (
      <div className="rounded-2xl bg-white p-4 shadow">
        <p className="mb-2 text-center text-xs text-seven-dark/60">
          ← / → or A / D to switch lanes · tap left/right on touch
        </p>
        <div ref={parentRef} className="mx-auto overflow-hidden rounded-xl" style={{ maxWidth: 360 }} />
        <div className="mt-3 text-center">
          <button
            onClick={() => {
              gameRef.current?.destroy(true)
              gameRef.current = null
              opponentPctRef.current = -1
              opponentResultRef.current = null
              setPhase('menu')
            }}
            className="rounded-full bg-seven-orange px-5 py-2 font-bold text-white"
          >
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'lobby') {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="mb-2 font-display text-2xl">Head-to-Head</h3>
        <p className="mb-1 text-seven-dark/70">Share this room code with your opponent:</p>
        <p className="my-3 font-display text-4xl tracking-widest text-seven-orange">{code}</p>
        <p className="mb-6 text-sm text-seven-dark/60">
          {opponents > 0 ? 'Opponent connected ✓' : 'Waiting for opponent to join…'}
        </p>
        <button
          onClick={() => startRace('versus', seedFromCode(code))}
          disabled={opponents === 0}
          className="rounded-full bg-seven-green px-6 py-3 font-bold text-white disabled:opacity-50"
        >
          {opponents > 0 ? 'Start race' : 'Waiting…'}
        </button>
        <p className="mt-3 text-xs text-seven-dark/50">
          Both players tap Start — you each race the same course; fastest time wins.
        </p>
      </div>
    )
  }

  // menu
  return (
    <div className="rounded-2xl bg-white p-8 shadow">
      <h3 className="mb-1 text-center font-display text-2xl">The Extra Mile Racer</h3>
      <p className="mb-6 text-center text-seven-dark/70">
        Dodge the traffic and sprint the strip. Race solo for a high score, or go
        head-to-head with a coworker.
      </p>
      {notice && (
        <p className="mb-4 rounded-lg bg-seven-orange/10 p-3 text-center text-sm text-seven-dark/80">
          {notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => {
            setMode('solo')
            startRace('solo', Math.floor(Math.random() * 1e9))
          }}
          className="rounded-xl bg-seven-orange px-6 py-4 font-bold text-white"
        >
          Solo time trial
        </button>
        <button
          onClick={hostVersus}
          className="rounded-xl bg-seven-green px-6 py-4 font-bold text-white"
        >
          Host head-to-head
        </button>
      </div>
      <div className="mt-6 border-t border-seven-dark/10 pt-6">
        <p className="mb-2 text-sm font-bold">Join a race</p>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="CODE"
            className="w-28 rounded-lg border-2 border-seven-dark/15 px-3 py-2 text-center font-display tracking-widest focus:border-seven-orange focus:outline-none"
          />
          <button onClick={joinVersus} className="rounded-lg bg-seven-dark px-5 py-2 font-bold text-white">
            Join
          </button>
        </div>
      </div>
      {mode === 'versus' && !supabaseReady && (
        <p className="mt-4 text-center text-xs text-seven-dark/50">
          Note: live head-to-head activates once Supabase is configured.
        </p>
      )}
    </div>
  )
}
