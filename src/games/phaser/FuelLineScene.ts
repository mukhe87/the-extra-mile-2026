import Phaser from 'phaser'
import { BRAND } from './PhaserMount'

// Fuel Line — a snake game, Extra Mile skin. Grow the fuel line by collecting
// pumps without crossing yourself or the wall. Score = pumps collected * 10.
type Cell = { x: number; y: number }

export default class FuelLineScene extends Phaser.Scene {
  private cell = 24
  private cols = 20
  private rows = 24
  private top = 24 // score bar height in cells*0 -> px offset
  private snake: Cell[] = []
  private dir: Cell = { x: 1, y: 0 }
  private nextDir: Cell = { x: 1, y: 0 }
  private food: Cell = { x: 5, y: 5 }
  private score = 0
  private alive = true
  private acc = 0
  private stepMs = 130
  private gfx!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text

  constructor() {
    super('fuel-line')
  }

  create() {
    this.snake = [
      { x: 4, y: 8 },
      { x: 3, y: 8 },
      { x: 2, y: 8 },
    ]
    this.dir = { x: 1, y: 0 }
    this.nextDir = { x: 1, y: 0 }
    this.score = 0
    this.alive = true
    this.acc = 0
    this.placeFood()

    this.gfx = this.add.graphics()
    this.scoreText = this.add
      .text(8, 4, 'Fuel: 0', { fontFamily: 'Arial Black', fontSize: '16px', color: '#ffffff' })
      .setDepth(10)

    const kb = this.input.keyboard!
    kb.on('keydown-LEFT', () => this.turn(-1, 0))
    kb.on('keydown-RIGHT', () => this.turn(1, 0))
    kb.on('keydown-UP', () => this.turn(0, -1))
    kb.on('keydown-DOWN', () => this.turn(0, 1))
    kb.on('keydown-A', () => this.turn(-1, 0))
    kb.on('keydown-D', () => this.turn(1, 0))
    kb.on('keydown-W', () => this.turn(0, -1))
    kb.on('keydown-S', () => this.turn(0, 1))

    // Touch: swipe to set direction.
    let sx = 0
    let sy = 0
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sx = p.x
      sy = p.y
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - sx
      const dy = p.y - sy
      if (Math.abs(dx) > Math.abs(dy)) this.turn(Math.sign(dx), 0)
      else this.turn(0, Math.sign(dy))
    })
  }

  private turn(x: number, y: number) {
    // Disallow reversing directly into the neck.
    if (x === -this.dir.x && y === -this.dir.y) return
    if (x !== 0 && y !== 0) return
    this.nextDir = { x, y }
  }

  private placeFood() {
    while (true) {
      const f = {
        x: Phaser.Math.Between(0, this.cols - 1),
        y: Phaser.Math.Between(1, this.rows - 1),
      }
      if (!this.snake.some((s) => s.x === f.x && s.y === f.y)) {
        this.food = f
        return
      }
    }
  }

  update(_t: number, dt: number) {
    if (!this.alive) return
    this.acc += dt
    if (this.acc < this.stepMs) {
      this.draw()
      return
    }
    this.acc = 0
    this.dir = this.nextDir
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y }

    const hitWall = head.x < 0 || head.x >= this.cols || head.y < 1 || head.y >= this.rows
    const hitSelf = this.snake.some((s) => s.x === head.x && s.y === head.y)
    if (hitWall || hitSelf) {
      this.end()
      return
    }

    this.snake.unshift(head)
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10
      this.scoreText.setText(`Fuel: ${this.score}`)
      this.stepMs = Math.max(70, this.stepMs - 2)
      this.placeFood()
    } else {
      this.snake.pop()
    }
    this.draw()
  }

  private draw() {
    const g = this.gfx
    const c = this.cell
    g.clear()
    // playfield
    g.fillStyle(0x0c1116, 1)
    g.fillRect(0, this.top, this.cols * c, (this.rows - 1) * c + c)
    // food (pump)
    g.fillStyle(BRAND.orange, 1)
    g.fillRect(this.food.x * c + 3, this.food.y * c + 3, c - 6, c - 6)
    // snake
    this.snake.forEach((s, i) => {
      g.fillStyle(i === 0 ? BRAND.line : BRAND.green, 1)
      g.fillRect(s.x * c + 1, s.y * c + 1, c - 2, c - 2)
    })
  }

  private end() {
    this.alive = false
    this.add
      .text(this.cols * this.cell * 0.5, 300, `Out of fuel\n${this.score} points`, {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20)
    const onScore = this.registry.get('onScore') as ((n: number) => void) | undefined
    onScore?.(this.score)
  }
}
