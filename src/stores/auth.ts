import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { auth, db } from '@/firebase/config';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  type User 
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(true);
  const isAdmin = ref(false);
  const adminUnsubscribe = ref<(() => void) | null>(null);

  const checkAdminStatus = (uid: string) => {
    if (adminUnsubscribe.value) adminUnsubscribe.value();
    
    adminUnsubscribe.value = onSnapshot(doc(db, 'admins', uid), (doc) => {
      isAdmin.value = doc.exists();
    }, (err) => {
      console.warn('Admin check failed:', err);
      isAdmin.value = false;
    });
  };

  const init = () => {
    return new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (u) => {
        user.value = u;
        if (u) {
          checkAdminStatus(u.uid);
        } else {
          isAdmin.value = false;
          if (adminUnsubscribe.value) adminUnsubscribe.value();
        }
        loading.value = false;
        resolve();
      });
    });
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return {
    user,
    loading,
    isAdmin,
    init,
    loginWithGoogle,
    logout
  };
});
