"""
Pydantic Models for Apartmani & Restorani System
Generated from schema.json
"""

from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Optional, Literal
from datetime import datetime, date, time
from enum import Enum


# ============================================
# ENUMS
# ============================================

class Role(str, Enum):
    """User role enumeration"""
    ADMIN = "admin"
    VLASNIK = "vlasnik"
    ZAPOSLENIK = "zaposlenik"
    PUBLIC = "public"


class StatusRezervacije(str, Enum):
    """Reservation status enumeration"""
    NA_CEKANJU = "na_čekanju"
    POTVRDJENA = "potvrđena"
    OTKAZANA = "otkazana"


class TipObroka(str, Enum):
    """Meal type enumeration"""
    RUCAK = "ručak"
    VECERA = "večera"


class AuditAkcija(str, Enum):
    """Audit action enumeration"""
    DODAJ = "dodaj"
    UREDI = "uredi"
    OBRISI = "obrisi"
    PRIJAVA = "prijava"
    ODJAVA = "odjava"


class SpamAction(str, Enum):
    """Spam action enumeration"""
    ATTEMPT = "attempt"
    BLOCKED = "blocked"


class EntitetTip(str, Enum):
    """Entity type for audit log"""
    APARTMAN = "apartman"
    RESTORAN = "restoran"
    GOST = "gost"
    REZERVACIJA = "rezervacija"
    REZERVACIJA_STOLA = "rezervacija_stola"
    CIJENA = "cijena"
    VLASNIK = "vlasnik"
    ZAPOSLENIK = "zaposlenik"
    SPAM_LOG = "spam_log"
    BLOCKED_IPS = "blocked_ips"
    BLOCKED_IP = "blocked_ip"
    AUTH = "auth"


# ============================================
# BASE MODELS
# ============================================

class TimestampMixin(BaseModel):
    """Mixin for created_at timestamp"""
    created_at: Optional[datetime] = Field(default_factory=datetime.now)


class CreatorMixin(BaseModel):
    """Mixin for creator tracking"""
    creator_id: Optional[int] = None


# ============================================
# DOMAIN MODELS
# ============================================

class Modul(BaseModel):
    """
    Module model - represents available system modules
    (e.g., apartmani, restorani, caffebar)
    Admin manages which modules are available
    """
    id: Optional[int] = None
    naziv: str = Field(..., min_length=1, max_length=50, description="Module name (unique)")
    opis: Optional[str] = Field(None, description="Module description")
    ikona: Optional[str] = Field(None, description="Icon name for UI")
    aktivan: bool = Field(default=True, description="Is module active")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "naziv": "apartmani",
                "opis": "Upravljanje apartmanima i rezervacijama apartmana",
                "ikona": "home",
                "aktivan": True
            }
        }


class VlasnikModul(BaseModel):
    """
    Owner-Module relationship (many-to-many)
    Defines which modules an owner/employee has access to
    """
    id: Optional[int] = None
    vlasnik_id: int = Field(..., description="Owner/User ID")
    modul_id: int = Field(..., description="Module ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "vlasnik_id": 2,
                "modul_id": 1
            }
        }


class Vlasnik(BaseModel):
    """
    Owner/User model
    Represents admin, owners (vlasnici), and employees (zaposlenici)
    """
    id: Optional[int] = None
    ime: str = Field(..., min_length=1, max_length=100, description="User name")
    email: EmailStr = Field(..., description="Unique email address")
    lozinka: Optional[str] = Field(None, min_length=6, description="Password (optional for updates)")
    role: Role = Field(..., description="User role")
    tip_vlasnika: TipVlasnika = Field(default=TipVlasnika.APARTMAN, description="Owner type")
    nadredeni_vlasnik_id: Optional[int] = Field(None, description="Parent owner ID (for zaposlenici)")

    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "ime": "Ivan Horvat",
                "email": "ivan@example.com",
                "lozinka": "hashed_password_here",
                "role": "vlasnik",
                "tip_vlasnika": "oboje"
            }
        }


class VlasnikCreate(BaseModel):
    """Model for creating a new Vlasnik - password required"""
    ime: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    lozinka: str = Field(..., min_length=6, description="Password (required for create)")
    role: Role
    tip_vlasnika: TipVlasnika = TipVlasnika.APARTMAN
    nadredeni_vlasnik_id: Optional[int] = None

    class Config:
        use_enum_values = True


