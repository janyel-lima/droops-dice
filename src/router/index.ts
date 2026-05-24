import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import MasterView from '@/views/MasterView.vue';
import PlayerFlowView from '@/views/PlayerFlowView.vue';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/master',
      name: 'master',
      component: MasterView,
      beforeEnter: (to, from, next) => {
        const auth = useAuthStore();
        if (!auth.isAdmin && to.query.bypass !== '1') {
          // In a real app we'd redirect or show password prompt
          next();
        } else {
          next();
        }
      }
    },
    {
      path: '/player/:code?',
      name: 'player',
      component: PlayerFlowView
    }
  ]
});

export default router;
