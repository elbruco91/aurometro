# Aurometro

Rompighiaccio da proiettare in aula. Il formatore dà e toglie **aura** alle squadre in base a come rispondono. A ogni cambio di livello il personaggio della squadra si trasforma, e a fine partita si scopre chi ha l'aura più alta.

Grafica retro pixel: sfondo nero, testi bianchi. Si gestisce tutto con il mouse, con i tasti come alternativa.

---

## Come si gioca

1. **Nuova partita**: scegli quante squadre (da 1 a 4) e, se vuoi, cambia i nomi. Poi **VIA!**
2. Fai una domanda a voce. La squadra di turno risponde.
3. Dai o togli aura con **+ AURA** e **- AURA**. Ogni clic vale 1 punto, cioè 1.000 aura a schermo. Si può andare in negativo.
4. Il numero dell'aura cambia subito. Il personaggio si trasforma **1,5 secondi dopo l'ultimo clic**, così puoi dare +3 di fila senza vedere tre trasformazioni.
5. Con più squadre, passa il turno quando vuoi tu. Puoi anche cliccare direttamente sulla colonna di una squadra.
6. **FINE**: parte la rivelazione finale. Con più squadre vince chi ha più aura.

**Chi è di turno** ha il bordo spesso, la freccia ▶, la scritta "TOCCA A VOI" e l'aura accesa. Le altre squadre hanno l'aura spenta.

### Personaggi e punteggio (set base)

| Punti | Personaggio |
|---|---|
| da −20 in giù | 10° personaggio "debito di aura" (resta quello) |
| da −20 a −1 | 10 personaggi negativi, uno ogni 2 punti |
| 0 | personaggio zero |
| da 1 a 20 | 10 personaggi positivi, uno ogni 2 punti |
| oltre 20 | resta il personaggio 19–20 |
| **20 o più a fine partita** | **personaggio segreto**, visibile solo nella rivelazione finale |

Soglie e percentuali non si vedono mai: la classe vede solo il personaggio e l'aura.

### Comandi

| Azione | Mouse | Tasto |
|---|---|---|
| Dai aura | + AURA | `+` oppure `↑` |
| Togli aura | - AURA | `-` oppure `↓` |
| Passa turno (solo con 2+ squadre) | PASSA TURNO | `Tab` oppure `→` |
| Scegli la squadra di turno | clic sulla colonna | `1` `2` `3` `4` |
| Annulla l'ultima azione | ANNULLA | `Z` |
| Fine partita e rivelazione | FINE | `F` |
| Esci (salvando o senza salvare) | ESCI | `Esc` |
| Nascondi/mostra i comandi | NASCONDI | `H` |

**Annulla** funziona anche dopo FINE e riporta alla partita. La cronologia di annulla si azzera quando esci.

### Salvataggio

La partita si salva da sola nel browser a ogni azione. Da ESCI scegli:
- **Salva ed esci**: in home compare **Riprendi partita**.
- **Esci senza salvare**: la partita viene cancellata.

C'è un solo salvataggio: una nuova partita sostituisce quella salvata, e il gioco lo chiede prima. Se il browser blocca il salvataggio (per esempio in navigazione privata) si gioca normalmente, ma senza "Riprendi".

---

## Come si avvia in aula

- **Online (consigliato):** apri il link di GitHub Pages, poi schermo intero con `F11`.
- **Offline dal computer:** apri `index.html` con doppio clic. In questo caso il browser non legge da solo il file dei personaggi: premi **CARICA PERSONAGGI (JSON)** e scegli `contenuti/personaggi.json`. Nota: aperte così, le immagini PNG funzionano solo se la cartella è intatta.
- Senza internet i font pixel non si caricano e viene usato un font di riserva. Il gioco funziona lo stesso.

---

## Come cambiare i personaggi

Tutto è in `contenuti/personaggi.json`. Per aggiungere le immagini:

1. Metti i PNG in `contenuti/img/` (es. `contenuti/img/boss-finale.png`).
2. Nel JSON scrivi il percorso nel campo `immagine` del personaggio: `"immagine": "contenuti/img/boss-finale.png"`.
3. Se un'immagine manca o il percorso è sbagliato, compare il segnaposto pixel: il gioco non si blocca.

