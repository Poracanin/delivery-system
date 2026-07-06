# Mapa modulů

Interaktivní síť modulů ve stylu grafu Obsidianu — vizuální „nástěnka", kde
spravuješ moduly systému (Web, Správa objednávek, Rozvoz, Profil uživatele,
Zóny, Profil zaměstnance…) a propojení mezi nimi: **které soubory je
propojují a za co vazba zodpovídá**.

Čisté HTML + CSS + JS, bez závislostí a bez buildu.

## Spuštění

Stačí otevřít `index.html` v prohlížeči, případně:

```bash
cd module-map
python3 -m http.server 8000
# → http://localhost:8000
```

## Ovládání

| Akce | Jak |
|---|---|
| Přidat modul | tlačítko **＋ Modul**, klávesa **N**, nebo dvojklik na plátno |
| Propojit moduly | tažení ze žlutého **＋** na okraji karty, nebo režim **Propojit** (**C**) |
| Upravit modul / vazbu | kliknutí → panel vpravo (název, kategorie, barva, soubory, zodpovědnost) |
| Posun plátna | tažení prázdné plochy |
| Zoom | kolečko myši, nebo ovládání vlevo dole (**F** = zobrazit vše) |
| Smazat | **Delete** / tlačítko Smazat v panelu |
| Uspořádat | tlačítko **Uspořádat** — rozmístí moduly do elipsy |

## Export

Menu **Export** vpravo nahoře:

- **PNG** — ostrý obrázek celé sítě (2× rozlišení) včetně pozadí,
- **PDF** — jednostránkový dokument se sítí (vlastní generátor, bez knihoven),
- **JSON** — záloha dat; zpět načteš přes **Import JSON**.

Vše se průběžně ukládá do `localStorage`, takže síť po obnovení stránky
zůstává. **Obnovit ukázku** vrátí výchozí síť delivery systému.
