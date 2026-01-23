import { useCallback } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function useHaptics() {
  const trigger = useCallback((type: HapticType = 'medium') => {
    if (!('vibrate' in navigator)) return;

    const patterns: Record<HapticType, number[]> = {
      light: [10],
      medium: [30],
      heavy: [50, 30, 50],
      success: [20, 50, 20],
      warning: [40, 20, 40],
      error: [100, 50, 100],
    };

    try {
      navigator.vibrate(patterns[type]);
    } catch (e) {
      // Haptics not supported
    }
  }, []);

  const swipe = useCallback(() => trigger('light'), [trigger]);
  const trade = useCallback(() => trigger('success'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);

  return { trigger, swipe, trade, error };
}
