import Phaser from 'phaser'
import { BRAND } from './PhaserMount'
import { mulberry32, racePoints, type RaceBridge } from '../racer/raceBridge'

// The Extra Mile Racer — a 3-lane sprint down the strip. The car auto-advances;
// you steer between lanes to dodge traffic. A crash costs a brief stop (so
// everyone finishes). Reach the goal distance to finish; faster = more points.
// Obstacles come from a seeded PRNG so a shared room code gives both racers the
// same course. Live opponent progress is drawn from the bridge.
type Obstacle = { dist: number; lane: number; hit: boolean }

export default class RacerScene extends Phaser.Scene {
  private lanes = 3
  private w = 360
  private h = 600
  private laneW = 120
  private playerLane = 1
  private dist = 0
  private speed = 300 // units/sec
  private baseSpeed = 300
  private goal = 4000
  private obstacles: Obstacle[] = []
  private crashUntil = 0
  private started = false
  private startAt = 0
  private finished = false
  private gfx!: Phaser.GameObjects.Graphics
  private hud!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  private bridge!: RaceBridge
  private lastProgressSent = 0
  private countdown = 3

  constructor() {
    super('racer')
  }

  create() {
    this.bridge = this.registry.get('raceBridge') as RaceBridge
    this.goal = this.bridge.goal
    this.buildCourse()

    this.gfx = this.add.graphics()
    this.hud = this.add
      .text(8, 8, '', { fontFamily: 'Arial Black', fontSize: '14px', color: '#ffffff' })
      .setDepth(10)
    this.banner = this.add
      .text(this.w / 2, this.h / 2, '', {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20)

    const steer = (d: number) => {
      if (!this.started || this.finished) return
      this.playerLane = Phaser.Math.Clamp(this.playerLane + d, 0, this.lanes - 1)
    }
    const kb = this.input.keyboard!
    kb.on('keydown-LEFT', () => steer(-1))
    kb.on('keydown-RIGHT', () => steer(1))
    kb.on('keydown-A', () => steer(-1))
    kb.on('keydown-D', () => steer(1))
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      steer(p.x < this.w / 2 ? -1 : 1)
    })

    // Countdown, then go.
    this.banner.setText('3')
    this.time.addEvent({
      delay: 1000,
      repeat: 3,
      callback: () => {
        this.countdown -= 1
        if (this.countdown > 0) this.banner.setText(String(this.countdown))
        else if (this.countdown === 0) this.banner.setText('GO!')
        else {
          this.banner.setText('')
          this.started = true
          this.startAt = this.time.now
        }
      },
    })
  }

  private buildCourse() {
    const rand = mulberry32(this.bridge.seed)
    // Space obstacles from ~400 units in to just before the goal.
    let d = 400
    while (d < this.goal - 200) {
      const lane = Math.floor(rand() * this.lanes)
      this.obstacles.push({ dist: d, lane, hit: false })
      d += 220 + Math.floor(rand() * 260)
    }
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000
    if (this.started && !this.finished) {
      const now = this.time.now
      const stopped = now < this.crashUntil
      this.speed = stopped ? 0 : this.baseSpeed
      this.dist += this.speed * dt

      // Collision: an obstacle within the player's band and lane.
      for (const o of this.obstacles) {
        if (o.hit) continue
        if (Math.abs(o.dist - this.dist) < 30 && o.lane === this.playerLane) {
          o.hit = true
          this.crashUntil = now + 700
          this.cameras.main.shake(200, 0.01)
        }
      }

      // Progress to the bridge (throttled).
      const pct = Math.min(1, this.dist / this.goal)
      if (now - this.lastProgressSent > 150) {
        this.lastProgressSent = now
        this.bridge.onProgress(pct)
      }

      if (this.dist >= this.goal) this.finish()
    }
    this.draw()
  }

  private finish() {
    this.finished = true
    const elapsed = this.time.now - this.startAt
    const pts = racePoints(elapsed)
    this.bridge.onProgress(1)
    this.bridge.onFinish(elapsed, pts)
    const secs = (elapsed / 1000).toFixed(2)
    this.showResultBanner(secs, pts)
  }

  private showResultBanner(secs: string, pts: number) {
    if (this.bridge.mode === 'solo') {
      this.banner.setText(`Finish!\n${secs}s · ${pts} pts`)
      return
    }
    const opp = this.bridge.opponentResult()
    if (opp) {
      this.banner.setText(pts >= opp.points ? `You win!\n${secs}s` : `Opponent wins\n${secs}s`)
    } else {
      this.banner.setText(`Finished ${secs}s\nWaiting on opponent…`)
    }
  }

  private draw() {
    const g = this.gfx
    g.clear()
    // Road
    g.fillStyle(BRAND.road, 1)
    g.fillRect(0, 0, this.w, this.h)
    // Lane dashes scrolling with distance
    g.fillStyle(BRAND.line, 1)
    for (let l = 1; l < this.lanes; l++) {
      const x = l * this.laneW
      const offset = (this.dist % 40)
      for (let y = -40 + offset; y < this.h; y += 40) {
        g.fillRect(x - 2, y, 4, 22)
      }
    }
    // Obstacles near the player's view window
    const viewAhead = 620
    for (const o of this.obstacles) {
      const rel = o.dist - this.dist
      if (rel < -40 || rel > viewAhead) continue
      const y = this.h - 90 - rel
      const x = o.lane * this.laneW + this.laneW / 2
      g.fillStyle(o.hit ? 0x555555 : BRAND.red, 1)
      g.fillRect(x - 22, y - 16, 44, 32)
    }
    // Player car
    const px = this.playerLane * this.laneW + this.laneW / 2
    g.fillStyle(this.time.now < this.crashUntil ? 0xffffff : BRAND.orange, 1)
    g.fillRect(px - 20, this.h - 90 - 16, 40, 40)

    // HUD + progress bars
    const myPct = Math.min(1, this.dist / this.goal)
    this.hud.setText(`Distance ${Math.round(myPct * 100)}%`)
    // My bar
    g.fillStyle(0x000000, 0.4)
    g.fillRect(8, 30, this.w - 16, 10)
    g.fillStyle(BRAND.orange, 1)
    g.fillRect(8, 30, (this.w - 16) * myPct, 10)
    // Opponent bar (versus only)
    if (this.bridge.mode === 'versus') {
      const opp = this.bridge.opponentPct()
      g.fillStyle(0x000000, 0.4)
      g.fillRect(8, 44, this.w - 16, 8)
      if (opp >= 0) {
        g.fillStyle(BRAND.green, 1)
        g.fillRect(8, 44, (this.w - 16) * Math.min(1, opp), 8)
      }
      // If we already finished and the opponent result just arrived, resolve.
      if (this.finished && this.banner.text.includes('Waiting')) {
        const r = this.bridge.opponentResult()
        if (r) {
          const elapsed = this.time.now - this.startAt
          const mine = racePoints(elapsed)
          this.banner.setText(mine >= r.points ? 'You win!' : 'Opponent wins')
        }
      }
    }
  }
}
