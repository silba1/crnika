# Steering dokument — Razvojne smjernice

Ovaj dokument definira pravila i procese koji se moraju poštovati pri svakom planiranju, dokumentiranju i razvoju novih featova.

---

## Pravilo 1 — Generiranje task dokumenata

Svaki novi feature ili veća promjena mora imati vlastiti task dokument u `doc/tasks/` direktoriju **prije nego što se bilo što implementira**.

### Format naziva datoteke

```
doc/tasks/XXXX-kratki-opis-kebab-case.md
```

gdje je `XXXX` četveroznamenkasti redni broj (0001, 0002, 0003...).

### Obvezna struktura svakog task dokumenta

```markdown
# XXXX — Naziv taska

**Status:** Draft | Approved | In Progress | Done | Rejected
**Prioritet:** Visok | Srednji | Nizak
**Datum kreiranja:** YYYY-MM-DD

## 1. Cilj
Kratki opis što i zašto.

## 2. Opseg promjena
Koje datoteke / komponente su zahvaćene.

## 3. Dijagram (Mermaid)
Obavezan dijagram koji vizualizira promjenu (flow, ER, component...).

## 4. Implementacijski koraci
Numerirana lista konkretnih koraka.

## 5. Prihvatni kriteriji
Što mora biti istina da je task završen.

## 6. Napomene / Rizici
Sve što treba biti svjesno pri implementaciji.
```

---

## Pravilo 2 — Odobrenje prije implementacije

**Ništa se ne implementira dok vlasnik projekta ne odobri task dokument.**

Workflow:
1. Claude kreira task dokument sa statusom `Draft`
2. Vlasnik pregledava dokument
3. Vlasnik daje odobrenje (verbalno ili promjenom statusa u `Approved`)
4. Tek tada počinje implementacija — status se mijenja u `In Progress`
5. Po završetku status postaje `Done`

> Pravilo vrijedi za sve promjene koda — bez iznimke, bez preskakanja.

---

## Pravilo 3 — Mermaid dijagrami obavezni

Svaki task dokument mora sadržavati **barem jedan Mermaid dijagram** koji vizualizira:
- Arhitekturnu promjenu (component dijagram)
- Tijek podataka (flowchart ili sequence dijagram)
- Promjenu baze (ER dijagram)
- Ili bilo što relevantno za konkretni task

Dijagrami se pišu direktno u Markdown kao `mermaid` code blokovi.

---

## Pravilo 4 — uv kao package manager

Cijeli projekt koristi **[uv](https://github.com/astral-sh/uv)** kao Python package manager.

- **Nema** `pip install` naredbi
- **Nema** ručnog upravljanja virtualnim okruženjem
- Sve Python ovisnosti se upravljaju kroz `uv`
- Ekvivalentne naredbe:

| Staro (pip)              | Novo (uv)                     |
|--------------------------|-------------------------------|
| `pip install X`          | `uv add X`                    |
| `pip install -r req.txt` | `uv sync`                     |
| `python -m venv venv`    | `uv venv` (automatski)        |
| `python script.py`       | `uv run python script.py`     |
| `requirements.txt`       | `pyproject.toml` + `uv.lock`  |

---

## Sažetak pravila

| # | Pravilo | Obavezno |
|---|---------|----------|
| 1 | Task dokument u `doc/tasks/XXXX-naziv.md` prije implementacije | Da |
| 2 | Odobrenje vlasnika projekta prije početka rada | Da |
| 3 | Mermaid dijagram u svakom task dokumentu | Da |
| 4 | uv kao Python package manager | Da |
