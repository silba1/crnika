# Projektni Assessment: Apartmani & Restorani Management System

**Datum:** 2026-03-20
**Verzija:** 1.0.0
**Status:** Produkcijski spreman

---

## 1. Pregled projekta

Full-stack web aplikacija za upravljanje rezervacijama apartmana i restorana s višekorisničkom arhitekturom, granularnim dozvolama i OAuth integracijom.

| Komponenta | Tehnologija |
|------------|-------------|
| Backend    | Python / FastAPI |
| Frontend   | TypeScript / React / Vite |
| Baza       | SQLite |
| Auth       | HTTP Basic Auth + Google OAuth 2.0 |
| UI         | Material-UI (MUI) |
| State      | Zustand |

---

## 2. Arhitektura sustava

```mermaid
graph TB
    subgraph Client["Klijent (Browser)"]
        UI["React SPA\n(TypeScript/Vite)"]
        Store["Zustand Store\n(authStore)"]
        APIService["Axios API Service\n(HTTP Basic Auth)"]
    end

    subgraph Backend["Backend (FastAPI / Python)"]
        FastAPI["FastAPI App\nmain.py"]
        Auth["Auth Middleware\n(Basic Auth / OAuth)"]
        Router["API Router\n(~40 endpoints)"]
        AuditMiddleware["Audit Logger"]
        SpamGuard["Spam / IP Guard"]
    end

    subgraph AuthProviders["Auth Provideri"]
        Google["Google OAuth 2.0\ngoogle-auth"]
        Facebook["Facebook OAuth\n(stub)"]
    end

    subgraph DB["Baza podataka (SQLite)"]
        SQLite[("baza_prod1.db")]
    end

    UI --> Store
    UI --> APIService
    APIService -->|"HTTP / JSON"| FastAPI
    FastAPI --> Auth
    Auth --> Router
    Router --> AuditMiddleware
    Router --> SpamGuard
    Router --> SQLite
    Auth -->|"Google token verify"| Google
    Auth -->|"Facebook token verify"| Facebook
```

---

## 3. Struktura direktorija

```
crnikav1/
├── backend/
│   ├── main.py                  # FastAPI aplikacija (~2591 linija)
│   ├── models.py                # Pydantic modeli i sheme
│   ├── init_db.py               # Inicijalizacija baze
│   ├── migrate_add_status.py    # DB migracija
│   ├── requirements.txt         # Python ovisnosti
│   ├── .env                     # Konfig (Google OAuth)
│   ├── auth/
│   │   ├── base.py              # Apstraktni OAuthProvider
│   │   ├── google.py            # Google OAuth implementacija
│   │   └── facebook.py          # Facebook OAuth (stub)
│   └── baza_prod1.db            # SQLite baza
│
├── frontend/
│   └── src/
│       ├── App.tsx              # Korijenska komponenta / routing
│       ├── main.tsx             # React entry point
│       ├── pages/               # Stranice
│       ├── components/          # Dijelovi UI-a
│       ├── services/api.ts      # Axios HTTP klijent
│       ├── store/authStore.ts   # Zustand auth stanje
│       └── types/index.ts       # TypeScript tipovi
│
├── DEPLOYMENT.md
├── README.md
└── ASSESSMENT.md                # Ovaj dokument
```

---

## 4. Dijagram baze podataka (ER)

