// API Types
export interface Modul {
  id?: number;
  naziv: string;
  opis?: string;
  ikona?: string;
  aktivan: boolean;
}

export interface Vlasnik {
  id?: number;
  ime: string;
  email: string;
  lozinka?: string;
  role: 'admin' | 'vlasnik' | 'zaposlenik';
  nadredeni_vlasnik_id?: number | null;
  moduli?: string[]; // Module names assigned to this vlasnik
}

export interface Apartman {
  id?: number;
  vlasnik_id: number;
  ime: string;
  kapacitet: number;
  opis: string;
  creator_id?: number;
  created_at?: string;
}

export interface Restoran {
  id?: number;
  vlasnik_id: number;
  ime: string;
  opis: string;
  rucak_od?: string | null;
  rucak_do?: string | null;
  vecera_od?: string | null;
  vecera_do?: string | null;
  max_osoba_rucak?: number | null;
  max_osoba_vecera?: number | null;
  creator_id?: number;
  created_at?: string;
}

export interface Gost {
  id?: number;
  vlasnik_id: number;
  naziv: string;
  ime_prezime?: string | null;
  email?: string | null;
  telefon?: string | null;
  napomena?: string | null;
  creator_id?: number;
  created_at?: string;
}

export interface StoloviRezervacija {
  id?: number;
  restoran_id: number;
  gost_id: number;
  datum: string; // YYYY-MM-DD
  od_vremena: string; // HH:MM
  do_vremena: string; // HH:MM
  broj_osoba: number;
  status: 'na_čekanju' | 'potvrđena' | 'otkazana';
  napomena?: string | null;
  creator_id?: number;
  created_at?: string;
}

export interface Rezervacija {
  id?: number;
  apartman_id: number;
  gost_id: number;
  od_datuma: string; // YYYY-MM-DD
  do_datuma: string; // YYYY-MM-DD
  cijena: number;
  status: string;  // Required: 'na_čekanju' | 'potvrđena' | 'otkazana'
  napomena?: string | null;
  creator_id?: number;
  created_at?: string;
}

export interface CijenaApartmana {
  id?: number;
  apartman_id: number;
  od_datuma: string;
  do_datuma: string;
  cijena_po_noci: number;
  naziv?: string | null;
  creator_id?: number;
  created_at?: string;
}

export interface Stats {
  vlasnici?: number;
  apartmani: number;
  restorani: number;
  gosti: number;
  rezervacije_apartmana?: number;
  rezervacije_stolova?: number;
}

export interface AuthUser {
  id: number;
  ime: string;
  email: string;
  role: 'admin' | 'vlasnik' | 'zaposlenik';
  moduli: string[]; // Assigned modules: ['apartmani', 'restorani', ...]
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ZaposlenikObjekt {
  id?: number;
  zaposlenik_id: number;
  objekt_type: 'restoran' | 'apartman';
  objekt_id: number;
  can_view: boolean;
  can_edit: boolean;
  can_create: boolean;
  can_delete: boolean;
  creator_id?: number;
  created_at?: string;
}
