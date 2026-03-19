import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types';
import api from '../services/api';
import logger from '../utils/logger';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  _isCheckingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: AuthUser, isAuthenticated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _isCheckingAuth: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const user = await api.login({ email, password });
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Login failed';
          set({ error: errorMessage, isLoading: false, isAuthenticated: false });
          throw error;
        }
      },

      logout: async () => {
        await api.logout();
        set({ user: null, isAuthenticated: false, error: null });
      },

      checkAuth: async () => {
        logger.log('🔍 checkAuth started');

        const state = get();
        if (state._isCheckingAuth) {
          logger.warn('⚠️ checkAuth already running, skipping...');
          return;
        }

        if (state.isAuthenticated && state.user?.id && state.user?.email) {
          logger.log('✅ Already authenticated, skipping checkAuth');
          return;
        }

        set({ isLoading: true, _isCheckingAuth: true });

        const persistedUser = localStorage.getItem('auth-storage');
        if (persistedUser) {
          try {
            const parsed = JSON.parse(persistedUser);
            const user = parsed.state?.user;

            if (user &&
              parsed.state?.isAuthenticated &&
              typeof user === 'object' &&
              user.id &&
              user.email &&
              user.ime) {
              logger.log('💾 Found valid persisted user:', user);
              set({
                user: user,
                isAuthenticated: true,
                isLoading: false,
                _isCheckingAuth: false
              });
              return;
            } else {
              logger.warn('⚠️ Invalid persisted user data, clearing localStorage');
              localStorage.removeItem('auth-storage');
            }
          } catch (e) {
            logger.error('Failed to parse persisted user:', e);
            localStorage.removeItem('auth-storage');
          }
        }

        const isAuth = api.isAuthenticated();
        logger.log('🔑 isAuth:', isAuth);

        if (isAuth) {
          try {
            const email = localStorage.getItem('auth_email');
            logger.log('📧 Email from localStorage:', email);

            if (email) {
              logger.log('📡 Fetching user info from API...');
              const response = await api.getVlasnici(0, 1000);

              if (!Array.isArray(response)) {
                logger.error('❌ Invalid response from getVlasnici - not an array:', response);
                api.logout();
                set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
                return;
              }

              logger.log('👥 Vlasnici response:', response.length, 'users');
              const user = response.find(v => v.email === email);
              logger.log('👤 Found user:', user);

              if (user) {
                set({
                  user: {
                    id: user.id!,
                    ime: user.ime,
                    email: user.email,
                    role: user.role,
                    moduli: user.moduli || []
                  },
                  isAuthenticated: true,
                  isLoading: false,
                  _isCheckingAuth: false
                });
                logger.log('✅ User authenticated successfully');
              } else {
                logger.log('❌ User not found in response');
                api.logout();
                set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
              }
            } else {
              logger.log('❌ No email in localStorage');
              set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
            }
          } catch (error) {
            logger.error('❌ Failed to fetch user info:', error);
            api.logout();
            set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
          }
        } else {
          logger.log('❌ No credentials found');
          set({ isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
        }
      },

      setUser: (user: AuthUser, isAuthenticated: boolean) => {
        set({ user, isAuthenticated, isLoading: false, error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