class VlasnikUpdate(BaseModel):
    """Model for updating Vlasnik - all fields optional except id"""
    id: int
    ime: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    lozinka: Optional[str] = Field(None, description="Password (optional, null to keep existing)")
    role: Role
    tip_vlasnika: TipVlasnika
    nadredeni_vlasnik_id: Optional[int] = None
    
    @field_validator('lozinka')
    @classmethod
    def validate_password(cls, v):
        # If password is provided (not None), it must be at least 6 chars
        if v is not None and len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

    class Config:
        use_enum_values = True


class Apartman(TimestampMixin, CreatorMixin):
    """
    Apartment model
    Represents rental apartments
    """
    id: Optional[int] = None
    vlasnik_id: int = Field(..., description="Owner ID")
    ime: str = Field(..., min_length=1, max_length=200, description="Apartment name")
    kapacitet: int = Field(..., ge=1, le=100, description="Max capacity")
    opis: str = Field(..., description="Description")

    class Config:
        json_schema_extra = {
            "example": {
                "vlasnik_id": 1,
                "ime": "Apartman Dalmacija",
                "kapacitet": 4,
                "opis": "Lijepo opremljen apartman u centru grada"
            }
        }


class Restoran(TimestampMixin, CreatorMixin):
    """
    Restaurant model
    Represents restaurants with table reservations
    """
    id: Optional[int] = None
    vlasnik_id: int = Field(..., description="Owner ID")
    ime: str = Field(..., min_length=1, max_length=200, description="Restaurant name")
    opis: str = Field(..., description="Description")
    rucak_od: Optional[str] = Field(None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description="Lunch start time (HH:MM)")
    rucak_do: Optional[str] = Field(None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description="Lunch end time (HH:MM)")
    vecera_od: Optional[str] = Field(None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description="Dinner start time (HH:MM)")
    vecera_do: Optional[str] = Field(None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description="Dinner end time (HH:MM)")
    max_osoba_rucak: Optional[int] = Field(None, ge=0, le=500, description="Max lunch capacity")
    max_osoba_vecera: Optional[int] = Field(None, ge=0, le=500, description="Max dinner capacity")

    @field_validator('rucak_do')
    @classmethod
    def validate_lunch_times(cls, v, info):
        """Validate that lunch end time is after start time"""
        if v and 'rucak_od' in info.data and info.data['rucak_od']:
            if v <= info.data['rucak_od']:
                raise ValueError('Lunch end time must be after start time')
        return v

    @field_validator('vecera_do')
    @classmethod
    def validate_dinner_times(cls, v, info):
        """Validate that dinner end time is after start time"""
        if v and 'vecera_od' in info.data and info.data['vecera_od']:
            if v <= info.data['vecera_od']:
                raise ValueError('Dinner end time must be after start time')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "vlasnik_id": 1,
                "ime": "Restoran Dalmacija",
                "opis": "Tradicionalna dalmatinska kuhinja",
                "rucak_od": "12:00",
                "rucak_do": "15:00",
                "vecera_od": "18:00",
                "vecera_do": "22:00",
                "max_osoba_rucak": 50,
                "max_osoba_vecera": 80
            }
        }


class Gost(TimestampMixin, CreatorMixin):
    """
    Guest model
    Shared resource for both apartment and restaurant reservations
    """
    id: Optional[int] = None
    vlasnik_id: int = Field(..., description="Owner ID")
    naziv: str = Field(..., min_length=1, max_length=200, description="Guest name/company")
    ime_prezime: Optional[str] = Field(None, max_length=200, description="Full name")
    email: Optional[EmailStr] = Field(None, description="Email address")
    telefon: Optional[str] = Field(None, pattern=r'^[0-9+\-\s()]+$', description="Phone number")
    napomena: Optional[str] = None

    @model_validator(mode='after')
    def check_contact_info(self):
        """At least one of email or telefon must be provided"""
        if not self.email and not self.telefon:
            raise ValueError('At least one of email or telefon must be provided')
        return self

    class Config:
        json_schema_extra = {
            "example": {
                "vlasnik_id": 1,
                "naziv": "Ivan Horvat",
                "ime_prezime": "Ivan Horvat",
                "email": "ivan@example.com",
                "telefon": "091234567"
            }
        }


