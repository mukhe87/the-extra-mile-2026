import Phaser from 'phaser'
import { BRAND, rectTexture } from './PhaserMount'

// Traffic Buster — a fixed shooter. Hold the bottom lane, move left/right, and
// clear descending road hazards before they reach you. 3 lives; a hazard that
// reaches the bottom or hits you costs one. Score = hazards cleared * 10, and
// it speeds up over time.
export default class TrafficBusterScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image
  private bullets!: Phaser.Physics.Arcade.Group
  private hazards!: Phaser.Physics.Arcade.Group
  private score = 0
  private lives = 3
  private alive = true
  private scoreText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private lastFire = 0
  private spawnEvent!: Phaser.Time.TimerEvent
  private fallSpeed = 90
  private w = 480
  private h = 600

  constructor() {
    super('traffic-buster')
  }

  create() {
    rectTexture(this, 'ship', 40, 24, BRAND.green)
    rectTexture(this, 'bullet', 6, 16, BRAND.line)
    rectTexture(this, 'hazard', 34, 34, BRAND.orange)

    this.score = 0
    this.lives = 3
    this.alive = true
    this.fallSpeed = 90

    this.player = this.physics.add.image(this.w / 2, this.h - 40, 'ship')
    this.player.setCollideWorldBounds(true)

    this.bullets = this.physics.add.group()
    this.hazards = this.physics.add.group()

    this.scoreText = this.add.text(8, 4, 'Score: 0', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#ffffff',
    })
    this.livesText = this.add
      .text(this.w - 8, 4, '♥♥♥', { fontFamily: 'Arial Black', fontSize: '16px', color: '#ee1c25' })
      .setOrigin(1, 0)

    this.physics.add.overlap(this.bullets, this.hazards, (b, hz) => {
      ;(b as Phaser.Physics.Arcade.Image).destroy()
      ;(hz as Phaser.Physics.Arcade.Image).destroy()
      this.score += 10
      this.scoreText.setText(`Score: ${this.score}`)
      this.fallSpeed = Math.min(260, this.fallSpeed + 2)
    })

    this.spawnEvent = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => this.spawnHazard(),
    })

    this.input.keyboard!.on('keydown-SPACE', () => this.fire())
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.alive) this.player.x = Phaser.Math.Clamp(p.x, 20, this.w - 20)
    })
    this.input.on('pointerdown', () => this.fire())
  }

  private spawnHazard() {
    if (!this.alive) return
    const x = Phaser.Math.Between(20, this.w - 20)
    const hz = this.hazards.create(x, -20, 'hazard') as Phaser.Physics.Arcade.Image
    hz.setVelocityY(this.fallSpeed)
  }

  private fire() {
    if (!this.alive) return
    const now = this.time.now
    if (now - this.lastFire < 220) return
    this.lastFire = now
    const b = this.bullets.create(this.player.x, this.player.y - 18, 'bullet') as Phaser.Physics.Arcade.Image
    b.setVelocityY(-420)
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
    this.hazards.getChildren().forEach((hz) => {
      const img = hz as Phaser.Physics.Arcade.Image
      if (img.y > this.h + 20) {
        img.destroy()
        this.loseLife()
      } else if (Math.abs(img.x - this.player.x) < 30 && img.y > this.h - 60) {
        img.destroy()
        this.loseLife()
      }
    })
  }

  private loseLife() {
    this.lives -= 1
    this.livesText.setText('♥'.repeat(Math.max(0, this.lives)))
    if (this.lives <= 0) this.end()
  }

  private end() {
    this.alive = false
    this.spawnEvent.remove()
    this.physics.pause()
    this.add
      .text(this.w / 2, this.h / 2, `Game over\n${this.score} points`, {
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
