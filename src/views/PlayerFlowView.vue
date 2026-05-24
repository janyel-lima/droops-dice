<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCharacterStore } from '@/stores/character';
import { useAuthStore } from '@/stores/auth';
import { CharacterStatus, type StatType, type CharacterAttributes } from '@/types';
import { 
  roll4d6DropLowest, 
  BASE_RACES, 
  calculateModifier, 
  getStatTier, 
  getContextualFeedback,
  getModifierString,
  STAT_LABELS,
  type RollResult
} from '@/utils/dndRules';
import { 
  Dices, 
  User, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw, 
  Lock,
  ArrowRightLeft,
  AlertCircle,
  RefreshCw,
  Sparkle,
  ScrollText,
  Home,
  Plus,
  WifiOff,
  Fingerprint,
  LogIn,
  LogOut,
  Search,
  Flame,
  Zap,
  Moon,
  Component,
  Ghost,
  ShieldCheck
} from 'lucide-vue-next';
import { db } from '@/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Race } from '@/types';

const route = useRoute();
const router = useRouter();
const charStore = useCharacterStore();
const authStore = useAuthStore();

const code = ref((route.params.code as string) || '');
const name = ref('');
const raceId = ref('');
const searchingCode = ref(false);
const showLoginPrompt = ref(false);
const authError = ref('');

// Sync raceId from character store
watch(() => charStore.currentCharacter?.raceId, (newId) => {
  if (newId) raceId.value = newId;
}, { immediate: true });

const rolling = ref(false);
const tempRollResults = ref<RollResult[]>([]);
const rerollUsed = ref(false);
const choiceSelections = ref<StatType[]>([]);
const raceSearch = ref('');
const races = ref<Race[]>([]);
const raceCurrentPage = ref(1);
const racePageSize = 6;

const selectedRace = computed(() => races.value.find(r => r.id === raceId.value) || BASE_RACES.find(r => r.id === raceId.value));

// Reset choices when race changes
watch(raceId, () => {
  choiceSelections.value = [];
});

const filteredRaces = computed(() => {
  const availableRaces = races.value.length > 0 ? races.value : BASE_RACES;
  
  return availableRaces
    .filter(r => (r as any).isActive !== false) // Only active
    .filter(r => r.name.toLowerCase().includes(raceSearch.value.toLowerCase()));
});

const groupedRaces = computed(() => {
  const groups: Record<string, Race[]> = {};

  const start = (raceCurrentPage.value - 1) * racePageSize;
  const paginated = filteredRaces.value.slice(start, start + racePageSize);

  const parentLabels: Record<string, string> = {
    'dwarf': 'Anão',
    'elf': 'Elfo',
    'gnome': 'Gnomo',
    'halfling': 'Pequenino',
    'tiefling': 'Tiefling',
    'genasi': 'Genasi',
    'aasimar': 'Aasimar',
    'gith': 'Gith'
  };

  paginated.forEach(r => {
    let group = 'Outros';
    if (r.parentId && parentLabels[r.parentId]) {
      group = parentLabels[r.parentId];
    } else if (!r.parentId && ['human', 'human_variant', 'dragonborn', 'half_elf', 'half_orc'].includes(r.id)) {
      group = 'Essenciais';
    }
    
    if (!groups[group]) groups[group] = [];
    groups[group].push(r);
  });

  return groups;
});

const raceTotalPages = computed(() => Math.ceil(filteredRaces.value.length / racePageSize));

watch(raceSearch, () => {
  raceCurrentPage.value = 1;
});

onMounted(async () => {
  charStore.clearCharacter();
  // Sync Races from Firestore
  onSnapshot(collection(db, 'races'), (snapshot) => {
    if (!snapshot.empty) {
      races.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Race));
    } else {
      races.value = BASE_RACES.map(r => ({ ...r, isActive: true }));
    }
  }, (err) => {
    console.error('Failed to fetch races:', err);
    races.value = BASE_RACES.map(r => ({ ...r, isActive: true }));
  });

  if (code.value) {
    handleSearchCode();
  }
});

const handleSearchCode = async () => {
  if (!code.value) return;
  searchingCode.value = true;
  authError.value = '';
  
  try {
    await charStore.fetchCharacterByCode(code.value);
    
    if (charStore.currentCharacter) {
      // If character exists
      if (!charStore.currentCharacter.userId) {
        // Orphan character -> claim automatically if logged in
        if (authStore.user) {
          await charStore.claimCharacter(code.value);
        } else {
          showLoginPrompt.value = true;
        }
      } else {
        // Already claimed
        if (authStore.user && charStore.currentCharacter.userId !== authStore.user.uid) {
          authError.value = 'Este código já pertence a outro aventureiro na Forja.';
          charStore.clearCharacter();
        } else if (!authStore.user) {
          // If not logged in but character is claimed, we need to log in to see it
          showLoginPrompt.value = true;
        }
      }
    }
  } finally {
    searchingCode.value = false;
  }
};

const handleLoginAndClaim = async () => {
  try {
    await authStore.loginWithGoogle();
    if (authStore.user && code.value) {
      await handleSearchCode();
    }
  } catch (err) {
    console.error('Login failed:', err);
  }
};

const handleCreate = async () => {
  if (!name.value || !raceId.value) return;
  await charStore.createCharacter({ name: name.value, raceId: raceId.value, code: code.value });
};