```mermaid
erDiagram
    vlasnici {
        int id PK
        text ime
        text email
        text lozinka
        text role
        int nadredeni_vlasnik_id FK
        text auth_provider
        text oauth_id
    }

    moduli {
        int id PK
        text naziv
        text opis
        text ikona
        bool aktivan
    }

    vlasnik_moduli {
        int id PK
        int vlasnik_id FK
        int modul_id FK
    }

    apartmani {
        int id PK
        int vlasnik_id FK
        text ime
        int kapacitet
        text opis
        int creator_id FK
        datetime created_at
    }

    restorani {
        int id PK
        int vlasnik_id FK
        text ime
        text opis
        text rucak_od
        text rucak_do
        text vecera_od
        text vecera_do
        int max_osoba_rucak
        int max_osoba_vecera
        int creator_id FK
        datetime created_at
    }

    gosti {
        int id PK
        int vlasnik_id FK
        text naziv
        text ime_prezime
        text email
        text telefon
        text napomena
        int creator_id FK
        datetime created_at
    }

    rezervacije {
        int id PK
        int apartman_id FK
        int gost_id FK
        text od_datuma
        text do_datuma
        real cijena
        text status
        text napomena
        int creator_id FK
        datetime created_at
    }

    stolovi_rezervacije {
        int id PK
        int restoran_id FK
        int gost_id FK
        text datum
        text od_vremena
        text do_vremena
        int broj_osoba
        text status
        text napomena
        int creator_id FK
        datetime created_at
    }

    cijene_apartmana {
        int id PK
        int apartman_id FK
        text od_datuma
        text do_datuma
        real cijena_po_noci
        text naziv
        int creator_id FK
        datetime created_at
    }

    zaposlenik_objekti {
        int id PK
        int zaposlenik_id FK
        text objekt_type
        int objekt_id
        bool can_view
        bool can_edit
        bool can_create
        bool can_delete
        int creator_id FK
        datetime created_at
    }

    audit_log {
        int id PK
        datetime timestamp
        int korisnik_id FK
        text korisnik_ime
        text korisnik_role
        text akcija
        text entitet_tip
        int entitet_id
        text entitet_naziv
        text detalji
        text ip_adresa
    }

    postavke_vlasnika {
        int id PK
        int vlasnik_id FK
        text naziv_aplikacije
    }

    spam_log {
        int id PK
        text ip_address
        int restaurant_id FK
        text action
        text reason
        text details
        datetime timestamp
    }

    blocked_ips {
        int id PK
        text ip_address
        datetime blocked_at
        datetime blocked_until
        text reason
        int attempts_count
    }

    vlasnici ||--o{ vlasnik_moduli : "ima module"
    moduli ||--o{ vlasnik_moduli : "dodijeljen"
    vlasnici ||--o{ apartmani : "vlasnik"
    vlasnici ||--o{ restorani : "vlasnik"
    vlasnici ||--o{ gosti : "vlasnik"
    vlasnici ||--o{ zaposlenik_objekti : "zaposlenik"
    vlasnici ||--o| postavke_vlasnika : "ima postavke"
    vlasnici }o--o| vlasnici : "nadredeni"
    apartmani ||--o{ rezervacije : "ima rezervacije"
    apartmani ||--o{ cijene_apartmana : "ima cijene"
    restorani ||--o{ stolovi_rezervacije : "ima rezervacije"
    gosti ||--o{ rezervacije : "gost"
    gosti ||--o{ stolovi_rezervacije : "gost"
```

---

## 5. Autentikacija i autorizacija

```mermaid
flowchart TD
    Request["HTTP Request"] --> CheckAuth{"Ima\nAuthorization\nheader?"}

    CheckAuth -->|Da - Basic| DecodeBasic["Decode Base64\nemail:password"]
    CheckAuth -->|Da - Bearer| DecodeOAuth["Decode OAuth token"]
    CheckAuth -->|Ne| Reject401["401 Unauthorized"]

    DecodeBasic --> FindUser["Pretraži bazu\npo emailu"]
    DecodeOAuth --> VerifyProvider{"OAuth\nProvider?"}

    VerifyProvider -->|Google| VerifyGoogle["google-auth\nverify_oauth2_token()"]
    VerifyProvider -->|Facebook| VerifyFacebook["Facebook\n(stub)"]

    VerifyGoogle --> FindUser
    VerifyFacebook --> FindUser

    FindUser --> UserFound{"Korisnik\npostoji?"}
    UserFound -->|Ne| Reject401
    UserFound -->|Da| CheckRole{"Uloga\nkorisnika?"}

    CheckRole -->|admin| AdminAccess["Puni pristup\nsve operacije"]
    CheckRole -->|vlasnik| VlasnikAccess["Vlastiti resursi\n+ zaposlenici"]
    CheckRole -->|zaposlenik| CheckPermissions["Provjeri\nzaposlenik_objekti"]

    CheckPermissions --> GranularCheck{"can_view /\ncan_edit /\ncan_create /\ncan_delete?"}
    GranularCheck -->|Da| Allow["Dozvoli akciju"]
    GranularCheck -->|Ne| Reject403["403 Forbidden"]

    AdminAccess --> Allow
    VlasnikAccess --> Allow
    Allow --> AuditLog["Zapiši u audit_log"]
```

