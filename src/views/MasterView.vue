<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '@/firebase/config';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  orderBy,
  where 
} from 'firebase/firestore';
import { useAuthStore } from '@/stores/auth';
import { handleFirestoreError, OperationType } from '@/firebase/firestoreUtils';
import { CharacterStatus, type Character, type Race, type StatType } from '@/types';
import { BASE_RACES, STAT_LABELS, calculateModifier, getModifierString, getRacialBonusesBreakdown } from '@/utils/dndRules';
import { 
  ShieldAlert, 
  Key, 
  Users, 
  Plus, 
  Pencil,
  Trash2, 
  Check, 
  X, 
  RefreshCcw, 
  LogOut,
  Search,
  Filter,
  BarChart3,
  RotateCcw,
  LogIn,
  ChevronLeft,
  ChevronDown,
  Crown,
  ScrollText,
  Shapes,
  Dna,
  Terminal,
  Zap,
  Moon,
  Flame,
  Dices,
  Sparkle
} from 'lucide-vue-next';

const isAuthenticated = ref(false);
const error = ref('');

const characters = ref<Character[]>([]);
const races = ref<Race[]>([]);
const search = ref('');
const statusFilter = ref<string>('all');
const raceFilter = ref<string>('all');
const sortBy = ref<'updatedAt' | 'name' | 'status'>('updatedAt');
const sortOrder = ref<'asc' | 'desc'>('desc');
const activeTab = ref<'characters' | 'races'>('characters');
const raceSearch = ref('');
const currentPage = ref(1);
const raceCurrentPage = ref(1);
const pageSize = 10;
const racePageSize = 10;

const editingRace = ref<Race | null>(null);
const showRaceModal = ref(false);
const expandedChars = ref<Set<string>>(new Set());

const toggleExpand = (id: string) => {
  if (expandedChars.value.has(id)) {
    expandedChars.value.delete(id);
  } else {
    expandedChars.value.add(id);
  }
};


const authStore = useAuthStore();
const router = useRouter();

const charUnsubscribe = ref<(() => void) | null>(null);
const racesUnsubscribe = ref<(() => void) | null>(null);

const cleanupListeners = () => {
  if (charUnsubscribe.value) {
    charUnsubscribe.value();
    charUnsubscribe.value = null;
  }
  if (racesUnsubscribe.value) {
    racesUnsubscribe.value();
    racesUnsubscribe.value = null;
  }
};

const setupListeners = () => {
  if (!authStore.isAdmin || !authStore.user) return;
  
  cleanupListeners();
  
  console.log('MasterView: Setting up listeners...');
  
  // Characters Listener
  const charPath = 'characters';
  const qCharacters = query(
    collection(db, charPath), 
    where('masterId', '==', authStore.user.uid),
    orderBy('updatedAt', 'desc')
  );
  charUnsubscribe.value = onSnapshot(qCharacters, (snapshot) => {
    console.log(`MasterView: Received snapshot with ${snapshot.size} characters`);
    characters.value = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as Character;
    });
  }, (err) => {
    if (authStore.user) {
      console.error('MasterView: Characters listener error:', err);
      handleFirestoreError(err, OperationType.LIST, charPath);
    }
  });

  // Races Listener
  const racePath = 'races';
  racesUnsubscribe.value = onSnapshot(collection(db, racePath), (snapshot) => {
    races.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Race));
    
    // Bootstrap if empty
    if (snapshot.empty) {
      bootstrapRaces();
    }
  }, (err) => {
    if (authStore.user) {
      handleFirestoreError(err, OperationType.LIST, racePath);
    }
  });
};

const bootstrapRaces = async () => {
  for (const race of BASE_RACES) {
    await setDoc(doc(db, 'races', race.id), {
      ...race,
      isActive: true,
      updatedAt: Date.now()
    }, { merge: true });
  }
};

