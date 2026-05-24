<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Crown, User, ScrollText, ChevronRight } from 'lucide-vue-next';

const router = useRouter();

const navigateToMaster = () => router.push('/master');
const navigateToPlayer = () => router.push('/player');
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 selection:bg-arcane-500/30">
    <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
      
      <!-- Logo Section (Floating over grid on desktop) -->
      <div class="md:col-span-2 text-center mb-8">
        <div class="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full shadow-sm mb-4">
          <ScrollText class="w-4 h-4 text-arcane-500" />
          <span class="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">Hexatronus System Core v1.1</span>
        </div>
        <h1 class="text-6xl md:text-8xl font-rpg font-black text-neutral-900 dark:text-white tracking-tighter mb-2">DROOP'S DICE</h1>
        <p class="text-sm font-medium text-neutral-400 dark:text-neutral-500 max-w-md mx-auto">Sincronize seu destino com a mesa. Escolha seu caminho no ritual de criação.</p>
      </div>

      <!-- Master Path -->
      <button 
        @click="navigateToMaster"
        class="group relative flex flex-col p-8 bg-white dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-[2.5rem] text-left transition-all hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/10 overflow-hidden"
      >
        <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
          <Crown class="w-32 h-32 text-amber-500" />
        </div>
        
        <div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20 group-hover:scale-110 transition-transform">
          <Crown class="w-6 h-6 text-amber-600" />
        </div>
        
        <h2 class="text-2xl font-black text-neutral-900 dark:text-white mb-2 uppercase tracking-tight">O Mestre</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium mb-8 leading-relaxed">
          Regente do multiverso. Gerencia heróis, valida destinos e controla a balança do poder arcano.
        </p>

        <div class="mt-auto flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest group-hover:gap-4 transition-all">
          Acessar Painel de Controle <ChevronRight class="w-4 h-4" />
        </div>
      </button>

      <!-- Player Path -->
      <button 
        @click="navigateToPlayer"
        class="group relative flex flex-col p-8 bg-neutral-900 dark:bg-white border-2 border-neutral-800 dark:border-neutral-100 rounded-[2.5rem] text-left transition-all hover:shadow-2xl hover:shadow-arcane-500/10 overflow-hidden"
      >
        <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
          <User class="w-32 h-32 text-arcane-500" />
        </div>
        
        <div class="w-14 h-14 rounded-2xl bg-arcane-500/20 dark:bg-arcane-500/10 flex items-center justify-center mb-6 border border-arcane-500/20 group-hover:scale-110 transition-transform">
          <User class="w-6 h-6 text-arcane-500" />
        </div>
        
        <h2 class="text-2xl font-black text-white dark:text-neutral-900 mb-2 uppercase tracking-tight">O Jogador</h2>
        <p class="text-sm text-neutral-400 dark:text-neutral-500 font-medium mb-8 leading-relaxed">
          O herói em ascensão. Inserir código de convite, rolar os dados sagrados e moldar seu herói.
        </p>

        <div class="mt-auto flex items-center gap-2 text-arcane-400 dark:text-arcane-600 font-black text-[10px] uppercase tracking-widest group-hover:gap-4 transition-all">
          Entrar na Campanha <ChevronRight class="w-4 h-4" />
        </div>
      </button>

    </div>

    <!-- Background Decorative Elements -->
    <div class="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-arcane-500/10 blur-[120px] rounded-full"></div>
    </div>
  </div>
</template>

<style scoped>
.font-rpg {
  font-family: 'Outfit', sans-serif;
}
</style>
