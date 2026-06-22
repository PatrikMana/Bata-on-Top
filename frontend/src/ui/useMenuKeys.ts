import { useCallback, useEffect, useRef, useState } from 'react';

export type MenuKeyItem = {
  id: string;
  disabled?: boolean;
  onActivate: () => void;
};

type MenuKeysLayout = 'vertical' | 'horizontal';

type UseMenuKeysOptions = {
  items: MenuKeyItem[];
  layout?: MenuKeysLayout;
  enabled?: boolean;
  onBack?: () => void;
  onLeaveEnd?: () => void;
  onLeaveStart?: () => void;
  onLeaveDown?: () => void;
};

const MENU_KEYS = {
  up: ['ArrowUp', 'w', 'W'],
  down: ['ArrowDown', 's', 'S'],
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  confirm: [' ', 'Enter'],
  cancel: ['Escape'],
} as const;

function matchesMenuKey(key: string, bindings: readonly string[]) {
  return bindings.includes(key);
}

/**
 * Wires arrow keys, WASD, Space, Enter, and Escape to a focusable menu item list.
 *
 * @param {UseMenuKeysOptions} options Menu items, layout, and optional back handler.
 * @return {{ focusedIndex: number, isFocused: (index: number) => boolean }} Focus state helpers.
 */
export function useMenuKeys({
  items,
  layout = 'vertical',
  enabled = true,
  onBack,
  onLeaveEnd,
  onLeaveStart,
  onLeaveDown,
}: UseMenuKeysOptions) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemsRef = useRef(items);
  const focusedIndexRef = useRef(focusedIndex);
  const maxIndex = Math.max(0, items.length - 1);
  const activeIndex = Math.min(focusedIndex, maxIndex);

  useEffect(() => {
    itemsRef.current = items;
    focusedIndexRef.current = activeIndex;
  }, [activeIndex, items]);

  useEffect(() => {
    if (!enabled || items.length === 0) {
      return;
    }

    function findNextIndex(startIndex: number, delta: number) {
      const currentItems = itemsRef.current;
      let nextIndex = startIndex + delta;

      while (nextIndex >= 0 && nextIndex < currentItems.length) {
        if (!currentItems[nextIndex]?.disabled) {
          return nextIndex;
        }

        nextIndex += delta;
      }

      return startIndex;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }

      const previousKey =
        layout === 'vertical'
          ? matchesMenuKey(event.key, MENU_KEYS.up) || matchesMenuKey(event.key, MENU_KEYS.left)
          : matchesMenuKey(event.key, MENU_KEYS.left) || matchesMenuKey(event.key, MENU_KEYS.up);
      const nextKey =
        layout === 'vertical'
          ? matchesMenuKey(event.key, MENU_KEYS.down) || matchesMenuKey(event.key, MENU_KEYS.right)
          : matchesMenuKey(event.key, MENU_KEYS.right) || matchesMenuKey(event.key, MENU_KEYS.down);

      if (layout === 'horizontal' && onLeaveDown && matchesMenuKey(event.key, MENU_KEYS.down)) {
        event.preventDefault();
        onLeaveDown();
        return;
      }

      if (previousKey) {
        event.preventDefault();
        setFocusedIndex((currentIndex) => {
          const boundedIndex = Math.min(currentIndex, itemsRef.current.length - 1);
          const nextIndex = findNextIndex(boundedIndex, -1);

          if (nextIndex === boundedIndex && onLeaveStart) {
            onLeaveStart();
          }

          return nextIndex;
        });
        return;
      }

      if (nextKey) {
        event.preventDefault();
        setFocusedIndex((currentIndex) => {
          const boundedIndex = Math.min(currentIndex, itemsRef.current.length - 1);
          const nextIndex = findNextIndex(boundedIndex, 1);

          if (nextIndex === boundedIndex && onLeaveEnd) {
            onLeaveEnd();
          }

          return nextIndex;
        });
        return;
      }

      if (matchesMenuKey(event.key, MENU_KEYS.confirm)) {
        event.preventDefault();
        const activeItem = itemsRef.current[focusedIndexRef.current];

        if (activeItem && !activeItem.disabled) {
          activeItem.onActivate();
        }

        return;
      }

      if (matchesMenuKey(event.key, MENU_KEYS.cancel) && onBack) {
        event.preventDefault();
        onBack();
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, items.length, layout, onBack, onLeaveDown, onLeaveEnd, onLeaveStart]);

  const isFocused = useCallback(
    (index: number) => enabled && index === activeIndex,
    [activeIndex, enabled],
  );

  return { focusedIndex: activeIndex, isFocused };
}

/**
 * Builds a className string with the keyboard focus marker when needed.
 *
 * @param {string} baseClassName Base CSS class for the menu item.
 * @param {boolean} isItemFocused Whether the item is currently focused.
 * @return {string} Combined className value.
 */
export function getMenuItemClassName(baseClassName: string, isItemFocused: boolean) {
  return isItemFocused ? `${baseClassName} menu-item-focused` : baseClassName;
}
