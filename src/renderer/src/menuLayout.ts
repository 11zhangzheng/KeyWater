export type MenuPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type MenuLayout = {
  left: number
  top: number
  maxHeight: number
  placement: MenuPlacement
}

type CalculateMenuLayoutOptions = {
  anchorRect: DOMRect
  menuWidth: number
  menuHeight: number
  viewportWidth: number
  viewportHeight: number
  screenHeight: number
}

const MENU_GAP = 8
const VIEWPORT_MARGIN = 8
const MIN_MENU_HEIGHT = 96
const MAX_MENU_HEIGHT = 320
const MAX_SCREEN_HEIGHT_RATIO = 0.6

export const getMenuMaxHeight = (screenHeight: number, viewportHeight: number) => {
  const screenLimit = Math.floor(Math.min(MAX_MENU_HEIGHT, screenHeight * MAX_SCREEN_HEIGHT_RATIO))
  const viewportLimit = Math.max(MIN_MENU_HEIGHT, viewportHeight - VIEWPORT_MARGIN * 2)
  return Math.min(screenLimit, viewportLimit)
}

export const calculateMenuLayout = ({
  anchorRect,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  screenHeight
}: CalculateMenuLayoutOptions): MenuLayout => {
  const maxHeight = getMenuMaxHeight(screenHeight, viewportHeight)
  const height = Math.min(menuHeight, maxHeight)
  let placement: MenuPlacement = 'top-left'
  let left = anchorRect.left - menuWidth - MENU_GAP
  let top = anchorRect.top - height - MENU_GAP

  if (left < VIEWPORT_MARGIN) {
    left = anchorRect.right + MENU_GAP
    placement = 'top-right'
  }

  if (left + menuWidth > viewportWidth - VIEWPORT_MARGIN) {
    left = viewportWidth - menuWidth - VIEWPORT_MARGIN
  }

  if (top < VIEWPORT_MARGIN) {
    top = anchorRect.bottom + MENU_GAP
    placement = placement === 'top-left' ? 'bottom-left' : 'bottom-right'
  }

  if (top + height > viewportHeight - VIEWPORT_MARGIN) {
    top = Math.max(VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN)
  }

  return {
    left: Math.round(left),
    top: Math.round(top),
    maxHeight,
    placement
  }
}
