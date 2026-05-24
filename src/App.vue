<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useShortcutListener } from '@/composables/useShortcutListener';
import { useDark, useToggle } from '@vueuse/core';
import { Sun, Moon, Sparkles } from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
});
const toggleDark = useToggle(isDark);

// Global shortcuts: Ctrl + Alt + M for Master Panel
useShortcutListener([
  {
    keys: ['Control', 'Alt', 'm'],
    handler: () => {
      router.push('/master');
    }
  }
]);

onMounted(async () => {
  await authStore.init();
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-arcane-500/30 selection:text-arcane-200">
    <!-- Quick Theme Toggle (Optional but helpful) -->
    <button 
      @click="toggleDark()"
      class="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg hover:scale-110 active:scale-95 transition-all group"
    >
      <Sun v-if="isDark" class="w-5 h-5 text-arcane-400 group-hover:rotate-12 transition-transform" />
      <Moon v-else class="w-5 h-5 text-arcane-600 group-hover:-rotate-12 transition-transform" />
    </button>

    <RouterView v-slot="{ Component }">
      <transition
        enter-active-class="transition duration-400 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-105"
        mode="out-in"
      >
        <component :is="Component" />
      </transition>
    </RouterView>
  </div>
</template>

<style>
/* Global styles updated in index.css */
</style>
