import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'

// A reusable bridge that mounts one Phaser scene inside React and relays the
// final score back to the app. Every arcade scene reads `onScore` from the
// game registry and calls it exactly once when the run ends; the app then
// submits it to the leaderboard. A "Play again" control remounts a fresh game.
export type ArcadeScene = new () => Phaser.Scene

export default function PhaserMount({
  scene,
  width = 480,
  height = 600,
  onScore,
  controls,
}: {
  scene: ArcadeScene
  width?: number
  height?: number
  onScore: (score: number) => void
  controls?: string
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [runId, setRunId] = useState(0)
  const [lastScore, setLastScore] = useState<number | null>(null)

  useEffect(() => {
    if (!parentRef.current) return
    setLastScore(null)
    const handleScore = (score: number) => {
      setLastScore(score)
      onScore(score)
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      width,
      height,
      backgroundColor: '#101820',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
      physics: { default: 'arcade', arcade: { debug: false } },
      // preBoot runs before any scene, so the score callback is ready in create().
      callbacks: { preBoot: (g) => g.registry.set('onScore', handleScore) },
      scene: [scene],
    })
    return () => {
      game.destroy(true)
    }
    // Remount on Play again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      {controls && (
        <p className="mb-2 text-center text-xs text-seven-dark/60">{controls}</p>
      )}
      <div
        ref={parentRef}
        className="mx-auto overflow-hidden rounded-xl"
        style={{ maxWidth: width }}
      />
      {lastScore !== null && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setRunId((n) => n + 1)}
            className="rounded-full bg-seven-orange px-5 py-2 font-bold text-white"
          >
            Play again
          </button>
        </div>
      )}
    </div>
  )
}

// Small helpers shared by scenes.
export const BRAND = {
  orange: 0xf58220,
  green: 0x008061,
  red: 0xee1c25,
  cream: 0xfff8ee,
  line: 0xf6c700,
  road: 0x1a1a1a,
  dark: 0x101820,
}

/** Draw a solid rounded-ish rectangle texture on the fly (no external assets). */
export function rectTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  color: number,
): void {
  if (scene.textures.exists(key)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(color, 1)
  g.fillRect(0, 0, w, h)
  g.generateTexture(key, w, h)
  g.destroy()
}