const performRolls = async () => {
  rolling.value = true;
  tempRollResults.value = [];
  
  // Simulated delay for effect
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 400));
    let roll = roll4d6DropLowest();
    
    // Boon of Outer Realms: Force minimum of 10 if active
    // Balanced: If current total is already very high (> 75), stop forcing high minimums to avoid 'super stats'
    const currentSum = tempRollResults.value.reduce((acc, r) => acc + r.total, 0);
    
    if (boonActive.value && currentSum < 76) {
      while (roll.total < 10) {
        roll = roll4d6DropLowest();
      }
    }
    
    tempRollResults.value.push(roll);
  }
  
  rolling.value = false;
  
  // Persist as draft to prevent refresh-reroll
  await charStore.saveDraftRolls(
    tempRollResults.value.map(r => r.total),
    tempRollResults.value,
    rerollUsed.value
  );
};

const rerollWorst = async () => {
  if (rerollUsed.value) return;
  const totals = tempRollResults.value.map(r => r.total);
  const minVal = Math.min(...totals);
  const index = totals.indexOf(minVal);
  
  let newRoll = roll4d6DropLowest();
  const currentSumWithoutThisOne = tempRollResults.value.reduce((acc, r, i) => i === index ? acc : acc + r.total, 0);

  if (boonActive.value && currentSumWithoutThisOne < 76) {
    while (newRoll.total < 10) {
      newRoll = roll4d6DropLowest();
    }
  }
  
  tempRollResults.value[index] = newRoll;
  rerollUsed.value = true;

  // Persist as draft
  await charStore.saveDraftRolls(
    tempRollResults.value.map(r => r.total),
    tempRollResults.value,
    rerollUsed.value
  );
};

const confirmRolls = async () => {
  const finalRolls = tempRollResults.value.map(r => r.total);
  await charStore.saveRolls(finalRolls, tempRollResults.value, rerollUsed.value);
};

// Distribution Logic
const distribution = ref<Partial<Record<StatType, number>>>({});
const availableValues = computed(() => {
  if (!charStore.currentCharacter?.rolls) return [];
  const raw = [...charStore.currentCharacter.rolls.raw];
  // Filter out values already used in distribution
  const usedValues = Object.values(distribution.value);
  usedValues.forEach(val => {
    const idx = raw.indexOf(val);
    if (idx > -1) raw.splice(idx, 1);
  });
  return raw;
});