---

## 6. Frontend komponente

```mermaid
graph TB
    subgraph App["App.tsx (React Router)"]
        Router["BrowserRouter"]
    end

    subgraph PublicRoutes["Javne rute"]
        Login["LoginPage\n/login"]
    end

    subgraph ProtectedRoutes["Zaštićene rute (ProtectedRoute)"]
        Dashboard["DashboardPage\n/dashboard"]
        Vlasnici["VlasniciPage\n/vlasnici"]
        Apartmani["ApartmaniPage\n/apartmani"]
        Restorani["RestoraniPage\n/restorani"]
        Gosti["GostiPage\n/gosti"]
        Rezervacije["RezervacijePage\n/rezervacije"]
        StoloviRez["StoloviRezervacijePage\n/stolovi-rezervacije"]
        AuditLog["AuditLogPage\n/audit-log"]
        Settings["SettingsPage\n/settings"]
    end

    subgraph SharedComponents["Dijeljene komponente"]
        Layout["Layout.tsx\n(navigacija + sidebar)"]
        ProtectedRoute["ProtectedRoute.tsx\n(auth guard)"]
        GoogleBtn["GoogleLoginButton.tsx"]
        PermDialog["ManageZaposlenikPermissionsDialog.tsx"]
    end

    subgraph Services["Servisi"]
        ApiService["api.ts\n(Axios instance)"]
        AuthStore["authStore.ts\n(Zustand)"]
        Logger["logger.ts"]
    end

    Router --> Login
    Router --> ProtectedRoute
    ProtectedRoute --> Layout
    Layout --> Dashboard
    Layout --> Vlasnici
    Layout --> Apartmani
    Layout --> Restorani
    Layout --> Gosti
    Layout --> Rezervacije
    Layout --> StoloviRez
    Layout --> AuditLog
    Layout --> Settings

    Login --> GoogleBtn
    Login --> AuthStore
    Vlasnici --> PermDialog
    Dashboard --> ApiService
    Apartmani --> ApiService
    Restorani --> ApiService
    Gosti --> ApiService
    Rezervacije --> ApiService
    StoloviRez --> ApiService
    ApiService --> AuthStore
```

---

## 7. API endpoint mapa