Puoi anche preparare file diversi (es. `personaggi-cyber.json`) e caricarli in aula con **CARICA PERSONAGGI**.

### Specifiche dei PNG
Nella cartella `contenuti/img/` ci sono già 22 segnaposto con i nomi giusti (es. `p05-shrek.png`): per mettere la grafica vera basta **sostituire il file tenendo lo stesso nome**, senza toccare il JSON.

- Tela **128×160 px** (proporzione 4:5), sfondo trasparente, stessa tela per tutti.
- Piedi a filo del bordo basso, figura centrata, circa 16 px liberi sopra la testa.
- Pixel art vera: colori pieni, niente sfumature, niente anti-aliasing.
- **Niente aura nel disegno**: fiamme e particelle le aggiunge il gioco.
- Vanno bene anche GIF animate con gli stessi criteri.
- Se il PNG arriva da un generatore di immagini, riducilo a 128×160 con ridimensionamento **nearest neighbor** (es. Piskel o Lospec), altrimenti i pixel risultano irregolari.

### Schema del JSON

```json
{
  "titolo": "Set base",
  "personaggi": [
    { "da": -2, "a": -1, "nome": "Leggermente sotto zero", "frase": "Recuperabile. Forse.", "immagine": "" },
    { "da": 0, "a": 0, "nome": "NPC del parcheggio", "frase": "Esiste. Tecnicamente.", "immagine": "contenuti/img/npc.png" },
    { "da": 1, "a": 2, "nome": "Comparsa sullo sfondo", "frase": "Inquadrato per sbaglio.", "colore": "#6aa8ff" }
  ],
  "segreto": { "nome": "Aura infinita", "frase": "Nessuno era pronto.", "immagine": "" }
}
```

| Campo | Obbligatorio | Cosa fa |
|---|---|---|
| `titolo` | no | Nome del set, mostrato in home |
| `personaggi` | **sì** | Elenco dei personaggi, in qualsiasi ordine |
| `da` | **sì** | Primo punteggio del personaggio (numero intero, anche negativo) |
| `a` | no | Ultimo punteggio del personaggio. Se manca vale come `da` (un solo punto) |
| `nome` | **sì** | Appare nella nuvoletta alla trasformazione |
| `frase` | no | Battuta sotto al nome |
| `immagine` | no | Percorso del PNG/GIF. Vuoto = segnaposto pixel |
| `colore` | no | Colore dell'aura, formato `#ffcc00`. Se manca, viene scelto in base al livello |
| `segreto` | no | Personaggio finale per chi chiude con il punteggio massimo (l'`a` più alto) o più |

**Regole:** gli intervalli `da`–`a` devono coprire tutti i punteggi senza buchi né sovrapposizioni. Sotto il primo personaggio resta il primo, sopra l'ultimo resta l'ultimo. Se qualcosa non va, la home mostra l'errore in chiaro, tipo "Nessun personaggio copre il punteggio 7".

### Impostazioni rapide
In cima ad `app.js`, nell'oggetto `CONFIG`:
- `ritardoTrasformazione`: attesa dopo l'ultimo clic prima della trasformazione (ms)
- `durataNuvoletta`: quanto resta visibile il nome del personaggio (ms)
- `durataSuspenseFinale`: durata della carica prima della rivelazione (ms)
- `moltiplicatoreAura`: quanta aura vale 1 punto

---

## Pubblicare su GitHub Pages

1. Su GitHub crea un repository (es. `aurometro`), pubblico.
2. **Add file → Upload files**: trascina `index.html`, `style.css`, `app.js`, `README.md` e la cartella `contenuti` intera. **Commit changes**.
3. **Settings → Pages**: in "Branch" scegli `main` e `/ (root)`, poi **Save**.
4. Dopo 1–2 minuti il gioco è su `https://elbruco91.github.io/aurometro/`.

Per aggiornare: carica di nuovo i file modificati con **Upload files** (sovrascrivono i vecchi). Se in aula vedi ancora la versione vecchia, ricarica con `Ctrl+F5`.