class StoloviRezervacija(TimestampMixin, CreatorMixin):
    """
    Table reservation model
    Restaurant table bookings
    """
    id: Optional[int] = None
    restoran_id: int = Field(..., description="Restaurant ID")
    gost_id: int = Field(..., description="Guest ID")
    datum: date = Field(..., description="Reservation date")
    od_vremena: str = Field(..., pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description="Start time (HH:MM)")
    do_vremena: str = Field(..., pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description="End time (HH:MM)")
    broj_osoba: int = Field(..., ge=1, le=100, description="Number of people")
    tip_obroka: TipObroka = Field(..., description="Meal type")
    status: StatusRezervacije = Field(default=StatusRezervacije.NA_CEKANJU, description="Reservation status")
    napomena: Optional[str] = None

    @field_validator('do_vremena')
    @classmethod
    def validate_times(cls, v, info):
        """Validate that end time is after start time"""
        if 'od_vremena' in info.data and v <= info.data['od_vremena']:
            raise ValueError('End time must be after start time')
        return v

    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "restoran_id": 1,
                "gost_id": 1,
                "datum": "2026-01-25",
                "od_vremena": "12:00",
                "do_vremena": "15:00",
                "broj_osoba": 4,
                "tip_obroka": "ručak",
                "status": "na_čekanju"
            }
        }


class Rezervacija(TimestampMixin, CreatorMixin):
    """
    Apartment reservation model
    """
    id: Optional[int] = None
    apartman_id: int = Field(..., description="Apartment ID")
    gost_id: int = Field(..., description="Guest ID")
    od_datuma: date = Field(..., description="Check-in date")
    do_datuma: date = Field(..., description="Check-out date")
    cijena: float = Field(..., ge=0, description="Total price")
    napomena: Optional[str] = None

    @field_validator('do_datuma')
    @classmethod
    def validate_dates(cls, v, info):
        """Validate that check-out is after check-in"""
        if 'od_datuma' in info.data and v <= info.data['od_datuma']:
            raise ValueError('Check-out date must be after check-in date')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "apartman_id": 1,
                "gost_id": 1,
                "od_datuma": "2026-07-01",
                "do_datuma": "2026-07-07",
                "cijena": 420.0,
                "napomena": "Dolazak poslije 18h"
            }
        }


class CijenaApartmana(TimestampMixin, CreatorMixin):
    """
    Apartment pricing model
    Season-based pricing
    """
    id: Optional[int] = None
    apartman_id: int = Field(..., description="Apartment ID")
    od_datuma: date = Field(..., description="Period start date")
    do_datuma: date = Field(..., description="Period end date")
    cijena_po_noci: float = Field(..., ge=0, description="Price per night")
    naziv: Optional[str] = Field(None, max_length=100, description="Season name")

    @field_validator('do_datuma')
    @classmethod
    def validate_dates(cls, v, info):
        """Validate that end date is after start date"""
        if 'od_datuma' in info.data and v <= info.data['od_datuma']:
            raise ValueError('End date must be after start date')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "apartman_id": 1,
                "od_datuma": "2026-07-01",
                "do_datuma": "2026-08-31",
                "cijena_po_noci": 80.0,
                "naziv": "Visoka sezona"
            }
        }


class PostavkeVlasnika(BaseModel):
    """
    Owner settings model
    Customizable settings per owner
    """
    id: Optional[int] = None
    vlasnik_id: int = Field(..., description="Owner ID")
    naziv_aplikacije: str = Field(default="Apartmani", min_length=1, max_length=100)

    class Config:
        json_schema_extra = {
            "example": {
                "vlasnik_id": 1,
                "naziv_aplikacije": "Dalmacija Apartments"
            }
        }


class AuditLog(BaseModel):
    """
    Audit log model
    Tracks all actions in the system
    """
    id: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    korisnik_id: Optional[int] = Field(None, description="User ID (nullable for public iframe)")
    korisnik_ime: str = Field(..., description="User name")
    korisnik_role: Role = Field(..., description="User role")
    akcija: AuditAkcija = Field(..., description="Action type")
    entitet_tip: EntitetTip = Field(..., description="Entity type")
    entitet_id: Optional[int] = Field(None, description="Entity ID")
    entitet_naziv: Optional[str] = None
    detalji: Optional[str] = None
    ip_adresa: Optional[str] = Field(None, description="IP address")

    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "korisnik_id": 1,
                "korisnik_ime": "Ivan Horvat",
                "korisnik_role": "vlasnik",
                "akcija": "dodaj",
                "entitet_tip": "rezervacija_stola",
                "entitet_id": 123,
                "entitet_naziv": "Restoran Dalmacija - Marko Marić",
                "detalji": "2026-01-25 12:00, 4 os., potvrđena",
                "ip_adresa": "192.168.1.100"
            }
        }


