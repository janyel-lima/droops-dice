import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/firebase/config';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { CharacterStatus, type Character, type CharacterAttributes, type CharacterRolls, type RollResult } from '@/types';
import { useAuthStore } from './auth';
import { handleFirestoreError, OperationType } from '@/firebase/firestoreUtils';

export const useCharacterStore = defineStore('character', () => {
  const currentCharacter = ref<Character | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const authStore = useAuthStore();

  const fetchCharacterByCode = async (code: string) => {
    loading.value = true;
    error.value = null;
    
    const path = `characters/${code}`;
    try {
      const characterDoc = await getDoc(doc(db, 'characters', code));
      
      if (characterDoc.exists()) {
        currentCharacter.value = characterDoc.data() as Character;
        setupListener(code);
      } else {
        error.value = 'Personagem não encontrado ou código inválido.';
      }
    } catch (err: any) {
      error.value = 'Falha ao conectar com o plano arcano.';
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      loading.value = false;
    }
  };

  const setupListener = (id: string) => {
    const path = `characters/${id}`;
    onSnapshot(doc(db, 'characters', id), (snapshot) => {
      if (snapshot.exists()) {
        currentCharacter.value = snapshot.data() as Character;
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    });
  };

  const createCharacter = async (data: { name: string; raceId: string; code: string }) => {
    if (!authStore.user) return;
    
    const id = data.code; 
    const path = `characters/${id}`;
    
    try {
      await updateDoc(doc(db, 'characters', id), {
        name: data.name,
        raceId: data.raceId,
        status: CharacterStatus.UTILIZADO,
        userId: authStore.user.uid,
        playerDisplayName: authStore.user.displayName,
        playerEmail: authStore.user.email,
        playerPhoto: authStore.user.photoURL,
        updatedAt: Date.now()
      });
      
      if (currentCharacter.value) {
        currentCharacter.value.name = data.name;
        currentCharacter.value.raceId = data.raceId;
        currentCharacter.value.status = CharacterStatus.UTILIZADO;
        currentCharacter.value.userId = authStore.user.uid;
        currentCharacter.value.playerDisplayName = authStore.user.displayName || undefined;
        currentCharacter.value.playerEmail = authStore.user.email || undefined;
        currentCharacter.value.playerPhoto = authStore.user.photoURL || undefined;
        currentCharacter.value.updatedAt = Date.now();
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const updateStatus = async (status: CharacterStatus) => {
    if (!currentCharacter.value) return;
    const path = `characters/${currentCharacter.value.id}`;
    try {
      await updateDoc(doc(db, 'characters', currentCharacter.value.id), {
        status,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveRolls = async (rolls: number[], details: RollResult[], rerollUsed: boolean) => {
    if (!currentCharacter.value) return;
    const path = `characters/${currentCharacter.value.id}`;
    try {
      await updateDoc(doc(db, 'characters', currentCharacter.value.id), {
        status: CharacterStatus.AGUARDANDO_VALIDACAO,
        rolls: {
          raw: rolls,
          details,
          rerollUsed,
          timestamp: Date.now()
        },
        draftRolls: null,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveDraftRolls = async (rolls: number[], details: RollResult[], rerollUsed: boolean) => {
    if (!currentCharacter.value) return;
    try {
      await updateDoc(doc(db, 'characters', currentCharacter.value.id), {
        draftRolls: {
          raw: rolls,
          details,
          rerollUsed,
          timestamp: Date.now()
        },
        updatedAt: Date.now()
      });
    } catch (err: any) {
      console.error("Draft save failed:", err);
    }
  };

  const saveAttributes = async (attributes: CharacterAttributes) => {
    if (!currentCharacter.value) return;
    const path = `characters/${currentCharacter.value.id}`;
    try {
      await updateDoc(doc(db, 'characters', currentCharacter.value.id), {
        status: CharacterStatus.FICHA_FINALIZADA,
        attributes,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const claimCharacter = async (code: string) => {
    if (!authStore.user) return;
    const path = `characters/${code}`;
    try {
      await updateDoc(doc(db, 'characters', code), {
        userId: authStore.user.uid,
        playerDisplayName: authStore.user.displayName,
        playerEmail: authStore.user.email,
        playerPhoto: authStore.user.photoURL,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const clearCharacter = () => {
    currentCharacter.value = null;
    error.value = null;
  };

  return {
    currentCharacter,
    loading,
    error,
    fetchCharacterByCode,
    claimCharacter,
    createCharacter,
    updateStatus,
    saveRolls,
    saveDraftRolls,
    saveAttributes,
    clearCharacter
  };
});