const stats: StatType[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const selectValue = (stat: StatType, val: number) => {
  distribution.value[stat] = val;
};

const removeValue = (stat: StatType) => {
  delete distribution.value[stat];
};

const finalAttributes = computed(() => {
  const result: any = {};
  const raceBonuses = { ...(selectedRace.value?.bonuses || {}) };
  
  // Apply choice bonuses
  if (selectedRace.value?.choiceCount) {
    choiceSelections.value.forEach(stat => {
      raceBonuses[stat] = (raceBonuses[stat] || 0) + (selectedRace.value?.choiceBonus || 1);
    });
  }
  
  stats.forEach(s => {
    const base = distribution.value[s] || 0;
    const bonus = raceBonuses[s] || 0;
    result[s] = base + bonus;
  });
  
  return result as CharacterAttributes;
});

const canFinalize = computed(() => {
  const distributionDone = stats.every(s => distribution.value[s] !== undefined);
  const choicesDone = !selectedRace.value?.choiceCount || choiceSelections.value.length === selectedRace.value.choiceCount;
  return distributionDone && choicesDone;
});

const finalizeDraft = async () => {
  if (!canFinalize.value) return;
  await charStore.saveAttributes(finalAttributes.value);
};

const totalSum = computed(() => {
  return tempRollResults.value.reduce((a, b) => a + b.total, 0);
});

// --- EASTER EGG: BOON OF OUTER REALMS ---
const boonActive = ref(false);
const boonVisible = ref(false);
const keyboardBuffer = ref('');
const sequence = 'DROOP';

const handleKeydown = (e: KeyboardEvent) => {
  keyboardBuffer.value += e.key.toUpperCase();
  if (keyboardBuffer.value.length > 10) keyboardBuffer.value = keyboardBuffer.value.slice(-10);
  
  if (keyboardBuffer.value.endsWith(sequence)) {
    boonVisible.value = true;
    keyboardBuffer.value = '';
    // Optional: add a small sound or effect if possible, but keeping it subtle
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

// Sync draft rolls if they exist (protection against refresh)
watch(() => charStore.currentCharacter, (char) => {
  if (char?.status === CharacterStatus.UTILIZADO && char.draftRolls && tempRollResults.value.length === 0 && !rolling.value) {
    tempRollResults.value = char.draftRolls.details || [];
    rerollUsed.value = char.draftRolls.rerollUsed;
  }
}, { immediate: true });

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
// ----------------------------------------
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-500 font-sans p-4 md:p-8 flex flex-col items-center text-neutral-900 dark:text-neutral-100">
    <!-- Header -->
    <header class="w-full max-w-4xl flex items-center justify-between mb-12">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-arcane-500/10 border border-arcane-500/20 rounded-xl">
          <Dices class="w-6 h-6 text-arcane-600 dark:text-arcane-400" />
        </div>
        <div>
          <h2 class="text-xl font-display font-black text-neutral-900 dark:text-white uppercase tracking-tight italic">Droop's Dice</h2>
          <p class="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{{ charStore.currentCharacter?.code || 'Iniciando Sessão...' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div v-if="authStore.user" class="hidden sm:flex items-center gap-3 px-4 py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
          <img :src="authStore.user.photoURL || ''" class="w-6 h-6 rounded-full border border-arcane-500/20" />
          <div class="flex flex-col">
            <span class="text-[9px] font-black text-neutral-900 dark:text-white uppercase leading-none">{{ authStore.user.displayName }}</span>
            <span class="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">{{ authStore.user.email }}</span>
          </div>
          <button @click="authStore.logout()" class="ml-2 p-1.5 text-neutral-400 hover:text-red-500 transition-colors" title="Sair">
            <LogOut class="w-3.5 h-3.5" />
          </button>
        </div>
        <button v-else @click="authStore.loginWithGoogle()" class="px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:text-arcane-500 transition-all shadow-sm flex items-center gap-2">
          <LogIn class="w-3.5 h-3.5" />
          Entrar
        </button>
        
        <button @click="router.push('/')" class="p-3 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
          <Home class="w-5 h-5" />
        </button>
      </div>
    </header>

    <main class="w-full max-w-4xl relative">
      <div v-if="charStore.loading" class="flex flex-col items-center justify-center py-32 space-y-6">
        <RotateCcw class="w-12 h-12 text-arcane-500 animate-spin" />
        <p class="text-neutral-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Sincronizando com o Multiverso...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="charStore.error" class="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-start gap-4">
        <AlertCircle class="w-6 h-6 text-red-500 shrink-0" />
        <div class="space-y-1">
          <h3 class="font-bold text-red-500">Erro na Conexão</h3>
          <p class="text-sm text-red-400/80">{{ charStore.error }}</p>
          <button @click="router.push('/')" class="mt-4 text-xs font-bold uppercase tracking-widest text-white underline underline-offset-4">Voltar ao Início</button>
        </div>
      </div>

      <!-- Step 0: Initial Code Entry -->
      <div v-if="!charStore.currentCharacter" class="flex flex-col items-center justify-center py-20 space-y-8 text-center max-w-sm mx-auto animate-in fade-in zoom-in-95 duration-700">
        <div class="p-8 bg-arcane-500/10 rounded-[3rem] border border-arcane-500/20">
          <Fingerprint class="w-12 h-12 text-arcane-600 dark:text-arcane-400" />
        </div>
        <div class="space-y-4">
          <h2 class="text-3xl font-display font-black text-neutral-900 dark:text-white uppercase tracking-tighter italic">CÓDIGO DE CONVITE</h2>
          <p class="text-neutral-500 dark:text-neutral-400">Insira o glifo arcano gerado pelo seu Mestre para manifestar seu herói.</p>
        </div>
        
        <div class="w-full space-y-4">
          <div class="relative">
            <input 
              v-model="code"
              @keyup.enter="handleSearchCode"
              placeholder="EX: DR-7F9A"
              class="w-full bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 rounded-3xl py-5 px-8 text-center font-mono font-bold tracking-widest text-lg uppercase focus:border-arcane-500 outline-none transition-all"
            />
          </div>
          <button 
            @click="handleSearchCode"
            :disabled="searchingCode"
            class="w-full py-5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-3xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            <Search v-if="!searchingCode" class="w-5 h-5" />
            <RotateCcw v-else class="w-5 h-5 animate-spin" />
            {{ searchingCode ? 'Busca em Progresso...' : 'Buscar Linhagem' }}
          </button>
          
          <p v-if="authError" class="text-red-500 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2">{{ authError }}</p>
        </div>
      </div>

      <!-- Step 0.5: Authentication -->
      <div v-else-if="showLoginPrompt && !authStore.user" class="flex flex-col items-center justify-center py-20 space-y-8 text-center max-w-sm mx-auto animate-in fade-in zoom-in-95 duration-700">
        <div class="p-8 bg-arcane-500/10 rounded-[3rem] border border-arcane-500/20">
          <Moon class="w-16 h-16 text-arcane-600 dark:text-arcane-400 animate-float" />
        </div>
        <div class="space-y-4">
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-black uppercase mb-2">
            <CheckCircle2 class="w-3 h-3" /> Herói Encontrado
          </div>
          <h2 class="text-3xl font-display font-black text-neutral-900 dark:text-white uppercase tracking-tighter italic">VINCULAR ALMA</h2>
          <p class="text-neutral-500 dark:text-neutral-400">Você encontrou seu destino. Identifique-se com o Google para vincular este herói permanentemente à sua alma.</p>
        </div>
        <button 
          @click="handleLoginAndClaim"
          class="w-full py-5 bg-arcane-600 hover:bg-arcane-500 text-white rounded-3xl font-black uppercase tracking-widest transition-all shadow-xl shadow-arcane-900/20 flex items-center justify-center gap-3 active:scale-95"
        >
          <LogIn class="w-6 h-6" />
          Manifestar com Google
        </button>
      </div>

      <!-- Step 1: Initial Setup -->
      <div v-else-if="authStore.user && charStore.currentCharacter && charStore.currentCharacter.status === CharacterStatus.CRIADO" class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div class="text-center space-y-2">
          <h2 class="text-5xl font-rpg font-black text-neutral-900 dark:text-white tracking-tight uppercase italic">O DESPERTAR</h2>
          <p class="text-neutral-500 dark:text-neutral-400 text-lg font-medium italic">Sintonize sua essência com o multiverso arcaico.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <!-- Left: Race Selection -->
          <div class="lg:col-span-7 space-y-6">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] ml-1">Ancestralidades Disponíveis</label>
              <div class="relative w-48">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                <input 
                  v-model="raceSearch"
                  placeholder="Pesquisar raças..."
                  class="w-full pl-8 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-xl text-[10px] focus:ring-2 focus:ring-arcane-500/10 outline-none transition-all"
                />
              </div>
            </div>

            <div class="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
              <div v-for="(races, group) in groupedRaces" :key="group" class="space-y-3">
                <h4 v-if="races.length > 0" class="text-[8px] font-black text-neutral-300 dark:text-neutral-700 uppercase tracking-[0.4em] border-b border-neutral-100 dark:border-neutral-900 pb-1">{{ group }}</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    v-for="race in races"
                    :key="race.id"
                    @click="raceId = race.id"
                    :class="[
                      'p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group',
                      raceId === race.id 
                        ? 'border-arcane-500 bg-arcane-500/5 ring-4 ring-arcane-500/5' 
                        : 'border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-200 dark:hover:border-neutral-700'
                    ]"
                  >
                    <div class="flex flex-col h-full justify-between">
                      <div>
                        <div class="font-black text-sm uppercase tracking-tighter transition-colors" :class="raceId === race.id ? 'text-arcane-600 dark:text-arcane-400' : 'text-neutral-500 dark:text-neutral-400'">{{ race.name }}</div>
                        <div class="text-[8px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest mt-0.5">{{ race.source }}</div>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-1">
                        <template v-if="Object.keys(race.bonuses).length > 0">
                          <span v-for="(val, stat) in race.bonuses" :key="stat" class="px-1.5 py-0.5 bg-neutral-50 dark:bg-neutral-950 rounded border border-neutral-100 dark:border-neutral-900 text-[7px] font-black">
                             +{{ val }} {{ stat }}
                          </span>
                        </template>
                        <span v-if="race.choiceCount" class="px-1.5 py-0.5 bg-arcane-500/10 text-arcane-500 rounded border border-arcane-500/20 text-[7px] font-black uppercase">+{{ race.choiceCount }} ESCOLHAS</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Race Pagination -->
              <div v-if="raceTotalPages > 1" class="flex items-center justify-center gap-4 pt-4 border-t border-neutral-50 dark:border-neutral-950">
                <button 
                  @click="raceCurrentPage--" 
                  :disabled="raceCurrentPage === 1"
                  class="p-2 border border-neutral-100 dark:border-neutral-800 rounded-lg text-neutral-400 disabled:opacity-30 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                >
                  <ChevronLeft class="w-4 h-4" />
                </button>
                <div class="flex gap-1">
                  <span v-for="p in raceTotalPages" :key="p" 
                    @click="raceCurrentPage = p"
                    :class="[
                      'w-2 h-2 rounded-full transition-all cursor-pointer',
                      raceCurrentPage === p ? 'bg-arcane-500 scale-125' : 'bg-neutral-200 dark:bg-neutral-800'
                    ]"
                  ></span>
                </div>
                <button 
                  @click="raceCurrentPage++" 
                  :disabled="raceCurrentPage === raceTotalPages"
                  class="p-2 border border-neutral-100 dark:border-neutral-800 rounded-lg text-neutral-400 disabled:opacity-30 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                >
                  <ChevronLeft class="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>

          <!-- Right: Character Details & Confirmation -->
          <div class="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div class="bg-white dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
              <div class="space-y-3">
                <label class="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Codinome do Herói</label>
                <input 
                  v-model="name"
                  placeholder="Seu nome lendário..."
                  class="w-full px-6 py-5 bg-neutral-50 dark:bg-neutral-950 border-2 border-transparent focus:border-arcane-500 focus:bg-white dark:focus:bg-neutral-900 rounded-3xl text-xl font-bold text-neutral-900 dark:text-white outline-none transition-all shadow-inner"
                />
              </div>

              <div class="space-y-4">
                <label class="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Detalhes da Escolha</label>
                <div v-if="selectedRace" class="p-6 bg-arcane-500/5 rounded-3xl border border-arcane-500/10 space-y-4 animate-in zoom-in-95">
                  <div class="flex items-center justify-between">
                    <h3 class="text-2xl font-rpg font-black text-arcane-600 dark:text-arcane-400 uppercase tracking-tighter">{{ selectedRace.name }}</h3>
                    <Sparkle class="w-5 h-5 text-arcane-500 animate-pulse" />
                  </div>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{{ selectedRace.description || 'Uma linhagem antiga que agora molda seu destino.' }}</p>
                  <div class="flex flex-wrap gap-2 pt-2">
                    <div v-for="(val, stat) in selectedRace.bonuses" :key="stat" class="flex flex-col items-center px-4 py-2 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                      <span class="text-[8px] font-black text-neutral-400 uppercase">{{ STAT_LABELS[stat as StatType].substring(0,3) }}</span>
                      <span class="text-lg font-black text-arcane-600 dark:text-arcane-400">+{{ val }}</span>
                    </div>
                    <div v-if="selectedRace.choiceCount" class="px-4 py-2 bg-arcane-500 text-white rounded-2xl shadow-lg shadow-arcane-500/20 flex flex-col items-center">
                      <span class="text-[8px] font-black uppercase opacity-70">Escolhas</span>
                      <span class="text-lg font-black">+{{ selectedRace.choiceCount }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="p-8 border-2 border-dashed border-neutral-100 dark:border-neutral-900 rounded-3xl flex flex-col items-center justify-center text-center space-y-2 text-neutral-300 dark:text-neutral-800">
                  <Ghost class="w-10 h-10 opacity-20" />
                  <span class="text-[10px] font-black uppercase tracking-widest">Nenhuma raça selecionada</span>
                </div>
              </div>

              <button 
                @click="handleCreate"
                :disabled="!name || !raceId"
                class="w-full py-6 bg-arcane-600 hover:bg-arcane-500 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 disabled:text-neutral-400 dark:disabled:text-neutral-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xl transition-all shadow-xl shadow-arcane-900/20 active:scale-95 flex items-center justify-center gap-3"
              >
                Vincular Alma
                <ChevronRight class="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Rolling -->
      <div v-else-if="authStore.user && charStore.currentCharacter?.status === CharacterStatus.UTILIZADO" class="space-y-12 animate-in zoom-in-95 duration-700 max-w-2xl mx-auto">
        <div class="text-center space-y-4">
          <h3 class="text-5xl font-rpg font-black text-neutral-900 dark:text-white tracking-widest uppercase">O DESTINO CHAMA</h3>
          <p class="text-neutral-500 dark:text-neutral-400 text-lg font-medium italic">Role os dados sagrados para determinar seu potencial.</p>
        </div>

        <div class="bg-white dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-[3rem] p-12 text-center space-y-10 shadow-2xl shadow-arcane-500/5 transition-all hover:border-arcane-500/20">
          <div class="flex justify-center gap-4 py-8">
            <Dices class="w-24 h-24 text-arcane-500" :class="{ 'animate-dice': rolling, 'opacity-40 animate-float': !rolling }" />
          </div>
          
          <p class="text-neutral-400 dark:text-neutral-600 font-bold uppercase tracking-[0.3em] text-xs">Regra Oficial: 4d6 (Descarta o Menor)</p>
          
          <div v-if="tempRollResults.length === 6" class="space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="(result, idx) in tempRollResults" 
                :key="idx" 
                class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between shadow-inner"
              >
                <div class="flex gap-2">
                  <div 
                    v-for="(die, dIdx) in result.dice" 
                    :key="dIdx"
                    :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black border',
                      die === result.dropped ? 'opacity-30 line-through bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-arcane-600 dark:text-arcane-400'
                    ]"
                  >
                    {{ die }}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[8px] font-black uppercase text-neutral-400">Total:</span>
                  <div class="text-2xl font-display font-black text-neutral-900 dark:text-white italic">{{ result.total }}</div>
                </div>
              </div>
            </div>
            
            <div class="p-6 bg-arcane-500/5 rounded-2xl border border-arcane-500/10 flex items-center justify-between">
              <div class="text-left">
                <span class="text-[10px] font-black text-arcane-600 dark:text-arcane-400 uppercase tracking-widest">Soma Total</span>
                <div class="text-3xl font-display font-black text-neutral-900 dark:text-white">{{ totalSum }}</div>
              </div>
              <div class="text-right">
                <span class="px-3 py-1 bg-arcane-500 text-white text-[10px] font-black rounded-lg uppercase tracking-tighter">{{ getStatTier(totalSum) }}</span>
              </div>
            </div>

            <div class="flex gap-4">
              <button 
                @click="rerollWorst"
                :disabled="rerollUsed || rolling"
                class="flex-1 py-4 bg-white dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-700 hover:border-arcane-500/30 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:grayscale"
              >
                Reroll Pior ({{ rerollUsed ? 'Utilizado' : '1 Disponível' }})
              </button>
              <button 
                @click="confirmRolls"
                :disabled="rolling"
                class="flex-1 py-4 bg-arcane-600 hover:bg-arcane-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-arcane-500/20"
              >
                Selar Destino
              </button>
            </div>
          </div>

          <button 
            v-else
            @click="performRolls"
            :disabled="rolling"
            class="w-full py-6 bg-arcane-600 hover:bg-arcane-500 disabled:bg-neutral-100 dark:disabled:bg-neutral-800 text-white dark:disabled:text-neutral-700 rounded-3xl font-black uppercase tracking-[0.2em] text-xl transition-all shadow-xl shadow-arcane-500/20 flex items-center justify-center gap-4"
          >
            <RotateCcw v-if="rolling" class="w-6 h-6 animate-spin" />
            <span v-if="!rolling">INICIAR RITUAL</span>
            <span v-else>CONVOCANDO...</span>
          </button>
        </div>
      </div>

      <!-- Step 3: Waiting for Approval -->
      <div v-else-if="authStore.user && charStore.currentCharacter?.status === CharacterStatus.AGUARDANDO_VALIDACAO" class="flex flex-col items-center justify-center py-24 space-y-10 text-center max-w-lg mx-auto">
        <div class="relative animate-float">
          <div class="absolute inset-0 bg-arcane-500/20 dark:bg-arcane-500/10 blur-[60px] animate-pulse"></div>
          <div class="p-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] relative z-10 shadow-xl">
            <Ghost class="w-20 h-20 text-arcane-500 animate-pulse" />
          </div>
        </div>
        <div class="space-y-4 relative z-10">
          <h3 class="text-3xl font-display font-black text-neutral-900 dark:text-white uppercase tracking-tighter">AGUARDANDO O MESTRE</h3>
          <p class="text-neutral-500 dark:text-neutral-400 font-medium">Sua rolagem foi enviada para inspeção divina. Aguarde a aprovação inicial.</p>
        </div>
        <div class="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full grid grid-cols-3 gap-3 shadow-sm">
          <div v-for="(v, i) in charStore.currentCharacter.rolls?.raw" :key="i" class="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl font-black text-xl text-arcane-600 dark:text-arcane-400 border border-neutral-100 dark:border-neutral-800">
            {{ v }}
          </div>
        </div>
      </div>

      <!-- Step 4: Distribution -->
      <div v-else-if="authStore.user && charStore.currentCharacter && (charStore.currentCharacter.status === CharacterStatus.APROVADO || charStore.currentCharacter.status === CharacterStatus.DISTRIBUICAO_LIBERADA)" class="space-y-10 animate-in slide-in-from-top-4 duration-700 pb-12">
        <div class="text-center space-y-2">
          <h3 class="text-5xl font-rpg font-black text-neutral-900 dark:text-white tracking-widest uppercase">MOLDANDO O HERÓI</h3>
          <p class="text-neutral-500 dark:text-neutral-400 text-lg font-medium italic">Distribua seus valores nos atributos de sua preferência.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <!-- Available Numbers -->
          <div class="lg:col-span-1 space-y-6">
            <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 space-y-6 shadow-sm flex flex-col items-center">
              <h4 class="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.4em] mb-4">Números Disponíveis</h4>
              <div class="flex flex-wrap lg:flex-col gap-4 justify-center w-full">
                <div 
                  v-for="(val, idx) in availableValues" 
                  :key="idx"
                  @click="() => {
                    const emptyStat = stats.find(s => !distribution[s]);
                    if (emptyStat) selectValue(emptyStat, val);
                  }"
                  class="w-16 h-16 lg:w-full lg:h-16 flex items-center justify-center lg:justify-between px-6 bg-arcane-500/10 text-arcane-600 dark:text-arcane-400 rounded-2xl font-black text-2xl border-2 border-arcane-500/20 shadow-inner group hover:scale-105 active:scale-95 cursor-pointer transition-all"
                >
                  <span class="group-hover:translate-x-1 transition-transform">{{ val }}</span>
                  <Sparkle class="hidden lg:block w-4 h-4 opacity-30" />
                </div>
                <div v-if="availableValues.length === 0" class="w-full flex flex-col items-center py-8 text-neutral-300 dark:text-neutral-800">
                  <CheckCircle2 class="w-12 h-12 opacity-20 mb-2" />
                  <span class="text-[10px] font-black uppercase tracking-widest">Todos alocados</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Stats Inputs -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Racial Choice Selector (Integration in Distribution) -->
            <div v-if="selectedRace?.choiceCount" class="p-8 bg-arcane-500/5 border-2 border-arcane-500/20 rounded-[2.5rem] space-y-6 animate-in zoom-in-95">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-rpg font-black text-arcane-600 dark:text-arcane-400 uppercase tracking-tighter italic">DÁDIVAS DA ANCESTRALIDADE</h4>
                  <p class="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Escolha {{ selectedRace.choiceCount }} atributos para receber +{{ selectedRace.choiceBonus || 1 }}</p>
                </div>
                <div class="px-5 py-2 bg-white dark:bg-neutral-900 rounded-2xl border border-arcane-500/20 text-[10px] font-black text-arcane-500 shadow-sm">
                  {{ choiceSelections.length }} / {{ selectedRace.choiceCount }}
                </div>
              </div>

              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <button 
                  v-for="stat in stats" 
                  :key="stat"
                  @click="() => {
                    if (selectedRace?.choiceExclude?.includes(stat)) return;
                    const idx = choiceSelections.indexOf(stat);
                    if (idx > -1) choiceSelections.splice(idx, 1);
                    else if (choiceSelections.length < (selectedRace?.choiceCount || 0)) choiceSelections.push(stat);
                  }"
                  :disabled="selectedRace?.choiceExclude?.includes(stat)"
                  :class="[
                    'py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2',
                    choiceSelections.includes(stat) 
                      ? 'border-arcane-500 bg-arcane-500 text-white shadow-lg shadow-arcane-500/20' 
                      : 'border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-200 text-neutral-400',
                    selectedRace?.choiceExclude?.includes(stat) ? 'opacity-20 cursor-not-allowed grayscale' : ''
                  ]"
                >
                  {{ stat }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="stat in stats" 
                :key="stat"
                @click="removeValue(stat)"
                :class="[
                  'bg-white dark:bg-neutral-900 border-2 p-6 rounded-[2.5rem] flex items-center justify-between group transition-all shadow-sm cursor-pointer overflow-hidden relative',
                  distribution[stat] ? 'border-arcane-500/30 ring-4 ring-arcane-500/5' : 'border-neutral-100 dark:border-neutral-800 grayscale opacity-60'
                ]"
              >
                <!-- Background Decoration for active stats -->
                <div v-if="distribution[stat]" class="absolute -right-4 -bottom-4 w-20 h-20 bg-arcane-500/5 blur-2xl rounded-full"></div>
                
                  <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-1">
                      <label class="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none">{{ STAT_LABELS[stat] }}</label>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="text-3xl font-display font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter">{{ stat }}</div>
                      
                      <!-- Racial Bonus (Visible even before assignment) -->
                      <div 
                        v-if="(selectedRace?.bonuses?.[stat] || 0) + (choiceSelections.includes(stat) ? (selectedRace?.choiceBonus || 1) : 0) > 0" 
                        class="flex flex-col items-center justify-center px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                      >
                        <span class="text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase leading-none">Racial</span>
                        <span class="text-[10px] font-black text-emerald-600">
                          +{{ (selectedRace?.bonuses?.[stat] || 0) + (choiceSelections.includes(stat) ? (selectedRace?.choiceBonus || 1) : 0) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-3 relative z-10">
                    <div v-if="distribution[stat]" class="flex items-center gap-2">
                       <!-- Final Modifier Calculation -->
                      <div class="flex flex-col items-center px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-2xl shadow-sm min-w-[50px]">
                        <span class="text-[8px] font-black text-neutral-400 dark:text-neutral-600 uppercase mb-0.5">Mod.</span>
                        <span class="text-lg font-black" :class="calculateModifier(finalAttributes[stat]) >= 0 ? 'text-emerald-500' : 'text-red-500'">
                          {{ getModifierString(calculateModifier(finalAttributes[stat])) }}
                        </span>
                      </div>

                      <div class="flex flex-col items-center">
                        <div class="w-14 h-14 flex items-center justify-center bg-arcane-600 text-white rounded-2xl font-black text-2xl shadow-lg shadow-arcane-500/20 group-hover:scale-105 transition-transform">
                          {{ finalAttributes[stat] }}
                        </div>
                        <span class="text-[7px] font-black text-neutral-400 dark:text-neutral-600 mt-1 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Remover</span>
                      </div>
                    </div>
                    <div v-else class="w-14 h-14 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center bg-neutral-50/50 dark:bg-neutral-950/50 group-hover:border-arcane-500/30 transition-all">
                      <Plus class="w-6 h-6 text-neutral-200 dark:text-neutral-800" />
                    </div>
                  </div>
              </div>
            </div>

            <div class="pt-6">
              <button 
                @click="finalizeDraft"
                :disabled="!canFinalize"
                class="w-full py-6 bg-arcane-600 hover:bg-arcane-500 disabled:bg-neutral-200 dark:disabled:bg-neutral-900 disabled:text-neutral-400 dark:disabled:text-neutral-700 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xl transition-all shadow-xl shadow-arcane-900/10 dark:shadow-arcane-900/40 active:scale-[0.98] flex items-center justify-center gap-3"
              >
                Consagrar Atributos
                <ArrowRightLeft class="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 5: Final Card -->
      <div v-else-if="authStore.user && charStore.currentCharacter?.status === CharacterStatus.FICHA_FINALIZADA" class="max-w-xl mx-auto animate-in zoom-in-95 duration-1000">
        <div class="bg-white dark:bg-neutral-900 border-2 border-arcane-500/30 rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(139,92,246,0.25)] relative arcane-glow">
          <!-- Decorative corner -->
          <div class="absolute -top-12 -right-12 w-32 h-32 bg-arcane-500/10 blur-3xl rounded-full"></div>
          
          <div class="p-10 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between relative overflow-hidden">
             <div class="relative z-10">
              <h3 class="text-4xl font-rpg font-black text-neutral-900 dark:text-white uppercase tracking-tighter">{{ charStore.currentCharacter.name }}</h3>
              <span class="text-xs font-bold text-arcane-500 uppercase tracking-[0.3em] font-rpg">{{ selectedRace?.name }}</span>
             </div>
             <CheckCircle2 class="w-16 h-16 text-emerald-500 relative z-10" />
          </div>

          <div class="p-10 grid grid-cols-2 gap-6 relative z-10">
            <div 
              v-for="stat in stats" 
              :key="stat"
              class="flex flex-col p-6 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-[2.5rem] group hover:border-arcane-500/30 transition-all shadow-sm border-dashed"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex flex-col">
                  <span class="text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest leading-none mb-1">{{ STAT_LABELS[stat] }}</span>
                  <span class="text-3xl font-display font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter">{{ stat }}</span>
                </div>
                
                <!-- Explicit Racial Bonus -->
                <div 
                  v-if="(selectedRace?.bonuses[stat] || 0) + (choiceSelections.includes(stat) ? (selectedRace?.choiceBonus || 1) : 0) > 0"
                  class="flex flex-col items-end"
                >
                  <span class="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">Racial</span>
                  <span class="text-lg font-black text-emerald-500">
                    +{{ (selectedRace?.bonuses[stat] || 0) + (choiceSelections.includes(stat) ? (selectedRace?.choiceBonus || 1) : 0) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-900">
                <div class="flex flex-col">
                  <span class="text-[9px] font-black text-neutral-400 uppercase leading-none">Total</span>
                  <span class="text-4xl font-bold text-arcane-600 dark:text-arcane-400">{{ charStore.currentCharacter.attributes?.[stat] }}</span>
                </div>
                <div class="px-4 py-2 bg-white dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-2xl flex flex-col items-center shadow-sm">
                  <span class="text-[8px] font-black text-neutral-400 uppercase leading-none mb-1">Mod</span>
                  <span class="text-xl font-black" :class="calculateModifier(charStore.currentCharacter.attributes?.[stat] || 10) >= 0 ? 'text-emerald-500' : 'text-red-500'">
                    {{ getModifierString(calculateModifier(charStore.currentCharacter.attributes?.[stat] || 10)) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

            <div class="px-10 py-8 bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center gap-4">
              <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.4em]">Ficha Validada • Hexatronus System</p>
              <div class="flex gap-4">
                <button @click="router.push('/')" class="text-xs font-black text-neutral-500 hover:text-arcane-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                  <RotateCcw class="w-4 h-4" />
                  Nova Alma
                </button>
              </div>
            </div>
        </div>
      </div>

      <!-- Step 6: Rejected/Admin States -->
      <div v-else-if="authStore.user && charStore.currentCharacter && [CharacterStatus.REJEITADO, CharacterStatus.BLOQUEADO, CharacterStatus.ARQUIVADO].includes(charStore.currentCharacter.status)" class="text-center py-24 space-y-6 max-w-sm mx-auto">
        <div class="p-8 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
          <Lock class="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h3 class="text-xl font-bold text-neutral-900 dark:text-white uppercase">Acesso Restrito</h3>
          <p v-if="charStore.currentCharacter.status === CharacterStatus.REJEITADO" class="text-neutral-500 dark:text-neutral-400 mt-2">Suas rolagens foram rejeitadas pelo Mestre. Inicie um novo ritual.</p>
          <p v-else class="text-neutral-500 dark:text-neutral-400 mt-2">Esta alma foi arquivada ou bloqueada pelo Mestre.</p>
        </div>
        <button @click="router.push('/')" class="w-full py-4 bg-arcane-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest">Retornar ao Início</button>
      </div>

      <!-- ERROR OR FALLBACK -->
      <div v-else class="text-center py-24 space-y-6 max-w-sm mx-auto">
        <div class="p-8 bg-red-500/5 border border-red-500/20 rounded-3xl">
          <AlertCircle class="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 class="text-xl font-bold text-neutral-900 dark:text-white uppercase">Acesso Interrompido</h3>
          <p class="text-neutral-500 dark:text-neutral-400 mt-2">Esta conexão tornou-se instável ou o mestre revogou seu acesso.</p>
          <div v-if="charStore.currentCharacter" class="mt-4 p-2 bg-black/10 rounded text-[8px] font-mono opacity-50 uppercase tracking-tighter">
            Status: {{ charStore.currentCharacter.status }}
          </div>
        </div>
        <button @click="router.push('/')" class="w-full py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs font-black uppercase tracking-widest">Retornar ao Início</button>
      </div>
      <!-- NO CHARACTER FOUND -->
      <div v-if="!charStore.currentCharacter && code && !charStore.loading && !charStore.error && !searchingCode" class="text-center py-32 space-y-6 flex flex-col items-center justify-center p-6 bg-white dark:bg-neutral-950 rounded-[3rem] border border-dashed border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95">
        <div class="p-8 bg-neutral-100 dark:bg-neutral-900 rounded-full">
          <WifiOff class="w-16 h-16 text-neutral-300 mx-auto" />
        </div>
        <h3 class="text-2xl font-rpg font-black text-neutral-600 dark:text-neutral-400 uppercase italic">FALHA DE SINCRONIA</h3>
        <p class="text-neutral-500 max-w-xs">O código fornecido não ressoa com nenhuma alma ativa neste plano ou o tempo de conexão expirou.</p>
        <button @click="router.push('/')" class="px-8 py-4 bg-arcane-600 hover:bg-arcane-500 text-white rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-arcane-500/20">Reconectar</button>
      </div>

      <!-- Boon of Outer Realms Glif (Easter Egg UI) -->
      <div v-if="boonVisible" class="fixed bottom-6 left-6 z-[100] animate-in fade-in duration-1000">
        <button 
          @click="boonActive = !boonActive"
          :class="[
            'p-4 rounded-full border-2 transition-all duration-700 active:scale-90 bg-white dark:bg-neutral-900 shadow-lg',
            boonActive 
              ? 'border-amber-500/40 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
              : 'border-neutral-200/50 dark:border-neutral-800/50 text-neutral-300 dark:text-neutral-700'
          ]"
        >
          <Zap :class="['w-5 h-5', boonActive ? 'animate-pulse' : '']" />
        </button>
        <div v-if="boonActive" class="absolute bottom-full left-0 mb-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl shadow-2xl min-w-[200px] animate-in slide-in-from-bottom-2">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Flame class="w-4 h-4 text-amber-600" />
            </div>
            <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-tight">Boon of Outer Realms</h5>
          </div>
          <p class="text-[9px] text-neutral-400 leading-relaxed uppercase font-bold italic">As leis da probabilidade curvam-se perante sua vontade. Atributos inferiores a 10 são purgados pelo vazio.</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.animate-in {
  animation: fadeIn 0.5s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