class SpamLog(BaseModel):
    """
    Spam log model
    Tracks all iframe booking attempts for rate limiting
    """
    id: Optional[int] = None
    ip_address: str = Field(..., description="IP address")
    restaurant_id: Optional[int] = None
    action: SpamAction = Field(..., description="Spam action")
    reason: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "ip_address": "192.168.1.100",
                "restaurant_id": 1,
                "action": "blocked",
                "reason": "Rate limit exceeded",
                "details": "5 attempts in 5 minutes"
            }
        }


class BlockedIP(BaseModel):
    """
    Blocked IP model
    Stores blocked IP addresses
    """
    id: Optional[int] = None
    ip_address: str = Field(..., description="IP address")
    blocked_at: datetime = Field(default_factory=datetime.now)
    blocked_until: Optional[datetime] = Field(None, description="Block expiration (null = permanent)")
    reason: Optional[str] = None
    attempts_count: int = Field(default=0, ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "ip_address": "192.168.1.100",
                "blocked_at": "2026-01-24T15:30:00",
                "blocked_until": "2026-01-25T15:30:00",
                "reason": "Rate limit exceeded - 5 attempts in 5 minutes",
                "attempts_count": 5
            }
        }


# ============================================
# BULK MODELS (for export/import)
# ============================================

class SystemData(BaseModel):
    """
    Complete system data model
    Used for JSON export/import
    """
    vlasnici: list[Vlasnik] = []
    apartmani: list[Apartman] = []
    restorani: list[Restoran] = []
    gosti: list[Gost] = []
    stolovi_rezervacije: list[StoloviRezervacija] = []
    rezervacije: list[Rezervacija] = []
    cijene_apartmana: list[CijenaApartmana] = []
    postavke_vlasnika: list[PostavkeVlasnika] = []
    audit_log: list[AuditLog] = []
    spam_log: list[SpamLog] = []
    blocked_ips: list[BlockedIP] = []

    class Config:
        json_schema_extra = {
            "description": "Complete system data export"
        }


# ============================================
# USAGE EXAMPLES
# ============================================

if __name__ == "__main__":
    # Example: Create a Vlasnik
    vlasnik = Vlasnik(
        ime="Ivan Horvat",
        email="ivan@example.com",
        lozinka="hashed_password",
        role=Role.VLASNIK,
        tip_vlasnika=TipVlasnika.OBOJE
    )
    print("Vlasnik:", vlasnik.dict())

    # Example: Create a Restoran
    restoran = Restoran(
        vlasnik_id=1,
        ime="Restoran Dalmacija",
        opis="Tradicionalna kuhinja",
        rucak_od="12:00",
        rucak_do="15:00",
        vecera_od="18:00",
        vecera_do="22:00",
        max_osoba_rucak=50,
        max_osoba_vecera=80
    )
    print("Restoran:", restoran.dict())

    # Example: Create a Stolovi Rezervacija
    rezervacija = StoloviRezervacija(
        restoran_id=1,
        gost_id=1,
        datum=date(2026, 1, 25),
        od_vremena="12:00",
        do_vremena="15:00",
        broj_osoba=4,
        tip_obroka=TipObroka.RUCAK
    )
    print("Rezervacija:", rezervacija.dict())

    # Example: Validate JSON data
    import json
    data = {
        "vlasnici": [vlasnik.dict()],
        "restorani": [restoran.dict()],
        "stolovi_rezervacije": [rezervacija.dict()],
        "gosti": [],
        "apartmani": [],
        "rezervacije": [],
        "cijene_apartmana": [],
        "postavke_vlasnika": [],
        "audit_log": [],
        "spam_log": [],
        "blocked_ips": []
    }
    system_data = SystemData(**data)
    print("\nSystem Data Valid:", system_data.dict())
    print("\nJSON Export:")
    print(json.dumps(system_data.dict(), indent=2, default=str))
