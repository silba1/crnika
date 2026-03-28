---
name: Kreirati task file prije implementacije
description: Uvijek kreirati task file u doc/tasks/ prije nego što se počne implementirati feature
type: feedback
---

Uvijek kreirati task file u `doc/tasks/` **prije** implementacije, ne nakon.

**Why:** Korisnik očekuje da svaki novi feature ili zadatak ima odgovarajući task file koji opisuje što se radi. Ovo je projektna konvencija (postoje 0001, 0002, 0003... task fileovi).

**How to apply:** Kada korisnik zatraži novi feature ili zadatak:
1. Pročitaj postojeće task fileove u `doc/tasks/` da vidiš format i sljedeći broj
2. Kreiraj novi `doc/tasks/XXXX-opis-taska.md` s odgovarajućim sadržajem (cilj, opseg, dijagram, koraci, prihvatni kriteriji)
3. Tek onda implementiraj
