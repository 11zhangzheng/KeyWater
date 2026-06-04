import type { Rectangle } from 'electron'
import type { PetSize, PositionPreset, WidgetBounds } from '../shared/types'

type DisplayLike = {
  workArea: Rectangle
}

export const WIDGET_MARGIN = 18

export const PET_SIZES: Record<PetSize, { width: number; height: number }> = {
  small: { width: 180, height: 156 },
  medium: { width: 280, height: 232 },
  large: { width: 380, height: 308 }
}

const MENU_WIDGET_SIZE = {
  width: 340,
  height: 430
}

export const clampNumber = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

export const getDefaultWidgetBounds = (
  workArea: Rectangle,
  width: number,
  height: number,
  margin = WIDGET_MARGIN
): WidgetBounds => ({
  width,
  height,
  x: Math.round(workArea.x + workArea.width - width - margin),
  y: Math.round(workArea.y + workArea.height - height - margin)
})

export const getDisplayForBounds = (
  displays: DisplayLike[],
  fallbackDisplay: DisplayLike,
  bounds: WidgetBounds,
  width = bounds.width,
  height = bounds.height
) => {
  const centerX = bounds.x + width / 2
  const centerY = bounds.y + height / 2

  return (
    displays.find(({ workArea }) => {
      const insideX = centerX >= workArea.x && centerX <= workArea.x + workArea.width
      const insideY = centerY >= workArea.y && centerY <= workArea.y + workArea.height
      return insideX && insideY
    }) ?? fallbackDisplay
  )
}

export const clampWidgetBounds = (
  displays: DisplayLike[],
  fallbackDisplay: DisplayLike,
  bounds: WidgetBounds,
  width: number,
  height: number,
  margin = WIDGET_MARGIN
): WidgetBounds => {
  const { workArea } = getDisplayForBounds(displays, fallbackDisplay, bounds, width, height)
  const minX = workArea.x + margin
  const minY = workArea.y + margin
  const maxX = Math.max(minX, workArea.x + workArea.width - width - margin)
  const maxY = Math.max(minY, workArea.y + workArea.height - height - margin)

  return {
    width,
    height,
    x: Math.round(clampNumber(bounds.x, minX, maxX)),
    y: Math.round(clampNumber(bounds.y, minY, maxY))
  }
}

export const getPositionForPreset = (
  workArea: Rectangle,
  preset: PositionPreset,
  width: number,
  height: number,
  margin = WIDGET_MARGIN
): WidgetBounds => {
  const positions: Record<string, { x: number; y: number }> = {
    'bottom-right': { x: workArea.x + workArea.width - width - margin, y: workArea.y + workArea.height - height - margin },
    'bottom-left': { x: workArea.x + margin, y: workArea.y + workArea.height - height - margin },
    'top-right': { x: workArea.x + workArea.width - width - margin, y: workArea.y + margin },
    'top-left': { x: workArea.x + margin, y: workArea.y + margin }
  }

  const position = positions[preset] ?? positions['bottom-right']
  return { width, height, x: Math.round(position.x), y: Math.round(position.y) }
}

export const getMenuWidgetBounds = (
  displays: DisplayLike[],
  fallbackDisplay: DisplayLike,
  currentBounds: WidgetBounds,
  petSize: PetSize,
  open: boolean,
  margin = WIDGET_MARGIN
): WidgetBounds => {
  const currentRight = currentBounds.x + currentBounds.width
  const currentBottom = currentBounds.y + currentBounds.height
  const { workArea } = getDisplayForBounds(displays, fallbackDisplay, currentBounds)
  const baseSize = PET_SIZES[petSize]
  const targetSize = open
    ? {
        width: Math.min(MENU_WIDGET_SIZE.width, Math.max(baseSize.width, workArea.width - margin * 2)),
        height: Math.min(MENU_WIDGET_SIZE.height, Math.max(baseSize.height, workArea.height - margin * 2))
      }
    : baseSize

  const minX = workArea.x + margin
  const minY = workArea.y + margin
  const maxX = Math.max(minX, workArea.x + workArea.width - targetSize.width - margin)
  const maxY = Math.max(minY, workArea.y + workArea.height - targetSize.height - margin)

  return {
    width: targetSize.width,
    height: targetSize.height,
    x: Math.round(clampNumber(currentRight - targetSize.width, minX, maxX)),
    y: Math.round(clampNumber(currentBottom - targetSize.height, minY, maxY))
  }
}