```mermaid
graph LR
    subgraph Auth["Auth"]
        A1["POST /login"]
        A2["POST /logout"]
        A3["POST /auth/oauth/google"]
    end

    subgraph Users["Korisnici"]
        U1["GET /vlasnici"]
        U2["GET /vlasnici/:id"]
        U3["POST /vlasnici"]
        U4["PUT /vlasnici/:id"]
        U5["DELETE /vlasnici/:id"]
    end

    subgraph Modules["Moduli"]
        M1["GET /moduli"]
        M2["GET /vlasnici/:id/moduli"]
        M3["POST /vlasnici/:id/moduli"]
    end

    subgraph Permissions["Dozvole zaposlenika"]
        P1["GET /zaposlenici/:id/objekti"]
        P2["POST /zaposlenici/:id/objekti"]
        P3["PUT /zaposlenici/:id/objekti/:oid"]
        P4["DELETE /zaposlenici/:id/objekti/:oid"]
        P5["POST /zaposlenici/:id/objekti/bulk"]
    end

    subgraph Apartments["Apartmani"]
        AP1["GET /apartmani"]
        AP2["POST /apartmani"]
        AP3["PUT /apartmani/:id"]
        AP4["DELETE /apartmani/:id"]
    end

    subgraph Restaurants["Restorani"]
        R1["GET /restorani"]
        R2["POST /restorani"]
        R3["PUT /restorani/:id"]
        R4["DELETE /restorani/:id"]
    end

    subgraph Guests["Gosti"]
        G1["GET /gosti"]
        G2["POST /gosti"]
        G3["PUT /gosti/:id"]
        G4["DELETE /gosti/:id"]
    end

    subgraph AptRes["Rezervacije apartmana"]
        AR1["GET /rezervacije"]
        AR2["POST /rezervacije"]
        AR3["PUT /rezervacije/:id"]
        AR4["DELETE /rezervacije/:id"]
        AR5["PATCH /rezervacije/:id/status"]
    end

    subgraph TableRes["Rezervacije stolova"]
        TR1["GET /stolovi-rezervacije"]
        TR2["POST /stolovi-rezervacije"]
        TR3["PUT /stolovi-rezervacije/:id"]
        TR4["DELETE /stolovi-rezervacije/:id"]
        TR5["PATCH /stolovi-rezervacije/:id/status"]
        TR6["POST /stolovi-rezervacije/check-availability"]
        TR7["POST /bulk/approve-pending"]
    end

    subgraph Pricing["Cijene"]
        C1["GET /cijene/:apartman_id"]
        C2["POST /cijene"]
        C3["PUT /cijene/:id"]
        C4["DELETE /cijene/:id"]
    end

    subgraph System["Sustav"]
        S1["GET /stats/overview"]
        S2["GET /audit-log"]
        S3["GET /export"]
        S4["POST /import"]
        S5["GET /health"]
    end
```

---

## 8. Tijek rezervacije apartmana

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant DB as SQLite

    FE->>API: GET /gosti (pretraži gosta)
    API->>DB: SELECT * FROM gosti WHERE ...
    DB-->>API: Lista gostiju
    API-->>FE: JSON gosti

    FE->>API: GET /apartmani (lista apartmana)
    API->>DB: SELECT * FROM apartmani WHERE vlasnik_id=...
    DB-->>API: Lista apartmana
    API-->>FE: JSON apartmani

    FE->>API: GET /cijene/{apartman_id} (cijene po sezoni)
    API->>DB: SELECT * FROM cijene_apartmana WHERE apartman_id=...
    DB-->>API: Cjenik
    API-->>FE: JSON cijene

    Note over FE: Korisnik unosi datum i bira gosta

    FE->>API: POST /rezervacije
    API->>DB: SELECT rezervacije WHERE apartman_id=... (provjera dostupnosti)
    DB-->>API: Postojeće rezervacije

    alt Slobodan termin
        API->>DB: INSERT INTO rezervacije (status='na_čekanju')
        DB-->>API: Nova rezervacija
        API->>DB: INSERT INTO audit_log
        API-->>FE: 201 Created - Rezervacija kreirana
    else Zauzet termin
        API-->>FE: 409 Conflict - Termin zauzet
    end

    FE->>API: PATCH /rezervacije/{id}/status (potvrdi)
    API->>DB: UPDATE rezervacije SET status='potvrđena'
    API->>DB: INSERT INTO audit_log
    API-->>FE: 200 OK
