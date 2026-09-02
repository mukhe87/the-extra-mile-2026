import Phaser from 'phaser'
import { BRAND, rectTexture } from './PhaserMount'

// Night Shift Defender — a descending-formation shooter. Defend the store from
// a wave that marches side to side and steps down. Clear the wave for the next,
// faster one. If the wave reaches the bottom, the shift is over. Score = each
// enemy cleared * 15, plus a bonus per wave cleared.
export default class NightShiftScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private score = 0
  private wave = 1
  private alive = true
  private dir = 1
  private stepDown = false
  private marchSpeed = 40
  private scoreText!: Phaser.GameObjects.Text
  private lastFire = 0
  private w = 480
  private h = 600

  constructor() {
    super('night-shift')
  }

  create() {
    rectTexture(this, 'defender', 40, 24, BRAND.green)
    rectTexture(this, 'shot', 6, 16, BRAND.line)
    rectTexture(this, 'enemy', 30, 26, BRAND.red)

    this.score = 0
    this.wave = 1
    this.alive = true
    this.marchSpeed = 40

    this.player = this.physics.add.image(this.w / 2, this.h - 40, 'defender')
    this.player.setCollideWorldBounds(true)
    this.bullets = this.physics.add.group()
    this.enemies = this.physics.add.group()

    this.scoreText = this.add.text(8, 4, 'Score: 0', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#ffffff',
    })

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
      ;(b as Phaser.Physics.Arcade.Image).destroy()
      ;(e as Phaser.Physics.Arcade.Image).destroy()
      this.score += 15
      this.scoreText.setText(`Score: ${this.score}`)
      if (this.enemies.countActive() === 0) this.nextWave()
    })

    this.input.keyboard!.on('keydown-SPACE', () => this.fire())
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.alive) this.player.x = Phaser.Math.Clamp(p.x, 20, this.w - 20)
    })
    this.input.on('pointerdown', () => this.fire())

    this.spawnWave()
  }

  private spawnWave() {
    const rows = 3 + Math.min(2, this.wave - 1)
    const cols = 7
    const startX = 60
    const gapX = 52
    const startY = 70
    const gapY = 44
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.enemies.create(startX + c * gapX, startY + r * gapY, 'enemy')
      }
    }
    this.marchSpeed = 40 + (this.wave - 1) * 15
  }

  private nextWave() {
    this.wave += 1
    this.score += 100
    this.scoreText.setText(`Score: ${this.score}`)
    this.spawnWave()
  }

  private fire() {
    if (!this.alive) return
    const now = this.time.now
    if (now - this.lastFire < 260) return
    this.lastFire = now
    const b = this.bullets.create(this.player.x, this.player.y - 18, 'shot') as Phaser.Physics.Arcade.Image
    b.setVelocityY(-460)
  }

  update() {
    if (!this.alive) return
    const cursors = this.input.keyboard!.createCursorKeys()
    const speed = 320
    if (cursors.left?.isDown) this.player.setVelocityX(-speed)
    else if (cursors.right?.isDown) this.player.setVelocityX(speed)
    else this.player.setVelocityX(0)

    this.bullets.getChildren().forEach((b) => {
      const img = b as Phaser.Physics.Arcade.Image
      if (img.y < -20) img.destroy()
    })

    // March the formation: move sideways, step down + reverse at edges.
    const children = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]
    if (children.length === 0) return
    let minX = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const e of children) {
      minX = Math.min(minX, e.x)
      maxX = Math.max(maxX, e.x)
      maxY = Math.max(maxY, e.y)
    }
    const dt = this.game.loop.delta / 1000
    if (this.stepDown) {
      for (const e of children) e.y += 18
      this.dir *= -1
      this.stepDown = false
    } else {
      for (const e of children) e.x += this.dir * this.marchSpeed * dt
      if (maxX > this.w - 24 || minX < 24) this.stepDown = true
    }
    if (maxY > this.h - 70) this.end()
  }

  private end() {
    this.alive = false
    this.physics.pause()
    this.add
      .text(this.w / 2, this.h / 2, `Shift over\n${this.score} points`, {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
    const onScore = this.registry.get('onScore') as ((n: number) => void) | undefined
    onScore?.(this.score)
  }
}
