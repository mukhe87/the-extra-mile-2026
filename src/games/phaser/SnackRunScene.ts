import Phaser from 'phaser'
import { BRAND } from './PhaserMount'

// Snack Run — a maze-muncher. Steer the cart around the store aisles, grab every
// Slurpee cup, and avoid the roaming spills. Clear the board for a big bonus;
// getting caught ends the run. Grid-based movement on a fixed tick.
type Cell = { x: number; y: number }

// 0 = open, 1 = wall/aisle. 15 cols x 15 rows.
const MAZE = [
  '111111111111111',
  '100000010000001',
  '101110010111101',
  '100000000000001',
  '101011111110101',
  '100010000010001',
  '111010111010111',
  '000010101010000',
  '111010101010111',
  '100000101000001',
  '101110000011101',
  '100010111010001',
  '101010000010101',
  '100000010000001',
  '111111111111111',
]

export default class SnackRunScene extends Phaser.Scene {
  private cell = 32
  private cols = 15
  private rows = 15
  private offY = 24
  private grid: number[][] = []
  private pellets = new Set<string>()
  private player: Cell = { x: 1, y: 1 }
  private dir: Cell = { x: 0, y: 0 }
  private nextDir: Cell = { x: 0, y: 0 }
  private enemies: Cell[] = []
  private score = 0
  private total = 0
  private alive = true
  private acc = 0
  private stepMs = 160
  private enemyAcc = 0
  private enemyStepMs = 260
  private gfx!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text

  constructor() {
    super('snack-run')
  }

  create() {
    this.grid = MAZE.map((row) => row.split('').map((ch) => Number(ch)))
    this.pellets.clear()
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === 0) this.pellets.add(`${x},${y}`)
      }
    }
    // Player + enemy starts are open cells; clear their pellets.
    this.player = { x: 1, y: 1 }
    this.pellets.delete('1,1')
    this.enemies = [
      { x: 13, y: 13 },
      { x: 13, y: 1 },
      { x: 1, y: 13 },
    ]
    this.total = this.pellets.size
    this.score = 0
    this.dir = { x: 0, y: 0 }
    this.nextDir = { x: 0, y: 0 }
    this.alive = true

    this.gfx = this.add.graphics()
    this.scoreText = this.add
      .text(8, 4, 'Cups: 0', { fontFamily: 'Arial Black', fontSize: '16px', color: '#ffffff' })
      .setDepth(10)

    const kb = this.input.keyboard!
    kb.on('keydown-LEFT', () => (this.nextDir = { x: -1, y: 0 }))
    kb.on('keydown-RIGHT', () => (this.nextDir = { x: 1, y: 0 }))
    kb.on('keydown-UP', () => (this.nextDir = { x: 0, y: -1 }))
    kb.on('keydown-DOWN', () => (this.nextDir = { x: 0, y: 1 }))
    kb.on('keydown-A', () => (this.nextDir = { x: -1, y: 0 }))
    kb.on('keydown-D', () => (this.nextDir = { x: 1, y: 0 }))
    kb.on('keydown-W', () => (this.nextDir = { x: 0, y: -1 }))
    kb.on('keydown-S', () => (this.nextDir = { x: 0, y: 1 }))

    let sx = 0
    let sy = 0
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sx = p.x
      sy = p.y
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - sx
      const dy = p.y - sy
      if (Math.abs(dx) > Math.abs(dy)) this.nextDir = { x: Math.sign(dx), y: 0 }
      else this.nextDir = { x: 0, y: Math.sign(dy) }
    })
  }

  private open(x: number, y: number) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows && this.grid[y][x] === 0
  }

  update(_t: number, dt: number) {
    if (!this.alive) return
    this.acc += dt
    this.enemyAcc += dt

    if (this.acc >= this.stepMs) {
      this.acc = 0
      if (this.open(this.player.x + this.nextDir.x, this.player.y + this.nextDir.y)) {
        this.dir = this.nextDir
      }
      const nx = this.player.x + this.dir.x
      const ny = this.player.y + this.dir.y
      if (this.open(nx, ny)) {
        this.player = { x: nx, y: ny }
        const key = `${nx},${ny}`
        if (this.pellets.has(key)) {
          this.pellets.delete(key)
          this.score += 10
          this.scoreText.setText(`Cups: ${this.score / 10} / ${this.total}`)
          if (this.pellets.size === 0) return this.win()
        }
      }
    }

    if (this.enemyAcc >= this.enemyStepMs) {
      this.enemyAcc = 0
      this.moveEnemies()
    }

    this.checkCaught()
    this.draw()
  }

  private moveEnemies() {
    this.enemies = this.enemies.map((e) => {
      const options: Cell[] = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ].filter((d) => this.open(e.x + d.x, e.y + d.y))
      if (options.length === 0) return e
      // 60% chase the player, else random — keeps it beatable.
      let choice: Cell
      if (Math.random() < 0.6) {
        options.sort(
          (a, b) =>
            Math.abs(e.x + a.x - this.player.x) + Math.abs(e.y + a.y - this.player.y) -
            (Math.abs(e.x + b.x - this.player.x) + Math.abs(e.y + b.y - this.player.y)),
        )
        choice = options[0]
      } else {
        choice = options[Phaser.Math.Between(0, options.length - 1)]
      }
      return { x: e.x + choice.x, y: e.y + choice.y }
    })
  }

  private checkCaught() {
    if (this.enemies.some((e) => e.x === this.player.x && e.y === this.player.y)) this.end()
  }

  private draw() {
    const g = this.gfx
    const c = this.cell
    g.clear()
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === 1) {
          g.fillStyle(BRAND.green, 1)
          g.fillRect(x * c, y * c + this.offY, c, c)
        }
      }
    }
    g.fillStyle(BRAND.line, 1)
    this.pellets.forEach((key) => {
      const [x, y] = key.split(',').map(Number)
      g.fillCircle(x * c + c / 2, y * c + c / 2 + this.offY, 4)
    })
    g.fillStyle(BRAND.orange, 1)
    g.fillRect(this.player.x * c + 4, this.player.y * c + 4 + this.offY, c - 8, c - 8)
    g.fillStyle(BRAND.red, 1)
    this.enemies.forEach((e) => {
      g.fillRect(e.x * c + 5, e.y * c + 5 + this.offY, c - 10, c - 10)
    })
  }

  private win() {
    this.score += 500
    this.finish('Board cleared!')
  }

  private end() {
    this.finish('Caught!')
  }

  private finish(title: string) {
    if (!this.alive) return
    this.alive = false
    this.draw()
    this.add
      .text(this.cols * this.cell * 0.5, (this.rows * this.cell) / 2 + this.offY, `${title}\n${this.score} points`, {
        fontFamily: 'Arial Black',
        fontSize: '26px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20)
    const onScore = this.registry.get('onScore') as ((n: number) => void) | undefined
    onScore?.(this.score)
  }
}