```

---

## 9. Uloge i dozvole

```mermaid
graph TD
    Admin["admin\n(puni pristup)"]
    Vlasnik["vlasnik\n(vlastiti resursi)"]
    Zaposlenik["zaposlenik\n(granularne dozvole)"]

    Admin -->|"Može kreirati"| Vlasnik
    Admin -->|"Upravlja svim"| AllModules["Svi moduli\nSvi korisnici\nSvi objekti"]

    Vlasnik -->|"Može kreirati"| Zaposlenik
    Vlasnik -->|"Upravlja"| OwnModules["Vlastiti apartmani\nVlastiti restorani\nVlastiti gosti"]
    Vlasnik -->|"Dodjeljuje dozvole"| ZaposlenikPerms["zaposlenik_objekti\n(per-objekt dozvole)"]

    Zaposlenik -->|"can_view"| ViewPerms["Pregled\n(read-only)"]
    Zaposlenik -->|"can_edit"| EditPerms["Uređivanje"]
    Zaposlenik -->|"can_create"| CreatePerms["Kreiranje"]
    Zaposlenik -->|"can_delete"| DeletePerms["Brisanje"]

    ZaposlenikPerms --> ViewPerms
    ZaposlenikPerms --> EditPerms
    ZaposlenikPerms --> CreatePerms
    ZaposlenikPerms --> DeletePerms
```

---

## 10. Stack ovisnosti

```mermaid
graph TB
    subgraph BackendDeps["Backend ovisnosti"]
        FastAPI_dep["fastapi==0.115.0"]
        Uvicorn["uvicorn==0.32.0"]
        Pydantic["pydantic==2.9.2"]
        PydanticSettings["pydantic-settings==2.6.0"]
        Passlib["passlib[bcrypt]"]
        GoogleAuth["google-auth==2.27.0"]
        EmailValidator["email-validator==2.2.0"]
        PythonMultipart["python-multipart==0.0.12"]
        PythonDotenv["python-dotenv==1.0.0"]
    end

    subgraph FrontendDeps["Frontend ovisnosti"]
        React["react@18.3.1"]
        ReactRouter["react-router-dom@6.22.0"]
        MUI["@mui/material@5.15.14"]
        Axios["axios@1.6.7"]
        Zustand["zustand@4.5.2"]
        ReactHookForm["react-hook-form@7.51.0"]
        DateFns["date-fns@3.3.1"]
        GoogleOAuth["@react-oauth/google@0.12.1"]
        Vite["vite@5.1.6"]
        TypeScript["typescript@5.4.2"]
    end
```

---

## 11. Sigurnosni aspekti

```mermaid
mindmap
  root((Sigurnost))
    Autentikacija
      HTTP Basic Auth
      Google OAuth 2.0
      Bcrypt hashing
      Facebook OAuth stub
    Autorizacija
      RBAC 3 uloge
      Vlasništvo resursa
      Granularne dozvole
      Modul sistem
    Zaštita od napada
      IP blokiranje
      Spam detekcija
      Rate limiting za iframe
      Audit log svake akcije
    Podaci
      Pydantic validacija
      Email validacija
      SQLite constraints
      CORS konfiguracija
```

---

## 12. Sažetak i preporuke

### Snage
- Kompletna CRUD funkcionalnost za sve entitete
- Granularne dozvole na razini pojedinog objekta
- Sveobuhvatno audit logiranje
- Višestruki načini prijave (password + OAuth)
- Multi-tenant arhitektura

### Potencijalna poboljšanja
| Prioritet | Poboljšanje | Razlog |
|-----------|-------------|--------|
| Visok | Migracija na PostgreSQL | SQLite nije optimalan za produkciju s više korisnika |
| Visok | JWT tokeni umjesto Basic Auth | Sigurniji, standardniji pristup |
| Srednji | Refresh tokeni za OAuth sessione | Trenutni `oauth_<timestamp>` token je nestandardan |
| Srednji | Alembic migracije | Upravljanje shemom baze bez ručnih skripti |
| Nizak | Facebook OAuth implementacija | Stub nije funkcionalan |
| Nizak | E-mail notifikacije | Obavijesti za rezervacije |
| Nizak | Redis cache | Caching za statistike i popise |

---

*Generirano: 2026-03-20 | crnikav1 v1.0.0*
