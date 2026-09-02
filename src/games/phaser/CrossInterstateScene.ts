import Phaser from 'phaser'
import { BRAND, rectTexture } from './PhaserMount'

// Cross the Interstate — a road-crosser. Hop up through lanes of moving traffic
// to reach the store at the top; each safe crossing scores and resets you to
// the bottom. One collision ends the run. Score = crossings * 100 + near-misses.
export default class CrossInterstateScene extends Phaser.Scene {
  private cell = 48
  private cols = 10
  private rows = 12
  private player!: Phaser.GameObjects.Rectangle
  private cars!: Phaser.Physics.Arcade.Group
  private lanes: { y: number; speed: number; dir: number }[] = []
  private score = 0
  private crossings = 0
  private alive = true
  private scoreText!: Phaser.GameObjects.Text
  private px = 4
  private py = 11

  constructor() {
    super('cross-interstate')
  }

  create() {
    rectTexture(this, 'car', 44, 34, BRAND.orange)
    rectTexture(this, 'truck', 70, 36, BRAND.red)

    const c = this.cell
    // Draw lanes background.
    const g = this.add.graphics()
    for (let r = 0; r < this.rows; r++) {
      const isRoad = r >= 1 && r <= this.rows - 2
      g.fillStyle(r === 0 ? BRAND.green : isRoad ? BRAND.road : 0x0c1116, 1)
      g.fillRect(0, r * c, this.cols * c, c)
    }
    this.add
      .text(this.cols * c * 0.5, c * 0.5, 'STORE — SAFE', {
        fontFamily: 'Arial Black',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // Traffic lanes (rows 1..rows-2).
    this.cars = this.physics.add.group()
    for (let r = 1; r <= this.rows - 2; r++) {
      const dir = r % 2 === 0 ? 1 : -1
      const speed = Phaser.Math.Between(60, 140) + this.crossings * 5
      this.lanes.push({ y: r, speed, dir })
      const count = Phaser.Math.Between(1, 2)
      for (let i = 0; i < count; i++) {
        const isTruck = Math.random() < 0.3
        const car = this.cars.create(
          Phaser.Math.Between(0, this.cols * c),
          r * c + c / 2,
          isTruck ? 'truck' : 'car',
        ) as Phaser.Physics.Arcade.Image
        car.setVelocityX(speed * dir)
        car.setData('dir', dir)
        car.setData('speed', speed)
      }
    }

    this.player = this.add.rectangle(
      this.px * c + c / 2,
      this.py * c + c / 2,
      28,
      28,
      BRAND.line,
    )
    this.physics.add.existing(this.player)

    this.scoreText = this.add
      .text(8, 4, 'Crossings: 0', {
        fontFamily: 'Arial Black',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setDepth(10)

    const kb = this.input.keyboard!
    kb.on('keydown-LEFT', () => this.move(-1, 0))
    kb.on('keydown-RIGHT', () => this.move(1, 0))
    kb.on('keydown-UP', () => this.move(0, -1))
    kb.on('keydown-DOWN', () => this.move(0, 1))
    kb.on('keydown-A', () => this.move(-1, 0))
    kb.on('keydown-D', () => this.move(1, 0))
    kb.on('keydown-W', () => this.move(0, -1))
    kb.on('keydown-S', () => this.move(0, 1))

    // Touch: tap relative to player to move.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dx = p.x - this.player.x
      const dy = p.y - this.player.y
      if (Math.abs(dx) > Math.abs(dy)) this.move(Math.sign(dx), 0)
      else this.move(0, Math.sign(dy))
    })
  }

  private move(dx: number, dy: number) {
    if (!this.alive) return
    this.px = Phaser.Math.Clamp(this.px + dx, 0, this.cols - 1)
    this.py = Phaser.Math.Clamp(this.py + dy, 0, this.rows - 1)
    const c = this.cell
    this.player.setPosition(this.px * c + c / 2, this.py * c + c / 2)
    if (this.py === 0) {
      this.crossings += 1
      this.score += 100
      this.scoreText.setText(`Crossings: ${this.crossings}`)
      this.py = this.rows - 1
      this.player.setPosition(this.px * c + c / 2, this.py * c + c / 2)
    }
  }

  update() {
    if (!this.alive) return
    const c = this.cell
    const w = this.cols * c
    // Wrap cars around and check collision with player's cell.
    this.cars.getChildren().forEach((obj) => {
      const car = obj as Phaser.Physics.Arcade.Image
      const dir = car.getData('dir') as number
      if (dir > 0 && car.x > w + 40) car.x = -40
      if (dir < 0 && car.x < -40) car.x = w + 40
      const sameRow = Math.abs(car.y - this.player.y) < c * 0.5
      const overlapX = Math.abs(car.x - this.player.x) < car.width * 0.5 + 12
      if (sameRow && overlapX) this.end()
    })
  }

  private end() {
    if (!this.alive) return
    this.alive = false
    this.physics.pause()
    this.add
      .text(this.cols * this.cell * 0.5, this.rows * this.cell * 0.5, `Crash!\n${this.score} points`, {
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
