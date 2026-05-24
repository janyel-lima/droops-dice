import { onMounted, onUnmounted } from 'vue';

interface Shortcut {
  keys: string[];
  handler: () => void;
}

export function useShortcutListener(shortcuts: Shortcut[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keysMatch = shortcut.keys.every((key) => {
        if (key === 'Control') return event.ctrlKey;
        if (key === 'Alt') return event.altKey;
        if (key === 'Shift') return event.shiftKey;
        if (key === 'Meta') return event.metaKey;
        return event.key.toLowerCase() === key.toLowerCase();
      });

      if (keysMatch) {
        event.preventDefault();
        shortcut.handler();
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
