import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types';
import api from '../services/api';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  _isCheckingAuth: boolean; // Guard za dupli poziv
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
    console.log('🔍 checkAuth started');
    
    // Guard 1: Prevent concurrent checkAuth calls
    const state = get();
    if (state._isCheckingAuth) {
      console.log('⚠️ checkAuth already running, skipping...');
      return;
    }
    
    // Guard 2: If already authenticated with valid user, skip
    if (state.isAuthenticated && state.user?.id && state.user?.email) {
      console.log('✅ Already authenticated, skipping checkAuth');
      return;
    }
    
    set({ isLoading: true, _isCheckingAuth: true });
    
    // Check if we have persisted user already
    const persistedUser = localStorage.getItem('auth-storage');
    if (persistedUser) {
      try {
        const parsed = JSON.parse(persistedUser);
        const user = parsed.state?.user;
        
        // Validate that user is a valid object with required properties
        if (user && 
            parsed.state?.isAuthenticated && 
            typeof user === 'object' && 
            user.id && 
            user.email && 
            user.ime) {
          console.log('💾 Found valid persisted user:', user);
          set({ 
            user: user, 
            isAuthenticated: true, 
            isLoading: false,
            _isCheckingAuth: false
          });
          return; // ✅ User already loaded from persist
        } else {
          console.warn('⚠️ Invalid persisted user data, clearing localStorage');
          localStorage.removeItem('auth-storage');
        }
      } catch (e) {
        console.error('Failed to parse persisted user:', e);
        localStorage.removeItem('auth-storage');
      }
    }
    
    const isAuth = api.isAuthenticated();
    console.log('🔑 isAuth:', isAuth);
    
    if (isAuth) {
      try {
        const email = localStorage.getItem('auth_email');
        console.log('📧 Email from localStorage:', email);
        
        if (email) {
          console.log('📡 Fetching user info from API...');
          const response = await api.getVlasnici(0, 1000);  // Fetch more users
          
          console.log('🔍 Raw response type:', typeof response);
          console.log('🔍 Raw response:', response);
          
          // Validate response is an array
          if (!Array.isArray(response)) {
            console.error('❌ Invalid response from getVlasnici - not an array:', response);
            api.logout();
            set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
            return;
          }
          
          console.log('👥 Vlasnici response:', response.length, 'users');
          const user = response.find(v => v.email === email);
          console.log('👤 Found user:', user);
          
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
            console.log('✅ User authenticated successfully');
          } else {
            console.log('❌ User not found in response');
            api.logout();
            set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
          }
        } else {
          console.log('❌ No email in localStorage');
          set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
        }
      } catch (error) {
        console.error('❌ Failed to fetch user info:', error);
        api.logout();
        set({ user: null, isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
      }
    } else {
      console.log('❌ No credentials found');
      set({ isAuthenticated: false, isLoading: false, _isCheckingAuth: false });
    }
  },

  setUser: (user: AuthUser, isAuthenticated: boolean) => {
    set({ user, isAuthenticated, isLoading: false, error: null });
  },
}),
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }), // Only persist user and isAuthenticated
    }
  )
);