const toggleRaceActive = async (raceId: string, current: boolean) => {
  try {
    await updateDoc(doc(db, 'races', raceId), {
      isActive: !current,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `races/${raceId}`);
  }
};

const deleteRace = async (raceId: string) => {
  if (confirm('Deseja excluir permanentemente esta raça?')) {
    try {
      await deleteDoc(doc(db, 'races', raceId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `races/${raceId}`);
    }
  }
};

const loginAsMaster = async () => {
  error.value = '';
  try {
    if (!authStore.user) {
      await authStore.loginWithGoogle();
    }
    
    // Check if user is allowed/bootstrap as admin if it's the specific user
    if (authStore.user) {
      try {
        await setDoc(doc(db, 'admins', authStore.user.uid), { 
          role: 'master',
          email: authStore.user.email,
          assignedAt: Date.now()
        }, { merge: true });
      } catch (e: any) {
        console.log('Admin check status:', e.message);
      }
    }

    if (authStore.isAdmin) {
      isAuthenticated.value = true;
      setupListeners();
    } else {
      error.value = 'Sua conta não possui privilégios de Mestre.';
    }
  } catch (err: any) {
    error.value = 'Erro ao sincronizar com o Google.';
    console.error(err);
  }
};

const handleLogout = async () => {
  cleanupListeners();
  await authStore.logout();
  isAuthenticated.value = false;
};

onUnmounted(() => {
  cleanupListeners();
});

// Reactively set authentication if the user is already an admin
watch(() => [authStore.isAdmin, authStore.user], ([isAdmin, user]) => {
  if (isAdmin && user) {
    isAuthenticated.value = true;
    setupListeners();
  }
}, { immediate: true });

const generateCode = async () => {
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `DND-${Math.floor(1000 + Math.random() * 9000)}-${randomStr}`;
  const path = `characters/${code}`;
  
  console.log(`MasterView: Generating code ${code}`);
  
  try {
    const newRef = doc(db, 'characters', code);
    await setDoc(newRef, {
      id: code,
      code: code,
      status: CharacterStatus.CRIADO,
      name: 'Pendente',
      raceId: 'human',
      userId: null,
      masterId: authStore.user?.uid || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log(`MasterView: Code ${code} created successfully`);
    // Reset filters to show new entry
    resetFilters();
  } catch (err) {
    console.error(`MasterView: Error generating code ${code}:`, err);
    handleFirestoreError(err, OperationType.CREATE, path);
  }
};

const updateCharStatus = async (id: string, status: CharacterStatus) => {
  const path = `characters/${id}`;
  try {
    await updateDoc(doc(db, 'characters', id), { status, updatedAt: Date.now() });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
};

const deleteChar = async (id: string) => {
  if (confirm('Deseja realmente EXCLUIR permanentemente esta ficha? Esta ação não pode ser desfeita.')) {
    const path = `characters/${id}`;
    try {
      await deleteDoc(doc(db, 'characters', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
};

const resetRolls = async (id: string) => {
  const path = `characters/${id}`;
  try {
    await updateDoc(doc(db, 'characters', id), { 
      status: CharacterStatus.UTILIZADO, 
      rolls: null,
      attributes: null,
      updatedAt: Date.now() 
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
};

const filteredChars = computed(() => {
  let result = characters.value.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.value.toLowerCase()) || c.code.toLowerCase().includes(search.value.toLowerCase());
    const matchesStatus = statusFilter.value === 'all' || c.status === statusFilter.value;
    const matchesRace = raceFilter.value === 'all' || c.raceId === raceFilter.value;
    return matchesSearch && matchesStatus && matchesRace;
  });

  return result.sort((a, b) => {
    const factor = sortOrder.value === 'asc' ? 1 : -1;
    if (sortBy.value === 'updatedAt') return (a.updatedAt - b.updatedAt) * factor;
    if (sortBy.value === 'name') return a.name.localeCompare(b.name) * factor;
    if (sortBy.value === 'status') return a.status.localeCompare(b.status) * factor;
    return 0;
  });
});

const toggleSort = (field: 'updatedAt' | 'name' | 'status') => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = field;
    sortOrder.value = 'desc';
  }
};

const statsData = computed(() => {
  const total = characters.value.length;
  const drafts = characters.value.filter(c => c.status === CharacterStatus.CRIADO).length;
  const pending = characters.value.filter(c => c.status === CharacterStatus.AGUARDANDO_VALIDACAO).length;
  const approved = characters.value.filter(c => c.status === CharacterStatus.APROVADO || c.status === CharacterStatus.FICHA_FINALIZADA).length;
  return { total, drafts, pending, approved };
});

const resetFilters = () => {
  search.value = '';
  statusFilter.value = 'all';
  raceFilter.value = 'all';
};

const totalPages = computed(() => Math.ceil(filteredChars.value.length / pageSize));
const paginatedChars = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredChars.value.slice(start, start + pageSize);
});

const filteredRaces = computed(() => {
  return races.value.filter(r => 
    r.name.toLowerCase().includes(raceSearch.value.toLowerCase()) || 
    r.source.toLowerCase().includes(raceSearch.value.toLowerCase())
  );
});

const raceTotalPages = computed(() => Math.ceil(filteredRaces.value.length / racePageSize));
const paginatedRaces = computed(() => {
  const start = (raceCurrentPage.value - 1) * racePageSize;
  return filteredRaces.value.slice(start, start + racePageSize);
});

// Reset page on search or filter
watch([search, statusFilter, raceFilter], () => {
  currentPage.value = 1;
});

watch(raceSearch, () => {
  raceCurrentPage.value = 1;
});

const createNewRace = () => {
  editingRace.value = { 
    id: 'new-' + Date.now(), 
    name: '', 
    bonuses: {}, 
    source: 'Homebrew', 
    choiceCount: 0, 
    choiceBonus: 1, 
    choiceBonuses: [],
    choiceExclude: [],
    isActive: true
  };
  showRaceModal.value = true;
};

const editRace = (race: Race) => {
  const cloned = { ...race };
  if (cloned.isActive === undefined) {
    cloned.isActive = true;
  }
  if (!cloned.choiceBonuses) {
    cloned.choiceBonuses = [];
  }
  if (cloned.choiceCount && cloned.choiceBonuses.length === 0) {
    cloned.choiceBonuses = Array(cloned.choiceCount).fill(cloned.choiceBonus || 1);
  }
  editingRace.value = cloned;
  showRaceModal.value = true;
};

watch(() => editingRace.value?.choiceCount, (newCount) => {
  if (!editingRace.value) return;
  const count = Number(newCount) || 0;
  if (count <= 0) {
    editingRace.value.choiceBonuses = [];
    return;
  }
  if (!editingRace.value.choiceBonuses) {
    editingRace.value.choiceBonuses = [];
  }
  while (editingRace.value.choiceBonuses.length < count) {
    editingRace.value.choiceBonuses.push(editingRace.value.choiceBonus || 1);
  }
  if (editingRace.value.choiceBonuses.length > count) {
    editingRace.value.choiceBonuses = editingRace.value.choiceBonuses.slice(0, count);
  }
});

const saveRace = async () => {
  if (!editingRace.value) return;
  try {
    const raceRef = doc(db, 'races', editingRace.value.id);
    await setDoc(raceRef, {
      ...editingRace.value,
      updatedAt: Date.now()
    }, { merge: true });
    showRaceModal.value = false;
    editingRace.value = null;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `races/${editingRace.value.id}`);
  }
};

const getCharRace = (char: Character) => {
  return races.value.find(r => r.id === char.raceId) || BASE_RACES.find(r => r.id === char.raceId) || BASE_RACES[0];
};
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 font-sans transition-colors duration-500">
    <!-- Login Overlay -->
    <div v-if="!isAuthenticated" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-6 overflow-hidden">
      <!-- Decorative background elements -->
      <div class="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-arcane-500/10 blur-[150px] rounded-full animate-pulse"></div>
      <div class="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full animate-pulse" style="animation-delay: -2s"></div>

      <div class="w-full max-w-lg space-y-10 text-center animate-in zoom-in-95 fade-in duration-700 relative z-10">
        <div class="relative inline-block group">
          <div class="absolute -inset-4 bg-arcane-500/20 rounded-[3rem] blur-xl group-hover:bg-arcane-500/30 transition-all duration-500"></div>
          <div class="relative p-10 bg-white dark:bg-neutral-900 rounded-[3rem] shadow-2xl border border-neutral-100 dark:border-neutral-800 space-y-8 overflow-hidden">
            <!-- Icon / Badge -->
            <div class="inline-flex p-6 rounded-3xl bg-arcane-500/10 text-arcane-600 dark:text-arcane-400 ring-1 ring-arcane-500/20 animate-float translate-y-[-10px]">
              <Crown class="w-12 h-12" />
            </div>

            <div class="space-y-3">
              <h1 class="text-4xl md:text-5xl font-rpg font-black text-neutral-900 dark:text-white uppercase tracking-tighter">FORJA DO MESTRE</h1>
              <p class="text-neutral-500 dark:text-neutral-400 text-[11px] font-black uppercase tracking-[0.4em] leading-relaxed">Droop's Dice • Admin Console</p>
            </div>

            <div class="mx-auto w-12 h-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full"></div>

            <div class="space-y-6">
              <p class="text-xs text-neutral-400 dark:text-neutral-500 italic max-w-[300px] mx-auto leading-relaxed">
                Bem-vindo de volta, Arquiteto de Destinos. Acesse seu painel para gerenciar os segredos da campanha.
              </p>

              <div class="space-y-4 pt-4">
                <button 
                  @click="loginAsMaster"
                  class="w-full py-5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-3xl font-black uppercase tracking-[0.2em] transition-all shadow-xl hover:shadow-arcane-500/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 group/login border-2 border-transparent"
                >
                  <LogIn class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  Entrar como Mestre
                </button>
                
                <p v-if="error" class="text-red-500 text-[10px] font-black uppercase tracking-widest animate-shake">{{ error }}</p>

                <button 
                  @click="router.push('/')"
                  class="w-full py-4 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft class="w-4 h-4" />
                  Voltar ao Portal do Jogador
                </button>
              </div>
            </div>

            <!-- Terminal-like footer -->
            <div class="mt-8 pt-8 border-t border-neutral-50 dark:border-neutral-800/50 flex items-center justify-center gap-4 opacity-30 grayscale">
              <Terminal class="w-4 h-4" />
              <span class="text-[8px] font-mono font-bold tracking-widest uppercase">System Protocol Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Admin Dashboard -->
    <template v-else>
      <header class="bg-white/80 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800 px-8 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-lg">
        <div class="flex items-center gap-4">
          <div class="p-2 bg-arcane-600 dark:bg-arcane-500 rounded-xl text-white dark:text-arcane-950 shadow-lg shadow-arcane-500/20">
            <Crown class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-2xl font-rpg font-black text-neutral-900 dark:text-white uppercase tracking-tighter">Droop's Dice</h2>
            <p class="text-[10px] uppercase text-neutral-500 font-bold tracking-[0.3em]">Master Panel • Admin Mode</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div v-if="authStore.user" class="hidden md:flex items-center gap-3 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <img :src="authStore.user.photoURL || ''" class="w-6 h-6 rounded-full border border-arcane-500/20" />
            <div class="flex flex-col">
              <span class="text-[9px] font-black text-neutral-900 dark:text-white uppercase leading-none">{{ authStore.user.displayName }}</span>
              <span class="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">{{ authStore.user.email }}</span>
            </div>
          </div>

          <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl mr-4">
            <button 
              @click="activeTab = 'characters'"
              :class="[
                'px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2',
                activeTab === 'characters' ? 'bg-white dark:bg-neutral-900 shadow-sm text-arcane-500' : 'text-neutral-400 hover:text-neutral-600'
              ]"
            >
              <ScrollText class="w-3 h-3" />
              Códices
            </button>
            <button 
              @click="activeTab = 'races'"
              :class="[
                'px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2',
                activeTab === 'races' ? 'bg-white dark:bg-neutral-900 shadow-sm text-arcane-500' : 'text-neutral-400 hover:text-neutral-600'
              ]"
            >
              <Dna class="w-3 h-3" />
              Ancestralidades
            </button>
          </div>

          <button v-if="activeTab === 'characters'" @click="generateCode" class="px-5 py-2.5 bg-arcane-600 dark:bg-arcane-500 hover:bg-arcane-500 dark:hover:bg-arcane-400 text-white dark:text-arcane-950 text-xs font-black rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-arcane-500/10">
            <Plus class="w-4 h-4" />
            GERAR CÓDIGO
          </button>
          <button @click="router.push('/')" class="p-2.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl" title="Voltar ao Início">
            <LogIn class="w-5 h-5 rotate-180" />
          </button>
          <button @click="handleLogout" class="p-2.5 text-neutral-400 hover:text-red-500 transition-colors bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl" title="Sair da Conta">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </header>

      <main class="p-8 max-w-7xl mx-auto space-y-8">
        <div v-if="activeTab === 'characters'" class="space-y-8">
          <!-- Stats Recap -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              @click="statusFilter = 'all'"
              :class="[
                'bg-white dark:bg-neutral-900 border p-5 rounded-3xl space-y-1 shadow-sm overflow-hidden relative transition-all text-left',
                statusFilter === 'all' ? 'border-arcane-500 ring-2 ring-arcane-500/10' : 'border-neutral-200 dark:border-neutral-800'
              ]"
            >
              <div class="absolute -top-2 -right-2 p-4 opacity-5 rotate-12">
                <ScrollText class="w-16 h-16" />
              </div>
              <div class="flex items-center justify-between relative z-10">
                <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest font-rpg">Total</span>
              </div>
              <div class="text-4xl font-rpg font-black text-neutral-900 dark:text-white relative z-10">{{ statsData.total }}</div>
            </button>
            
            <button 
              @click="statusFilter = CharacterStatus.CRIADO"
              :class="[
                'bg-white dark:bg-neutral-900 border p-5 rounded-3xl space-y-1 shadow-sm overflow-hidden relative transition-all text-left',
                statusFilter === CharacterStatus.CRIADO ? 'border-arcane-500 ring-2 ring-arcane-500/10' : 'border-neutral-200 dark:border-neutral-800'
              ]"
            >
              <div class="absolute -top-2 -right-2 p-4 opacity-10 rotate-12">
                <Plus class="w-16 h-16 text-neutral-400" />
              </div>
              <div class="flex items-center justify-between relative z-10">
                <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest font-rpg">Disponíveis</span>
              </div>
              <div class="text-4xl font-rpg font-black text-neutral-900 dark:text-white relative z-10">{{ statsData.drafts }}</div>
            </button>

            <button 
              @click="statusFilter = CharacterStatus.AGUARDANDO_VALIDACAO"
              :class="[
                'bg-white dark:bg-neutral-900 border p-5 rounded-3xl space-y-1 shadow-sm overflow-hidden relative transition-all text-left border-l-4 border-l-arcane-500',
                statusFilter === CharacterStatus.AGUARDANDO_VALIDACAO ? 'ring-2 ring-arcane-500/10' : 'border-neutral-200 dark:border-neutral-800'
              ]"
            >
              <div class="absolute -top-2 -right-2 p-4 opacity-10 rotate-12">
                <Moon class="w-16 h-16 text-arcane-500" />
              </div>
              <div class="flex items-center justify-between relative z-10">
                <span class="text-[9px] font-black text-arcane-500 uppercase tracking-widest font-rpg">Escrutínio</span>
              </div>
              <div class="text-4xl font-rpg font-black text-neutral-900 dark:text-white relative z-10">{{ statsData.pending }}</div>
            </button>

            <button 
              @click="statusFilter = CharacterStatus.FICHA_FINALIZADA"
              :class="[
                'bg-white dark:bg-neutral-900 border p-5 rounded-3xl space-y-1 shadow-sm overflow-hidden relative transition-all text-left border-l-4 border-l-emerald-500',
                statusFilter === CharacterStatus.FICHA_FINALIZADA ? 'ring-2 ring-emerald-500/10' : 'border-neutral-200 dark:border-neutral-800'
              ]"
            >
              <div class="absolute -top-2 -right-2 p-4 opacity-10 rotate-12">
                <Zap class="w-16 h-16 text-emerald-500" />
              </div>
              <div class="flex items-center justify-between relative z-10">
                <span class="text-[9px] font-black text-emerald-500 uppercase tracking-widest font-rpg">Consagrados</span>
              </div>
              <div class="text-4xl font-rpg font-black text-neutral-900 dark:text-white relative z-10">{{ statsData.approved }}</div>
            </button>
          </div>

          <!-- Filters & List -->
          <div class="space-y-4">
          <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div class="relative w-full md:w-96">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                v-model="search"
                placeholder="Pesquisar por nome ou código..."
                class="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:ring-2 focus:ring-arcane-500/20 outline-none transition-all shadow-sm"
              />
            </div>
            <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div class="px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-3 shadow-sm min-w-[180px]">
                <Filter class="w-4 h-4 text-neutral-400" />
                <select v-model="statusFilter" class="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-neutral-600 dark:text-neutral-400 w-full appearance-none">
                  <option value="all">Status: Todos</option>
                  <option v-for="status in Object.values(CharacterStatus)" :key="status" :value="status">{{ status.replace('_', ' ') }}</option>
                </select>
              </div>

              <div class="px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-3 shadow-sm min-w-[180px]">
                <Shapes class="w-4 h-4 text-neutral-400" />
                <select v-model="raceFilter" class="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-neutral-600 dark:text-neutral-400 w-full appearance-none">
                  <option value="all">Ancestralidade: Todas</option>
                  <option v-for="race in races" :key="race.id" :value="race.id">{{ race.name }}</option>
                </select>
              </div>

              <button 
                @click="resetFilters"
                class="p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-2xl transition-colors"
                title="Limpar Filtros"
              >
                <RotateCcw class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden overflow-x-auto shadow-xl rpg-card">
            <table class="w-full text-left border-collapse min-w-[900px]">
              <thead class="bg-neutral-50 dark:bg-neutral-800/50 text-[10px] uppercase font-black tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                <tr>
                  <th class="px-8 py-5 cursor-pointer hover:text-arcane-500" @click="toggleSort('name')">
                    <div class="flex items-center gap-2">
                       Código / Personagem
                       <BarChart3 v-if="sortBy === 'name'" class="w-3 h-3" :class="sortOrder === 'asc' ? 'rotate-180' : ''" />
                    </div>
                  </th>
                  <th class="px-8 py-5 text-center cursor-pointer hover:text-arcane-500" @click="toggleSort('status')">
                    <div class="flex items-center justify-center gap-2">
                      Status
                      <BarChart3 v-if="sortBy === 'status'" class="w-3 h-3" :class="sortOrder === 'asc' ? 'rotate-180' : ''" />
                    </div>
                  </th>
                  <th class="px-8 py-5">Dados Rolados</th>
                  <th class="px-8 py-5">Atributos Finais</th>
                  <th class="px-8 py-5 text-right cursor-pointer hover:text-arcane-500" @click="toggleSort('updatedAt')">
                    <div class="flex items-center justify-end gap-2">
                      Ações / Data
                      <BarChart3 v-if="sortBy === 'updatedAt'" class="w-3 h-3" :class="sortOrder === 'asc' ? 'rotate-180' : ''" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                <template v-for="char in paginatedChars" :key="char.id">
                  <tr class="hover:bg-arcane-500/5 dark:hover:bg-arcane-500/5 transition-colors group cursor-pointer" @click="toggleExpand(char.id)">
                    <td class="px-8 py-7">
                      <div class="flex items-center gap-3">
                        <ChevronDown :class="['w-4 h-4 text-neutral-300 transition-transform group-hover:text-arcane-500', expandedChars.has(char.id) ? 'rotate-180 text-arcane-500' : '']" />
                        <div class="flex flex-col">
                          <span class="text-[11px] font-mono font-bold text-arcane-600 dark:text-arcane-400 mb-1 tracking-tight">{{ char.code }}</span>
                          <span class="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-arcane-600 dark:group-hover:text-arcane-300 transition-colors">{{ char.name }}</span>
                          <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[10px] text-neutral-400 dark:text-neutral-600 font-bold uppercase">{{ BASE_RACES.find(r => r.id === char.raceId)?.name }}</span>
                            <template v-if="char.playerDisplayName">
                              <span class="text-[10px] text-neutral-300 dark:text-neutral-700">•</span>
                              <div class="flex items-center gap-1.5 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                                <img v-if="char.playerPhoto" :src="char.playerPhoto" class="w-3 h-3 rounded-full" />
                                <span class="text-[9px] font-black text-neutral-500 uppercase tracking-tighter">{{ char.playerDisplayName }}</span>
                              </div>
                            </template>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-8 py-7 text-center">
                      <span 
                        :class="[
                          'px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-block whitespace-nowrap',
                          char.status === CharacterStatus.AGUARDANDO_VALIDACAO ? 'bg-arcane-500 text-white shadow-lg shadow-arcane-500/20' : 
                          char.status === CharacterStatus.FICHA_FINALIZADA ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                          'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600'
                        ]"
                      >
                        {{ char.status === CharacterStatus.AGUARDANDO_VALIDACAO ? 'EM ANÁLISE' : 
                           char.status === CharacterStatus.FICHA_FINALIZADA ? 'CONSAGRADO' :
                           char.status === CharacterStatus.APROVADO ? 'DISTRIBUINDO' :
                           char.status === CharacterStatus.CRIADO ? 'INICIADO' :
                           char.status.toUpperCase() }}
                      </span>
                    </td>
                    <td class="px-8 py-7">
                      <div v-if="char.rolls" class="flex items-center gap-2">
                        <div class="flex -space-x-2">
                          <div v-for="(roll, rIdx) in char.rolls.raw.slice(0, 3)" :key="rIdx" class="w-7 h-7 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-[10px] font-black text-arcane-500 shadow-sm relative z-10 transition-transform group-hover:-translate-y-1">
                            {{ roll }}
                          </div>
                          <div v-if="char.rolls.raw.length > 3" class="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-[10px] font-black text-neutral-400 shadow-sm">
                            +{{ char.rolls.raw.length - 3 }}
                          </div>
                        </div>
                        <span class="text-[10px] font-black text-neutral-400 ml-2 uppercase">Ver Detalhes</span>
                      </div>
                      <span v-else class="text-[10px] text-neutral-300 dark:text-neutral-800 uppercase font-black italic tracking-widest">Nenhuma rolagem</span>
                    </td>
                    <td class="px-8 py-7">
                       <div v-if="char.attributes" class="flex items-center gap-1">
                         <div v-for="(v, k) in char.attributes" :key="k" class="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[8px] font-black text-neutral-500" :title="k">
                           {{ v }}
                         </div>
                       </div>
                       <span v-else class="text-[10px] text-neutral-300 dark:text-neutral-800 uppercase font-black italic tracking-widest">Pendente</span>
                    </td>
                    <td class="px-8 py-7 text-right">
                      <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <!-- Approval Gates -->
                        <template v-if="char.status === CharacterStatus.AGUARDANDO_VALIDACAO">
                          <button 
                            @click.stop="updateCharStatus(char.id, CharacterStatus.APROVADO)"
                            class="p-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-500 hover:text-white rounded-xl transition-all shadow-sm"
                            title="Aprovar Rolls"
                          >
                            <Check class="w-5 h-5" />
                          </button>
                          <button 
                            @click.stop="updateCharStatus(char.id, CharacterStatus.REJEITADO)"
                            class="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-600 dark:text-red-500 hover:text-white rounded-xl transition-all shadow-sm"
                            title="Rejeitar Rolls"
                          >
                            <X class="w-5 h-5" />
                          </button>
                        </template>
                        
                        <!-- Unlock Gates -->
                        <button 
                          v-if="char.status === CharacterStatus.FICHA_FINALIZADA"
                          @click.stop="updateCharStatus(char.id, CharacterStatus.APROVADO)"
                          class="p-2.5 bg-arcane-500/10 hover:bg-arcane-500 text-arcane-600 dark:text-arcane-400 hover:text-white rounded-xl transition-all group/btn shadow-sm"
                          title="Liberar Redistribuição"
                        >
                          <Pencil class="w-5 h-5" />
                        </button>
  
                        <button 
                          @click.stop="resetRolls(char.id)"
                          class="p-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-xl transition-all shadow-sm"
                          title="Forçar Reroll"
                        >
                          <RotateCcw class="w-5 h-5" />
                        </button>
  
                        <button 
                          @click.stop="deleteChar(char.id)"
                          class="p-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-neutral-400 hover:text-red-500 rounded-xl transition-all shadow-sm"
                          title="Excluir Ficha"
                        >
                          <Trash2 class="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Expanded Detail Row -->
                  <tr v-if="expandedChars.has(char.id)" class="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800 animate-in slide-in-from-top-1">
                    <td colspan="5" class="px-8 py-8">
                      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <!-- Rolls Details -->
                        <div class="space-y-4">
                          <div class="flex items-center justify-between">
                            <h4 class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Dices class="w-4 h-4" /> Detalhamento Arcano
                            </h4>
                            <div class="flex items-center gap-3">
                              <div v-if="char.playerEmail" class="flex flex-col items-end">
                                <span class="text-[8px] font-black text-neutral-400 uppercase tracking-tighter">Aventureiro</span>
                                <span class="text-[9px] font-bold text-neutral-600 dark:text-neutral-400">{{ char.playerEmail }}</span>
                              </div>
                              <div v-if="char.rolls" :class="['px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest', char.rolls.rerollUsed ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500']">
                                Reroll: {{ char.rolls.rerollUsed ? 'Utilizado' : 'Disponível' }}
                              </div>
                            </div>
                          </div>
                          <div v-if="char.rolls" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div v-for="(roll, rIdx) in char.rolls.details" :key="rIdx" class="p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col items-center gap-2">
                              <div class="flex gap-1">
                                <span v-for="(d, dIdx) in roll.dice" :key="dIdx" 
                                  :class="[
                                    'w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold shadow-inner',
                                    d === roll.dropped ? 'bg-red-500/5 text-red-500/30 line-through' : 'bg-neutral-50 dark:bg-neutral-800 text-arcane-500'
                                  ]"
                                >
                                  {{ d }}
                                </span>
                              </div>
                              <div class="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tighter">Soma: {{ roll.total }}</div>
                            </div>
                          </div>
                        </div>

                        <!-- Attributes Breakdown -->
                        <div class="space-y-4 text-center lg:text-left">
                          <h4 class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] flex items-center justify-center lg:justify-start gap-2">
                            <Shapes class="w-4 h-4" /> Distribuição de Poder
                          </h4>
                          <div v-if="char.attributes" class="grid grid-cols-3 gap-4">
                            <div v-for="(v, k) in char.attributes" :key="k" class="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                              <div>
                                <div class="text-[8px] font-black text-neutral-400 uppercase mb-1 flex items-center justify-between">
                                  <span>{{ STAT_LABELS[k as StatType] }}</span>
                                  <span class="text-[7px] font-mono text-neutral-300 dark:text-neutral-700 tracking-tight">{{ k }}</span>
                                </div>
                                <div class="flex items-baseline gap-2.5">
                                  <div class="text-3xl font-rpg font-black text-neutral-900 dark:text-white">{{ v }}</div>
                                  <template v-if="(() => {
                                    const rBreak = getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType];
                                    return rBreak && rBreak.total > 0;
                                  })()">
                                    <span class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 text-[8px] font-black uppercase">
                                      +{{ getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].total }} R
                                    </span>
                                  </template>
                                </div>
                              </div>
                              <div class="mt-2 pt-2 border-t border-neutral-50 dark:border-neutral-900/40 text-left">
                                <div class="text-[10px] font-bold text-arcane-500">{{ getModifierString(calculateModifier(v)) }} Modificador</div>
                                <div v-if="(() => {
                                  const rBreak = getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType];
                                  return rBreak && rBreak.total > 0;
                                })()" class="text-[8px] font-black text-neutral-400 uppercase tracking-wider mt-1 flex flex-wrap items-center gap-1.5 leading-none">
                                  <span class="opacity-60">Base: {{ getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].base }}</span>
                                  <span class="opacity-30">•</span>
                                  <span class="text-emerald-500/90 font-bold">
                                    {{ getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].fixed > 0 ? '+' + getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].fixed + ' Fixo' : '' }}
                                    {{ getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].fixed > 0 && getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].chosen > 0 ? ' & ' : '' }}
                                    {{ getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].chosen > 0 ? '+' + getRacialBonusesBreakdown(char, getCharRace(char))[k as StatType].chosen + ' Escolha' : '' }}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div v-else class="h-full min-h-[160px] border-2 border-dashed border-neutral-100 dark:border-neutral-800/50 rounded-[2rem] flex items-center justify-center">
                            <span class="text-[10px] font-black text-neutral-300 dark:text-neutral-800 uppercase tracking-[0.2em] italic">Aguardando Distribuição Pelo Jogador</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
                <tr v-if="filteredChars.length === 0">
                  <td colspan="5" class="py-32 text-center">
                    <div class="flex flex-col items-center gap-4 opacity-10 dark:opacity-20">
                      <div class="p-6 bg-neutral-200 dark:bg-neutral-800 rounded-full">
                        <Search class="w-16 h-16" />
                      </div>
                      <span class="text-[11px] font-black uppercase tracking-[0.4em]">O vazio não guarda segredos aqui</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination Controls -->
          <div v-if="totalPages > 1" class="flex items-center justify-between px-2">
            <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Mostrando {{ paginatedChars.length }} de {{ filteredChars.length }} resultados
            </p>
            <div class="flex items-center gap-2">
              <button 
                @click="currentPage--" 
                :disabled="currentPage === 1"
                class="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
              <div class="flex gap-1">
                <button 
                  v-for="p in totalPages" 
                  :key="p"
                  @click="currentPage = p"
                  :class="[
                    'w-8 h-8 rounded-lg text-[10px] font-black transition-all',
                    currentPage === p 
                      ? 'bg-arcane-500 text-white shadow-lg shadow-arcane-500/20' 
                      : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400'
                  ]"
                >
                  {{ p }}
                </button>
              </div>
              <button 
                @click="currentPage++" 
                :disabled="currentPage === totalPages"
                class="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft class="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        </div>

        <!-- Races Tab -->
        <div v-else class="space-y-6">
          <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div class="space-y-1">
              <h3 class="text-3xl font-rpg font-black text-neutral-900 dark:text-white uppercase tracking-tighter">GESTÃO DE ALMAS</h3>
              <p class="text-[10px] uppercase text-neutral-400 font-bold tracking-[0.3em]">Controle as sementes da criação em Droop's Dice</p>
            </div>
            
            <div class="flex items-center gap-4 w-full md:w-auto">
              <div class="relative w-full md:w-80">
                <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  v-model="raceSearch"
                  placeholder="Pesquisar raças..."
                  class="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm outline-none transition-all shadow-sm focus:ring-2 focus:ring-arcane-500/10"
                />
              </div>
              <button 
                @click="createNewRace"
                class="px-5 py-3 bg-arcane-600 hover:bg-arcane-500 text-white text-xs font-black rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-arcane-500/10"
              >
                <Plus class="w-4 h-4" />
                NOVA RAÇA
              </button>
            </div>
          </div>

          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden overflow-x-auto shadow-xl rpg-card">
            <table class="w-full text-left border-collapse min-w-[800px]">
              <thead class="bg-neutral-50 dark:bg-neutral-800/50 text-[10px] uppercase font-black tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                <tr>
                  <th class="px-8 py-5">Ancestralidade</th>
                  <th class="px-8 py-5">Bônus</th>
                  <th class="px-8 py-5 text-center">Visibilidade</th>
                  <th class="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                <tr v-for="race in paginatedRaces" :key="race.id" class="hover:bg-arcane-500/5 dark:hover:bg-arcane-500/5 transition-colors group">
                  <td class="px-8 py-6">
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-neutral-900 dark:text-white">{{ race.name }}</span>
                      <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{{ race.source || 'Homebrew' }}</span>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex flex-wrap gap-1.5">
                      <div v-for="(v, k) in race.bonuses" :key="k" class="px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-lg text-[9px] font-bold text-neutral-500">
                        <span class="opacity-50 mr-1">{{ k }}:</span>
                        <span class="text-arcane-600 dark:text-arcane-400">+{{ v }}</span>
                      </div>
                      <div v-if="race.choiceCount" class="px-2 py-1 bg-arcane-500/10 border border-arcane-500/20 rounded-lg text-[9px] font-bold text-arcane-500">
                        +{{ race.choiceCount }} ESCOLHAS
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6 text-center">
                    <button 
                      @click="toggleRaceActive(race.id, race.isActive || false)"
                      :class="[
                        'px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                        race.isActive 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      ]"
                    >
                      {{ race.isActive ? 'ATIVO' : 'OCULTO' }}
                    </button>
                  </td>
                  <td class="px-8 py-6 text-right">
                    <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        @click="editRace(race)"
                        class="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-400 hover:text-arcane-500 hover:bg-arcane-500/5 transition-all"
                        title="Editar"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button 
                        @click="deleteRace(race.id)"
                        class="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/5 transition-all"
                        title="Excluir"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredRaces.length === 0">
                  <td colspan="4" class="py-20 text-center text-neutral-400 uppercase font-black text-[10px] tracking-widest opacity-30">Nenhuma raça encontrada</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Race Pagination Controls -->
          <div v-if="raceTotalPages > 1" class="flex items-center justify-between px-2">
            <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Mostrando {{ paginatedRaces.length }} de {{ filteredRaces.length }} ancestralidades
            </p>
            <div class="flex items-center gap-2">
              <button 
                @click="raceCurrentPage--" 
                :disabled="raceCurrentPage === 1"
                class="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
              <span class="text-[10px] font-black text-neutral-400 px-4">{{ raceCurrentPage }} / {{ raceTotalPages }}</span>
              <button 
                @click="raceCurrentPage++" 
                :disabled="raceCurrentPage === raceTotalPages"
                class="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft class="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <!-- Race Edit Modal -->
      <div v-if="showRaceModal && editingRace" class="fixed inset-0 z-[60] flex items-center justify-center bg-white/80 dark:bg-black/90 backdrop-blur-md p-6">
        <div class="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-200 dark:border-neutral-800 p-10 space-y-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-3xl font-rpg font-black text-neutral-900 dark:text-white uppercase tracking-tighter italic">CONFIGURAR ANCESTRALIDADE</h3>
              <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Defina bônus fixos e opções de escolha</p>
            </div>
            <button @click="showRaceModal = false" class="p-4 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
              <X class="w-6 h-6" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Left Side: Basic Info -->
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Identidade da Raça</label>
                <input v-model="editingRace.name" placeholder="Ex: Humano, Elfo, etc" class="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-arcane-500/20 font-bold" />
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Fonte / Livro</label>
                <input v-model="editingRace.source" placeholder="Ex: PHB, Tasha, Homebrew" class="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-arcane-500/20 font-bold" />
              </div>

              <!-- Race Activation Toggle -->
              <div class="space-y-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Status da Raça</label>
                <button 
                  @click="editingRace.isActive = !editingRace.isActive"
                  type="button"
                  :class="[
                    'w-full px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2',
                    editingRace.isActive 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  ]"
                >
                  <span class="w-2.5 h-2.5 rounded-full animate-pulse" :class="editingRace.isActive ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ editingRace.isActive ? 'Ancestralidade Ativa' : 'Ancestralidade Desativada (Oculta)' }}
                </button>
              </div>

              <div class="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <h4 class="text-[11px] font-black text-arcane-500 uppercase tracking-[0.2em] italic">BÔNUS FIXOS</h4>
                <div class="grid grid-cols-3 gap-3">
                  <div v-for="stat in (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const)" :key="stat" class="space-y-1.5">
                    <label class="text-[8px] font-black text-neutral-400 uppercase text-center block">{{ stat }}</label>
                    <input 
                      type="number" 
                      v-model.number="editingRace.bonuses[stat]" 
                      class="w-full px-2 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-center font-bold focus:border-arcane-500 outline-none transition-all" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Side: Choice System -->
            <div class="p-8 bg-neutral-50 dark:bg-neutral-950 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 space-y-6">
              <h4 class="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest italic flex items-center gap-2">
                <Sparkle class="w-4 h-4 text-arcane-500" />
                SISTEMA DE ESCOLHA
              </h4>
              
              <div class="space-y-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Número de Atributos para Escolher</label>
                  <input 
                    type="number" 
                    v-model.number="editingRace.choiceCount" 
                    class="w-full px-5 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-arcane-500/20" 
                  />
                  <p class="text-[9px] text-neutral-400 italic">Quantos atributos diferentes o jogador pode selecionar para receber bônus.</p>
                </div>

                <!-- Dynamic inputs for individual choice bonuses based on choiceCount -->
                <div v-if="editingRace.choiceCount && editingRace.choiceCount > 0" class="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <label class="text-[10px] font-black text-neutral-450 dark:text-neutral-550 uppercase tracking-widest block">Valores dos Bônus de Escolha</label>
                  <div class="grid grid-cols-2 gap-3">
                    <div v-for="i in editingRace.choiceCount" :key="i" class="space-y-1">
                      <label class="text-[8px] font-black text-neutral-400 uppercase">Escolha {{ i }} (+)</label>
                      <input 
                        type="number" 
                        v-model.number="editingRace.choiceBonuses[i - 1]" 
                        class="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl font-bold text-center outline-none focus:ring-2 focus:ring-arcane-500/20" 
                        placeholder="Ex: 1"
                        @input="() => {
                          if (editingRace.choiceBonuses[i - 1] === undefined || isNaN(editingRace.choiceBonuses[i - 1] as number)) {
                            editingRace.choiceBonuses[i - 1] = 1;
                          }
                          editingRace.choiceBonus = editingRace.choiceBonuses[0] || 1;
                        }"
                      />
                    </div>
                  </div>
                  <p class="text-[8px] text-neutral-400 uppercase tracking-tight">Defina os valores específicos que os atributos selecionados irão receber.</p>
                </div>

                <!-- Fallback single bonus input when choiceCount is active but no individual choice array is set -->
                <div v-else class="space-y-2">
                  <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Valor do Bônus de Escolha</label>
                  <input 
                    type="number" 
                    v-model.number="editingRace.choiceBonus" 
                    class="w-full px-5 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-arcane-500/20" 
                  />
                </div>

                <div class="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Bloquear Escolha em:</label>
                  <div class="grid grid-cols-3 gap-2">
                    <button 
                      v-for="stat in (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const)" 
                      :key="stat"
                      @click="() => {
                        if (!editingRace!.choiceExclude) editingRace!.choiceExclude = [];
                        const idx = editingRace!.choiceExclude.indexOf(stat);
                        if (idx > -1) editingRace!.choiceExclude.splice(idx, 1);
                        else editingRace!.choiceExclude.push(stat);
                      }"
                      :class="[
                        'py-2 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm border-2',
                        editingRace.choiceExclude?.includes(stat) 
                          ? 'border-red-500/50 bg-red-500/10 text-red-600' 
                          : 'border-neutral-50 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-400'
                      ]"
                    >
                      {{ stat }}
                    </button>
                  </div>
                  <p class="text-[8px] text-neutral-400 uppercase tracking-tight">Útil para evitar que o jogador escolha um atributo que já recebeu bônus fixo alto (ex: Meio-Elfo).</p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-4 pt-6">
            <button 
              @click="showRaceModal = false"
              class="flex-1 py-5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-3xl font-black uppercase tracking-widest text-xs transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              Desperdiçar Alterações
            </button>
            <button 
              @click="saveRace"
              class="flex-2 py-5 bg-arcane-600 hover:bg-arcane-500 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl shadow-arcane-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Check class="w-5 h-5" />
              Consagrar Ancestralidade
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.animate-in {
  animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23404040' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 1em;
}
</style>
