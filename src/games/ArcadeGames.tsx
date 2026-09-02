import PhaserMount from './phaser/PhaserMount'
import type { GameProps } from './PlaceholderGame'
import SnackRunScene from './phaser/SnackRunScene'
import FuelLineScene from './phaser/FuelLineScene'
import CrossInterstateScene from './phaser/CrossInterstateScene'
import TrafficBusterScene from './phaser/TrafficBusterScene'
import NightShiftScene from './phaser/NightShiftScene'

const ARROWS = 'Arrow keys or WASD to move · swipe on touch'
const SHOOTER = 'Arrow keys / drag to move · Space or tap to fire'

export function SnackRun({ onScore }: GameProps) {
  return (
    <PhaserMount scene={SnackRunScene} width={480} height={504} onScore={onScore} controls={ARROWS} />
  )
}

export function FuelLine({ onScore }: GameProps) {
  return (
    <PhaserMount scene={FuelLineScene} width={480} height={600} onScore={onScore} controls={ARROWS} />
  )
}

export function CrossInterstate({ onScore }: GameProps) {
  return (
    <PhaserMount scene={CrossInterstateScene} width={480} height={576} onScore={onScore} controls={ARROWS} />
  )
}

export function TrafficBuster({ onScore }: GameProps) {
  return (
    <PhaserMount scene={TrafficBusterScene} width={480} height={600} onScore={onScore} controls={SHOOTER} />
  )
}

export function NightShiftDefender({ onScore }: GameProps) {
  return (
    <PhaserMount scene={NightShiftScene} width={480} height={600} onScore={onScore} controls={SHOOTER} />
  )
}
