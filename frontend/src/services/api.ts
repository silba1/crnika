import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Vlasnik,
  Apartman,
  Restoran,
  Gost,
  StoloviRezervacija,
  Rezervacija,
  CijenaApartmana,
  Stats,
  Modul,
  LoginCredentials,
  AuthUser,
  ZaposlenikObjekt
} from '../types';

const API_BASE_URL = '/api'; // Proxied through Vite

class ApiService {
  private api: AxiosInstance;
  private authEmail: string | null = null;
  private authPassword: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      withCredentials: false, // ✅ Don't send cookies
    });

    // Load saved credentials from localStorage
    const savedEmail = localStorage.getItem('auth_email');
    const savedPassword = localStorage.getItem('auth_password');
    
    if (savedEmail && savedPassword) {
      this.setAuth(savedEmail, savedPassword);
    }

    // Request interceptor - add Basic Auth
    this.api.interceptors.request.use(
      (config) => {
        if (this.authEmail && this.authPassword) {
          const token = btoa(`${this.authEmail}:${this.authPassword}`);
          config.headers.Authorization = `Basic ${token}`;
          console.log('📤 API Request:', config.method?.toUpperCase(), config.url, '(authenticated)');
        } else {
          console.log('📤 API Request:', config.method?.toUpperCase(), config.url, '(NO AUTH)');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          console.error('🚨 401 Unauthorized:', error.config?.url);
          
          // Don't redirect if this is the login endpoint itself
          // (let LoginPage handle the error)
          const isLoginEndpoint = error.config?.url?.includes('/login');
          
          if (!isLoginEndpoint) {
            console.error('🚨 Clearing auth and redirecting to login');
            this.clearAuth();
            window.location.href = '/login';
          } else {
            console.log('ℹ️ Login endpoint returned 401 - letting LoginPage handle it');
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  setAuth(email: string, password: string) {
    this.authEmail = email;
    this.authPassword = password;
    localStorage.setItem('auth_email', email);
    localStorage.setItem('auth_password', password);
  }

  clearAuth() {
    this.authEmail = null;
    this.authPassword = null;
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_password');
  }

  isAuthenticated(): boolean {
    return !!(this.authEmail && this.authPassword);
  }

  // Login - verify credentials and get user info
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    this.setAuth(credentials.email, credentials.password);
    
    try {
      // Call /login endpoint (with Basic Auth) - this will log the login event
      const response = await this.api.post<AuthUser>('/login');
      return response.data;
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  async logout() {
    try {
      // Call /logout endpoint to log the event (before clearing auth)
      await this.api.post('/logout');
    } catch (error) {
      // Ignore errors (e.g., if already logged out)
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Vlasnici
  async getVlasnici(skip = 0, limit = 100): Promise<Vlasnik[]> {
    const response = await this.api.get<Vlasnik[]>('/vlasnici', {
      params: { skip, limit }
    });
    return response.data;
  }

  async getVlasnik(id: number): Promise<Vlasnik> {
    const response = await this.api.get<Vlasnik>(`/vlasnici/${id}`);
    return response.data;
  }

  async createVlasnik(data: Vlasnik): Promise<Vlasnik> {
    const response = await this.api.post<Vlasnik>('/vlasnici', data);
    return response.data;
  }

  async updateVlasnik(id: number, data: Vlasnik): Promise<Vlasnik> {
    const response = await this.api.put<Vlasnik>(`/vlasnici/${id}`, data);
    return response.data;
  }

  async deleteVlasnik(id: number): Promise<void> {
    await this.api.delete(`/vlasnici/${id}`);
  }

  // Moduli
  async getModuli(): Promise<Modul[]> {
    const response = await this.api.get<Modul[]>('/moduli');
    return response.data;
  }

  async getVlasnikModuli(vlasnikId: number): Promise<Modul[]> {
    const response = await this.api.get<Modul[]>(`/vlasnici/${vlasnikId}/moduli`);
    return response.data;
  }

  async assignVlasnikModuli(vlasnikId: number, modulIds: number[]): Promise<void> {
    await this.api.post(`/vlasnici/${vlasnikId}/moduli`, modulIds);
  }

  // Apartmani
  async getApartmani(skip = 0, limit = 100, vlasnikId?: number): Promise<Apartman[]> {
    const response = await this.api.get<Apartman[]>('/apartmani', {
      params: { skip, limit, vlasnik_id: vlasnikId }
    });
    return response.data;
  }

  async getApartman(id: number): Promise<Apartman> {
    const response = await this.api.get<Apartman>(`/apartmani/${id}`);
    return response.data;
  }

  async createApartman(data: Apartman): Promise<Apartman> {
    const response = await this.api.post<Apartman>('/apartmani', data);
    return response.data;
  }

  async updateApartman(id: number, data: Apartman): Promise<Apartman> {
    const response = await this.api.put<Apartman>(`/apartmani/${id}`, data);
    return response.data;
  }

  async deleteApartman(id: number): Promise<void> {
    await this.api.delete(`/apartmani/${id}`);
  }

  // Restorani
  async getRestorani(skip = 0, limit = 100, vlasnikId?: number): Promise<Restoran[]> {
    const response = await this.api.get<Restoran[]>('/restorani', {
      params: { skip, limit, vlasnik_id: vlasnikId }
    });
    return response.data;
  }

  async getRestoran(id: number): Promise<Restoran> {
    const response = await this.api.get<Restoran>(`/restorani/${id}`);
    return response.data;
  }

  async createRestoran(data: Restoran): Promise<Restoran> {
    const response = await this.api.post<Restoran>('/restorani', data);
    return response.data;
  }

  async updateRestoran(id: number, data: Restoran): Promise<Restoran> {
    const response = await this.api.put<Restoran>(`/restorani/${id}`, data);
    return response.data;
  }

  async deleteRestoran(id: number): Promise<void> {
    await this.api.delete(`/restorani/${id}`);
  }

  // Gosti
  async getGosti(skip = 0, limit = 100, search?: string): Promise<Gost[]> {
    const response = await this.api.get<Gost[]>('/gosti', {
      params: { skip, limit, search }
    });
    return response.data;
  }

  async getGost(id: number): Promise<Gost> {
    const response = await this.api.get<Gost>(`/gosti/${id}`);
    return response.data;
  }

  async createGost(data: Gost): Promise<Gost> {
    const response = await this.api.post<Gost>('/gosti', data);
    return response.data;
  }

  async updateGost(id: number, data: Gost): Promise<Gost> {
    const response = await this.api.put<Gost>(`/gosti/${id}`, data);
    return response.data;
  }

  async deleteGost(id: number): Promise<void> {
    await this.api.delete(`/gosti/${id}`);
  }

  // Stolovi Rezervacije
  async getStoloviRezervacije(
    skip = 0,
    limit = 100,
    restoranId?: number,
    status?: string,
    datumOd?: string,
    datumDo?: string
  ): Promise<StoloviRezervacija[]> {
    const response = await this.api.get<StoloviRezervacija[]>('/stolovi-rezervacije', {
      params: {
        skip,
        limit,
        restoran_id: restoranId,
        status,
        datum_od: datumOd,
        datum_do: datumDo
      }
    });
    return response.data;
  }

  async createStoloviRezervacija(data: StoloviRezervacija): Promise<StoloviRezervacija> {
    const response = await this.api.post<StoloviRezervacija>('/stolovi-rezervacije', data);
    return response.data;
  }

  async updateStoloviRezervacija(id: number, data: StoloviRezervacija): Promise<StoloviRezervacija> {
    const response = await this.api.put<StoloviRezervacija>(`/stolovi-rezervacije/${id}`, data);
    return response.data;
  }

  async updateRezervacijaStatus(id: number, status: string): Promise<void> {
    await this.api.patch(`/stolovi-rezervacije/${id}/status`, null, {
      params: { status }
    });
  }

  async deleteStoloviRezervacija(id: number): Promise<void> {
    await this.api.delete(`/stolovi-rezervacije/${id}`);
  }

  async bulkApprovePending(restoranId?: number): Promise<{ message: string }> {
    const response = await this.api.post('/bulk/approve-pending', null, {
      params: { restoran_id: restoranId }
    });
    return response.data;
  }

  // Rezervacije (Apartmani)
  async getRezervacije(
    skip = 0,
    limit = 100,
    apartmanId?: number,
    gostId?: number
  ): Promise<Rezervacija[]> {
    const response = await this.api.get<Rezervacija[]>('/rezervacije', {
      params: { skip, limit, apartman_id: apartmanId, gost_id: gostId }
    });
    return response.data;
  }

  async createRezervacija(data: Rezervacija): Promise<Rezervacija> {
    const response = await this.api.post<Rezervacija>('/rezervacije', data);
    return response.data;
  }

  async updateRezervacija(id: number, data: Rezervacija): Promise<Rezervacija> {
    const response = await this.api.put<Rezervacija>(`/rezervacije/${id}`, data);
    return response.data;
  }

  async deleteRezervacija(id: number): Promise<void> {
    await this.api.delete(`/rezervacije/${id}`);
  }

  async updateApartmanRezervacijaStatus(id: number, status: string): Promise<void> {
    await this.api.patch(`/rezervacije/${id}/status`, null, {
      params: { status }
    });
  }

  // Statistics
  async getStats(): Promise<Stats> {
    const response = await this.api.get<Stats>('/stats/overview');
    return response.data;
  }

  // Audit Log
  async getAuditLog(
    skip = 0,
    limit = 100,
    akcija?: string,
    entitetTip?: string
  ): Promise<any[]> {
    const response = await this.api.get('/audit-log', {
      params: {
        skip,
        limit,
        akcija,
        entitet_tip: entitetTip
      }
    });
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; database: string }> {
    const response = await this.api.get('/health');
    return response.data;
  }

  // Export/Import
  async exportData(): Promise<any> {
    const response = await this.api.get('/export');
    return response.data;
  }

  async importData(data: any): Promise<{ message: string; role: string }> {
    const response = await this.api.post('/import', data);
    return response.data;
  }

  async checkStoloviAvailability(
    restoran_id: number,
    datum: string,
    od_vremena: string,
    do_vremena: string,
    broj_osoba: number,
    exclude_reservation_id?: number
  ): Promise<{
    available: boolean;
    available_seats: number;
    max_capacity: number;
    reserved_seats: number;
    time_slot: string;
    message: string;
  }> {
    const params: any = {
      restoran_id,
      datum,
      od_vremena,
      do_vremena,
      broj_osoba,
    };
    if (exclude_reservation_id) {
      params.exclude_reservation_id = exclude_reservation_id;
    }
    const response = await this.api.post('/stolovi-rezervacije/check-availability', null, { params });
    return response.data;
  }

  // Zaposlenik Objekti (Granular Permissions)
  async getZaposlenikObjekti(zaposlenik_id: number, objekt_type?: string): Promise<ZaposlenikObjekt[]> {
    const params = objekt_type ? { objekt_type } : {};
    const response = await this.api.get(`/zaposlenici/${zaposlenik_id}/objekti`, { params });
    return response.data;
  }

  async createZaposlenikObjekt(zaposlenik_id: number, data: ZaposlenikObjekt): Promise<ZaposlenikObjekt> {
    const response = await this.api.post(`/zaposlenici/${zaposlenik_id}/objekti`, data);
    return response.data;
  }

  async updateZaposlenikObjekt(zaposlenik_id: number, objekt_id: number, data: ZaposlenikObjekt): Promise<ZaposlenikObjekt> {
    const response = await this.api.put(`/zaposlenici/${zaposlenik_id}/objekti/${objekt_id}`, data);
    return response.data;
  }

  async deleteZaposlenikObjekt(zaposlenik_id: number, objekt_id: number): Promise<void> {
    await this.api.delete(`/zaposlenici/${zaposlenik_id}/objekti/${objekt_id}`);
  }

  async bulkAssignZaposlenikObjekti(zaposlenik_id: number, assignments: any[]): Promise<{ message: string }> {
    const response = await this.api.post(`/zaposlenici/${zaposlenik_id}/objekti/bulk`, assignments);
    return response.data;
  }
}

export const api = new ApiService();
export default api;
