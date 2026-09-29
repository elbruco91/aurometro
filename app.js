'use strict';
/* =========================================================
   AUROMETRO — logica di gioco
   Vanilla JS, nessuna libreria. I personaggi arrivano da
   contenuti/personaggi.json (vedi README per lo schema).
   ========================================================= */

/* ---------- Impostazioni che puoi modificare ---------- */
const CONFIG = {
  fileContenuti: 'contenuti/personaggi.json',
  ritardoTrasformazione: 1500, // ms dopo l'ultimo +/- prima che il personaggio cambi
  durataNuvoletta: 3000,       // ms in cui resta visibile la nuvoletta col nome
  durataSuspenseFinale: 2500,  // ms di "carica" prima della rivelazione finale
  moltiplicatoreAura: 1000,    // 1 punto = 1.000 aura a schermo
  chiaveSalvataggio: 'aurometro.partita.v1',
  maxSquadre: 4,
  lunghezzaMaxNome: 16
};

const NOMI_DEFAULT = ['SQUADRA A', 'SQUADRA B', 'SQUADRA C', 'SQUADRA D'];

/* ---------- Stato del gioco ---------- */
let personaggi = null;   // { titolo, lista, segreto, minPunti, maxPunti }
let stato = null;        // { squadre: [{ nome, punti }], turno, fase: 'gioco' | 'finale' }
let storia = [];         // copie dello stato, per "annulla"
let numeroScelto = 1;    // squadre scelte nella schermata di impostazione
let schermata = 'home';
let dialogoAperto = false;
let timerAvviso = null;
let timerFinale = null;
const timerTrasforma = []; // uno per squadra
const timerNuvoletta = []; // uno per squadra
const pgVisibile = [];     // personaggio attualmente a schermo per ogni squadra

const $ = (id) => document.getElementById(id);

/* =========================================================
   SALVATAGGIO (localStorage, sempre dentro try/catch)
   Se il browser non lo permette, il gioco funziona lo stesso.
   ========================================================= */
const memoria = {
  disponibile() {
    try {
      const k = '__aurometro_prova';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  },
  leggi() {
    try {
      const testo = localStorage.getItem(CONFIG.chiaveSalvataggio);
      return testo ? JSON.parse(testo) : null;
    } catch (e) { return null; }
  },
  scrivi(dati) {
    try { localStorage.setItem(CONFIG.chiaveSalvataggio, JSON.stringify(dati)); } catch (e) { /* niente salvataggio */ }
  },
  cancella() {
    try { localStorage.removeItem(CONFIG.chiaveSalvataggio); } catch (e) { /* niente da fare */ }
  }
};

// Controlla che una partita salvata sia leggibile (evita crash con dati vecchi o rovinati)
function statoValido(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.squadre)) return false;
  if (s.squadre.length < 1 || s.squadre.length > CONFIG.maxSquadre) return false;
  if (!s.squadre.every((q) => q && typeof q.nome === 'string' && Number.isInteger(q.punti))) return false;
  if (!Number.isInteger(s.turno) || s.turno < 0 || s.turno >= s.squadre.length) return false;
  return s.fase === 'gioco' || s.fase === 'finale';
}

function salvaPartita() {
  if (stato) memoria.scrivi(stato);
}

/* =========================================================
   CARICAMENTO E VALIDAZIONE DEI PERSONAGGI
   ========================================================= */
const COLORE_VALIDO = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Colore dell'aura se nel JSON non è indicato
function coloreDefault(da, a) {
  if (a < 0) return '#b45cff';   // debito di aura: viola
  if (a === 0) return '#8a8a8a'; // personaggio zero: grigio
  if (a <= 6) return '#6aa8ff';  // azzurro
  if (a <= 12) return '#3ee0a8'; // verde acqua
  if (a <= 16) return '#ffc53a'; // giallo
  return '#ff6b3a';              // arancio
}

// Restituisce un elenco di errori scritti per il formatore, non per il programmatore
function validaPersonaggi(dati) {
  const errori = [];
  if (!dati || typeof dati !== 'object' || Array.isArray(dati)) {
    return ['Il file deve contenere un oggetto JSON, cioè iniziare con { e finire con }.'];
  }
  if (!Array.isArray(dati.personaggi)) {
    return ['Manca l\'elenco "personaggi" (una lista tra parentesi quadre [ ]).'];
  }
  if (dati.personaggi.length === 0) {
    return ['L\'elenco "personaggi" è vuoto: serve almeno un personaggio.'];
  }

  const intervalli = [];
  dati.personaggi.forEach((p, i) => {
    const et = `Il personaggio n. ${i + 1}`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errori.push(`${et} non è scritto correttamente (deve essere tra parentesi graffe { }).`);
      return;
    }
    const nomeOk = typeof p.nome === 'string' && p.nome.trim() !== '';
    if (!nomeOk) errori.push(`${et} non ha il campo "nome".`);
    const etNome = nomeOk ? `${et} ("${p.nome.trim()}")` : et;

    let intervalloOk = true;
    if (p.da === undefined) { errori.push(`${etNome} non ha il campo "da".`); intervalloOk = false; }
    else if (!Number.isInteger(p.da)) { errori.push(`${etNome}: "da" deve essere un numero intero senza virgolette (es. 3 oppure -4).`); intervalloOk = false; }
    if (p.a !== undefined && !Number.isInteger(p.a)) { errori.push(`${etNome}: "a" deve essere un numero intero senza virgolette.`); intervalloOk = false; }
    if (intervalloOk) {
      const a = p.a === undefined ? p.da : p.a;
      if (a < p.da) errori.push(`${etNome}: "a" (${a}) è più piccolo di "da" (${p.da}).`);
      else intervalli.push({ da: p.da, a, et: etNome });
    }
    controllaCampiFacoltativi(p, etNome, errori);
  });

  // Gli intervalli devono coprire tutti i punteggi, senza buchi e senza sovrapposizioni
  intervalli.sort((x, y) => x.da - y.da);
  for (let k = 1; k < intervalli.length; k++) {
    const prima = intervalli[k - 1];
    const dopo = intervalli[k];
    if (dopo.da <= prima.a) {
      errori.push(`${prima.et} e ${dopo.et.charAt(0).toLowerCase() + dopo.et.slice(1)} coprono gli stessi punteggi.`);
    } else if (dopo.da > prima.a + 1) {
      const buco = dopo.da - 1 === prima.a + 1 ? `${prima.a + 1}` : `da ${prima.a + 1} a ${dopo.da - 1}`;
      errori.push(`Nessun personaggio copre il punteggio ${buco}.`);
    }
  }

  if (dati.segreto !== undefined && dati.segreto !== null) {
    const s = dati.segreto;
    if (typeof s !== 'object' || Array.isArray(s)) errori.push('Il campo "segreto" deve essere tra parentesi graffe { }.');
    else {
      if (typeof s.nome !== 'string' || s.nome.trim() === '') errori.push('Il personaggio segreto non ha il campo "nome".');
      controllaCampiFacoltativi(s, 'Il personaggio segreto', errori);
    }
  }
  return errori;
}

function controllaCampiFacoltativi(p, et, errori) {
  ['frase', 'immagine', 'colore'].forEach((campo) => {
    if (p[campo] !== undefined && typeof p[campo] !== 'string') {
      errori.push(`${et}: il campo "${campo}" deve essere un testo tra virgolette.`);
    }
  });
  if (typeof p.colore === 'string' && p.colore.trim() !== '' && !COLORE_VALIDO.test(p.colore.trim())) {
    errori.push(`${et}: il colore "${p.colore}" non è valido, usa il formato #ffcc00.`);
  }
}

// Trasforma i dati del JSON nella forma usata dal gioco
function normalizzaPersonaggi(dati) {
  const lista = dati.personaggi.map((p) => {
    const a = p.a === undefined ? p.da : p.a;
    return {
      chiave: `${p.da}_${a}`,
      da: p.da,
      a,
      nome: p.nome.trim(),
      frase: (p.frase || '').trim(),
      immagine: (p.immagine || '').trim(),
      colore: (p.colore || '').trim() || coloreDefault(p.da, a),
      segreto: false
    };
  }).sort((x, y) => x.da - y.da);

  const minPunti = lista[0].da;
  const maxPunti = lista[lista.length - 1].a;
  let segreto = null;
  if (dati.segreto) {
    segreto = {
      chiave: 'segreto',
      da: maxPunti,
      a: maxPunti,
      nome: dati.segreto.nome.trim(),
      frase: (dati.segreto.frase || '').trim(),
      immagine: (dati.segreto.immagine || '').trim(),
      colore: (dati.segreto.colore || '').trim() || '#ffc53a',
      segreto: true
    };
  }
  return { titolo: typeof dati.titolo === 'string' ? dati.titolo : '', lista, segreto, minPunti, maxPunti };
}

// Legge un testo JSON (da fetch o da file scelto a mano) e, se va bene, lo attiva
function applicaContenuti(testo, nomeFile) {
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch (e) {
    mostraStato(`Il file "${nomeFile}" non è un JSON valido: controlla virgole, virgolette e parentesi.`, 'errore');
    return false;
  }
  const errori = validaPersonaggi(dati);
  if (errori.length) {
    mostraStato(`Ci sono problemi nel file "${nomeFile}":`, 'errore', errori);
    return false;
  }
  personaggi = normalizzaPersonaggi(dati);
  const extra = personaggi.segreto ? ' + 1 segreto' : '';
  const titolo = personaggi.titolo ? ` (${personaggi.titolo})` : '';
  mostraStato(`Personaggi pronti: ${personaggi.lista.length}${extra}${titolo}.`, 'ok');
  // Precarica le immagini per evitare scatti durante le trasformazioni
  personaggi.lista.concat(personaggi.segreto || []).forEach((p) => {
    if (p.immagine) { const img = new Image(); img.src = p.immagine; }
  });
  return true;
}

async function caricaPersonaggiDaServer() {
  try {
    const risposta = await fetch(CONFIG.fileContenuti, { cache: 'no-store' });
    if (!risposta.ok) throw new Error('non trovato');
    applicaContenuti(await risposta.text(), 'personaggi.json');
  } catch (e) {
    mostraStato(
      `Non riesco a leggere "${CONFIG.fileContenuti}". Succede quando apri index.html direttamente dal computer: premi "CARICA PERSONAGGI" e scegli il file.`,
      'errore'
    );
  }
}

function caricaPersonaggiDaFile(file) {
  const lettore = new FileReader();
  lettore.onload = () => applicaContenuti(String(lettore.result), file.name);
  lettore.onerror = () => mostraStato(`Non riesco ad aprire il file "${file.name}".`, 'errore');
  lettore.readAsText(file);
}

function mostraStato(messaggio, tipo, elenco) {
  const box = $('stato-contenuti');
  box.className = 'stato ' + (tipo || '');
  box.textContent = messaggio;
  if (elenco && elenco.length) {
    const ul = document.createElement('ul');
    elenco.slice(0, 10).forEach((riga) => {
      const li = document.createElement('li');
      li.textContent = riga;
      ul.appendChild(li);
    });
    if (elenco.length > 10) {
      const li = document.createElement('li');
      li.textContent = `…e altri ${elenco.length - 10} problemi.`;
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }
}

/* =========================================================
   QUALE PERSONAGGIO PER QUALE PUNTEGGIO
   ========================================================= */
function pgPerPunti(punti) {
  const l = personaggi.lista;
  if (punti <= l[0].da) return l[0];                 // sotto il minimo: resta il primo
  if (punti >= l[l.length - 1].a) return l[l.length - 1]; // sopra il massimo: resta l'ultimo
  return l.find((p) => punti >= p.da && punti <= p.a) || l[0];
}

// A fine partita: chi ha raggiunto il massimo diventa il personaggio segreto
function pgFinale(punti) {
  if (personaggi.segreto && punti >= personaggi.maxPunti) return personaggi.segreto;
  return pgPerPunti(punti);
}

function formattaAura(punti) {
  return (punti * CONFIG.moltiplicatoreAura).toLocaleString('it-IT').replace('\u2212', '-');
}

/* =========================================================
   GRAFICA: personaggio segnaposto e aura
   ========================================================= */

// Sprite segnaposto a pixel, usato finché non ci sono i PNG (o se un PNG non si carica).
// W = pelle, T = tuta (colore dell'aura), D = capelli, K = nero.
const SPRITE = [
  '..........DD', '......D..DDDD..D', '.......DDDDDDDDD', '......DDDDDDDDDDD',
  '......DDWWWWWWWDD', '......DWWWWWWWWWD', '......WWKWWWWKWWW', '......WWKWWWWKWWW',
  '......WWWWWWWWWWW', '.......WWWKKKWWW', '........WWWWWWW', '..........WWW',
  '.....TTTTTTTTTTTTT', '....TTTTTTTTTTTTTTT', '...TTTTTTTTTTTTTTTTT', '..WWTTTTTTTTTTTTTTTWW',
  '..WW.TTTTTTTTTTTTT.WW', '.WWW.TTTTTTTTTTTTT.WWW', '.WWW..TTTTTTTTTTT..WWW', '......KKKKKKKKKKK',
  '......TTTTTTTTTTT', '......TTTTT.TTTTT', '......TTTT...TTTT', '.....TTTT.....TTTT',
  '.....TTTT.....TTTT', '....TTTT.......TTTT', '....TTTT.......TTTT', '...KKKKK.......KKKKK',
  '...KKKKKK.....KKKKKK'
];

function spriteSegnaposto(colore, nome) {
  const tinte = { W: '#ffffff', T: colore, D: '#5a5a5a', K: '#000000' };
  let rett = '';
  SPRITE.forEach((riga, y) => {
    [...riga].forEach((c, x) => {
      if (tinte[c]) rett += `<rect x="${x}" y="${y}" width="1" height="1" fill="${tinte[c]}"/>`;
    });
  });
  return `<svg viewBox="0 0 23 29" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(nome)}">${rett}</svg>`;
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function disegnaPg(contenitore, pg) {
  contenitore.innerHTML = '';
  if (pg.immagine) {
    const img = document.createElement('img');
    img.alt = pg.nome;
    img.draggable = false;
    // Se il PNG manca o il percorso è sbagliato, si vede il segnaposto
    img.onerror = () => { contenitore.innerHTML = spriteSegnaposto(pg.colore, pg.nome); };
    img.src = pg.immagine;
    contenitore.appendChild(img);
  } else {
    contenitore.innerHTML = spriteSegnaposto(pg.colore, pg.nome);
  }
}

// Costruisce fiamme e particelle. Più il personaggio è "alto" (o "basso"), più l'aura è grande.
function costruisciAura(el, pg) {
  el.innerHTML = '';
  const negativa = !pg.segreto && pg.a < 0;
  let t; // intensità da 0 a 1
  if (pg.segreto) t = 1;
  else if (negativa) t = Math.abs(pg.da) / Math.max(1, Math.abs(personaggi.minPunti));
  else t = Math.max(0, pg.a) / Math.max(1, personaggi.maxPunti);

  el.classList.toggle('negativa', negativa);
  el.classList.toggle('segreto', !!pg.segreto);
  el.style.setProperty('--colore-aura', pg.colore);

  const fiamme = pg.segreto ? 16 : 3 + Math.round(t * 11);
  const base = pg.segreto ? 92 : (negativa ? 12 + t * 30 : 16 + t * 68); // altezza in % del palco
  const passo = 5.2;
  for (let k = 0; k < fiamme; k++) {
    const off = k - (fiamme - 1) / 2;
    const dist = Math.abs(off) / Math.max(1, (fiamme - 1) / 2);
    const h1 = Math.max(5, base * (1 - 0.55 * dist));
    const h2 = Math.min(100, h1 * 1.18 + 3);
    const f = document.createElement('div');
    f.className = 'fiamma';
    f.style.left = `calc(50% + ${(off * passo).toFixed(1)}% - 2%)`;
    f.style.setProperty('--h1', `${h1.toFixed(1)}%`);
    f.style.setProperty('--h2', `${h2.toFixed(1)}%`);
    f.style.animationDelay = `${(k * 0.05).toFixed(2)}s`;
    el.appendChild(f);
  }

  const particelle = pg.segreto ? 16 : 3 + Math.round(t * 11);
  for (let k = 0; k < particelle; k++) {
    const p = document.createElement('div');
    p.className = 'particella';
    p.style.left = `${(6 + k * (86 / particelle) + (k % 2 ? 2 : 0)).toFixed(1)}%`;
    p.style.animationDelay = `${((k * 0.37) % 1.3).toFixed(2)}s`;
    p.style.setProperty('--durata', `${(negativa ? 1.9 : 1.4 - t * 0.5).toFixed(2)}s`);
    el.appendChild(p);
  }
}

// Mette a schermo un personaggio (senza animazioni di trasformazione)
function mostraPg(col, pg, i) {
  disegnaPg(col.querySelector('.pg'), pg);
  costruisciAura(col.querySelector('.aura'), pg);
  if (i !== undefined) pgVisibile[i] = pg.chiave;
}

function mostraNuvoletta(col, pg, i, permanente) {
  const nuv = col.querySelector('.nuvoletta');
  nuv.querySelector('.nuv-nome').textContent = pg.nome.toUpperCase();
  nuv.querySelector('.nuv-frase').textContent = pg.frase;
  nuv.hidden = false;
  clearTimeout(timerNuvoletta[i]);
  if (!permanente) timerNuvoletta[i] = setTimeout(() => { nuv.hidden = true; }, CONFIG.durataNuvoletta);
}

// Riavvia un'animazione CSS togliendo e rimettendo la classe
function riavviaClasse(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth; // forza il browser a "dimenticare" l'animazione precedente
  el.classList.add(classe);
}

/* =========================================================
   COSTRUZIONE DEL CAMPO (una colonna per squadra)
   ========================================================= */
function creaColonna(sq, i) {
  const col = document.createElement('div');
  col.className = 'squadra';
  col.dataset.i = i;
  col.innerHTML = `
    <div class="testa">
      <span class="freccia" aria-hidden="true">▶</span><span class="nome"></span>
      <span class="tocca">TOCCA A VOI</span>
    </div>
    <div class="palco">
      <div class="aura"></div>
      <div class="pg"></div>
      <div class="lampo"></div>
      <div class="nuvoletta" hidden><span class="nuv-nome"></span><span class="nuv-frase"></span></div>
    </div>
    <div class="punteggio"><span class="valore"></span><span class="etichetta">AURA</span></div>`;
  col.querySelector('.nome').textContent = sq.nome;
  col.querySelector('.valore').textContent = formattaAura(sq.punti);
  return col;
}

function costruisciCampo() {
  const campo = $('campo');
  campo.innerHTML = '';
  campo.style.setProperty('--n', stato.squadre.length);
  campo.classList.toggle('solo', stato.squadre.length === 1);
  stato.squadre.forEach((sq, i) => {
    const col = creaColonna(sq, i);
    col.addEventListener('click', () => selezionaSquadra(i));
    campo.appendChild(col);
    mostraPg(col, pgPerPunti(sq.punti), i);
  });
  aggiornaTurno();
}

function colonna(i) {
  return $('campo').querySelector(`.squadra[data-i="${i}"]`);
}

function aggiornaTurno() {
  const piuSquadre = stato.squadre.length > 1;
  stato.squadre.forEach((_, i) => {
    const col = colonna(i);
    if (col) col.classList.toggle('attiva', i === stato.turno);
  });
  $('c-turno').disabled = !piuSquadre; // con una sola squadra il turno non passa
}

/* =========================================================
   AZIONI DEL FORMATORE
   ========================================================= */

// Prima di ogni azione salviamo una copia dello stato: serve ad "annulla"
function registra() {
  storia.push(JSON.stringify(stato));
  if (storia.length > 200) storia.shift();
}

function cambiaPunti(delta) {
  if (!stato || stato.fase !== 'gioco') return;
  const i = stato.turno;
  registra();
  stato.squadre[i].punti += delta;
  salvaPartita();

  const col = colonna(i);
  const valore = col.querySelector('.valore');
  valore.textContent = formattaAura(stato.squadre[i].punti);
  riavviaClasse(valore, 'pop');
  riavviaClasse(col, 'carica');

  // Il numero cambia subito; il personaggio aspetta che il formatore smetta di cliccare
  clearTimeout(timerTrasforma[i]);
  timerTrasforma[i] = setTimeout(() => trasforma(i), CONFIG.ritardoTrasformazione);
}

function trasforma(i) {
  if (!stato || stato.fase !== 'gioco') return;
  const col = colonna(i);
  if (!col) return;
  const pg = pgPerPunti(stato.squadre[i].punti);
  if (pgVisibile[i] === pg.chiave) return; // stesso personaggio: nessuna trasformazione
  riavviaClasse(col, 'trasforma');
  // Il cambio avviene durante il lampo
  setTimeout(() => {
    mostraPg(col, pg, i);
    mostraNuvoletta(col, pg, i, false);
  }, 120);
}

function passaTurno() {
  if (!stato || stato.fase !== 'gioco' || stato.squadre.length < 2) return;
  registra();
  stato.turno = (stato.turno + 1) % stato.squadre.length;
  salvaPartita();
  aggiornaTurno();
}

function selezionaSquadra(i) {
  if (!stato || stato.fase !== 'gioco' || stato.squadre.length < 2) return;
  if (i === stato.turno || i >= stato.squadre.length) return;
  registra();
  stato.turno = i;
  salvaPartita();
  aggiornaTurno();
}

function annulla() {
  if (!storia.length) { avviso('NIENTE DA ANNULLARE'); return; }
  const eraFinale = stato.fase === 'finale';
  stato = JSON.parse(storia.pop());
  salvaPartita();
  fermaTimer();
  if (stato.fase === 'gioco') {
    if (eraFinale) costruisciCampo();
    // Riallinea numeri e personaggi senza animazioni
    stato.squadre.forEach((sq, i) => {
      const col = colonna(i);
      col.querySelector('.valore').textContent = formattaAura(sq.punti);
      col.querySelector('.nuvoletta').hidden = true;
      const pg = pgPerPunti(sq.punti);
      if (pgVisibile[i] !== pg.chiave) mostraPg(col, pg, i);
    });
    aggiornaTurno();
    vaiA('gioco');
  } else {
    mostraFinale(false);
  }
  avviso('ANNULLATO');
}

function fermaTimer() {
  timerTrasforma.forEach((t) => clearTimeout(t));
  timerNuvoletta.forEach((t) => clearTimeout(t));
  clearTimeout(timerFinale);
}

/* =========================================================
   FINE PARTITA E RIVELAZIONE
   ========================================================= */
function chiediFine() {
  if (!stato || stato.fase !== 'gioco') return;
  apriDialogo('FINE PARTITA?', 'Si passa alla rivelazione finale. Se serve, potrai tornare indietro con ANNULLA.', [
    { testo: 'SÌ, RIVELA', azione: terminaPartita },
    { testo: 'NO, CONTINUA', azione: chiudiDialogo }
  ]);
}

function terminaPartita() {
  chiudiDialogo();
  registra();
  stato.fase = 'finale';
  salvaPartita();
  mostraFinale(true);
}

function mostraFinale(conSuspense) {
  fermaTimer();
  const campo = $('campo-finale');
  campo.innerHTML = '';
  campo.style.setProperty('--n', stato.squadre.length);
  campo.classList.toggle('solo', stato.squadre.length === 1);

  const colonne = stato.squadre.map((sq, i) => {
    const col = creaColonna(sq, i);
    col.dataset.i = i;
    campo.appendChild(col);
    mostraPg(col, pgFinale(sq.punti));
    return col;
  });
  vaiA('finale');

  const rivela = () => {
    $('titolo-finale').textContent = 'RISULTATO FINALE';
    const massimo = Math.max(...stato.squadre.map((q) => q.punti));
    colonne.forEach((col, i) => {
      const pg = pgFinale(stato.squadre[i].punti);
      col.querySelector('.pg').classList.remove('sagoma');
      if (conSuspense) riavviaClasse(col, 'trasforma');
      mostraNuvoletta(col, pg, i, true);
      // Con più squadre, chi ha più aura vince (scritta, non solo colore)
      if (stato.squadre.length > 1 && stato.squadre[i].punti === massimo) {
        const v = document.createElement('span');
        v.className = 'vince';
        v.textContent = '★ VINCE ★';
        col.querySelector('.testa').appendChild(v);
        col.classList.add('attiva');
      }
    });
  };

  if (conSuspense) {
    $('titolo-finale').textContent = 'CARICAMENTO AURA...';
    colonne.forEach((col) => {
      col.querySelector('.pg').classList.add('sagoma');
      riavviaClasse(col, 'carica');
    });
    timerFinale = setTimeout(rivela, CONFIG.durataSuspenseFinale);
  } else {
    rivela();
  }
}

function chiudiPartitaFinita() {
  fermaTimer();
  memoria.cancella();
  stato = null;
  storia = [];
  tornaAllaHome();
}

/* =========================================================
   USCITA E RIPRESA
   ========================================================= */
function chiediUscita() {
  if (!stato) return;
  apriDialogo('USCIRE DALLA PARTITA?', 'Salvando, la ritrovi in home con "Riprendi partita". Senza salvare, la partita viene cancellata.', [
    { testo: 'SALVA ED ESCI', azione: () => { chiudiDialogo(); salvaPartita(); esciAllaHome(); } },
    { testo: 'ESCI SENZA SALVARE', azione: () => { chiudiDialogo(); memoria.cancella(); stato = null; esciAllaHome(); } },
    { testo: 'RESTA', azione: chiudiDialogo }
  ]);
}

function esciAllaHome() {
  fermaTimer();
  storia = [];
  tornaAllaHome();
}

function tornaAllaHome() {
  aggiornaHome();
  vaiA('home');
}

function aggiornaHome() {
  $('btn-riprendi').hidden = !statoValido(memoria.leggi());
}

function riprendiPartita() {
  if (!personaggi) { avvisoPersonaggi(); return; }
  const salvato = memoria.leggi();
  if (!statoValido(salvato)) { aggiornaHome(); avviso('NESSUNA PARTITA DA RIPRENDERE'); return; }
  stato = salvato;
  storia = []; // la cronologia di "annulla" non viene salvata
  avviaGioco();
}

function avviaGioco() {
  costruisciCampo();
  if (stato.fase === 'finale') mostraFinale(false);
  else vaiA('gioco');
}

function avvisoPersonaggi() {
  avviso('PRIMA CARICA I PERSONAGGI');
  $('btn-carica').focus();
}

/* =========================================================
   NUOVA PARTITA: SCELTA SQUADRE
   ========================================================= */
function nuovaPartita() {
  if (!personaggi) { avvisoPersonaggi(); return; }
  if (statoValido(memoria.leggi())) {
    apriDialogo('C\'È UNA PARTITA IN CORSO', 'Se ne inizi una nuova, quella salvata viene cancellata.', [
      { testo: 'INIZIA NUOVA', azione: () => { chiudiDialogo(); apriSceltaSquadre(); } },
      { testo: 'ANNULLA', azione: chiudiDialogo }
    ]);
    return;
  }
  apriSceltaSquadre();
}

function apriSceltaSquadre() {
  scegliNumero(numeroScelto);
  vaiA('squadre');
}

function scegliNumero(n) {
  // Conserva i nomi già scritti quando cambi il numero
  const scritti = [...$('nomi-squadre').querySelectorAll('input')].map((inp) => inp.value);
  numeroScelto = n;
  document.querySelectorAll('#scelta-numero .btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.n) === n));
  });
  const box = $('nomi-squadre');
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const label = document.createElement('label');
    label.textContent = `${i + 1}`;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = CONFIG.lunghezzaMaxNome;
    inp.value = scritti[i] !== undefined ? scritti[i] : NOMI_DEFAULT[i];
    inp.setAttribute('aria-label', `Nome squadra ${i + 1}`);
    label.appendChild(inp);
    box.appendChild(label);
  }
}

function via() {
  const nomi = [...$('nomi-squadre').querySelectorAll('input')]
    .map((inp, i) => inp.value.trim().toUpperCase() || NOMI_DEFAULT[i]);
  stato = {
    squadre: nomi.map((nome) => ({ nome, punti: 0 })),
    turno: 0,
    fase: 'gioco'
  };
  storia = [];
  salvaPartita();
  avviaGioco();
}

/* =========================================================
   SCHERMATE, DIALOGHI, AVVISI
   ========================================================= */
function vaiA(nome) {
  schermata = nome;
  document.querySelectorAll('.schermata').forEach((s) => {
    s.classList.toggle('attiva', s.id === `schermata-${nome}`);
  });
  document.body.classList.toggle('in-gioco', nome === 'gioco');
}

function apriDialogo(titolo, testo, bottoni) {
  $('dialogo-titolo').textContent = titolo;
  $('dialogo-testo').textContent = testo;
  const box = $('dialogo-bottoni');
  box.innerHTML = '';
  bottoni.forEach((b) => {
    const el = document.createElement('button');
    el.className = 'btn';
    el.textContent = b.testo;
    el.addEventListener('click', b.azione);
    box.appendChild(el);
  });
  $('dialogo').hidden = false;
  dialogoAperto = true;
  box.querySelector('button').focus();
}

function chiudiDialogo() {
  $('dialogo').hidden = true;
  dialogoAperto = false;
}

function avviso(testo) {
  const el = $('avviso');
  el.textContent = testo;
  el.classList.add('visibile');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => el.classList.remove('visibile'), 1400);
}

function alternaComandi() {
  document.body.classList.toggle('comandi-nascosti');
}

/* =========================================================
   EVENTI: MOUSE E TASTIERA (sempre in parallelo)
   ========================================================= */
function collegaEventi() {
  // Dopo un clic togliamo il focus dal bottone, così SPAZIO/INVIO non lo ripremono per sbaglio
  const clic = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });

  clic('btn-nuova', nuovaPartita);
  clic('btn-riprendi', riprendiPartita);
  clic('btn-carica', () => $('file-personaggi').click());
  $('file-personaggi').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) caricaPersonaggiDaFile(file);
    e.target.value = ''; // permette di ricaricare lo stesso file
  });

  document.querySelectorAll('#scelta-numero .btn').forEach((b) => {
    b.addEventListener('click', () => scegliNumero(Number(b.dataset.n)));
  });
  clic('btn-indietro', tornaAllaHome);
  clic('btn-via', via);

  clic('c-piu', () => cambiaPunti(1));
  clic('c-meno', () => cambiaPunti(-1));
  clic('c-turno', passaTurno);
  clic('c-annulla', annulla);
  clic('c-fine', chiediFine);
  clic('c-esci', chiediUscita);
  clic('c-nascondi', alternaComandi);
  clic('mostra-comandi', alternaComandi);

  clic('f-annulla', annulla);
  clic('f-menu', chiudiPartitaFinita);

  document.addEventListener('keydown', gestisciTasto);
}

function gestisciTasto(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // lascia liberi zoom e scorciatoie del browser

  if (dialogoAperto) {
    if (e.key === 'Escape') chiudiDialogo();
    return;
  }

  const inCampoTesto = e.target && e.target.tagName === 'INPUT';

  if (schermata === 'squadre') {
    if (e.key === 'Enter') { e.preventDefault(); via(); return; }
    if (e.key === 'Escape') { tornaAllaHome(); return; }
    if (!inCampoTesto && ['1', '2', '3', '4'].includes(e.key)) scegliNumero(Number(e.key));
    return;
  }

  if (schermata === 'gioco') {
    const k = e.key;
    if ((k === '+' || k === '=' || k === 'ArrowUp') && !e.repeat) { e.preventDefault(); cambiaPunti(1); }
    else if ((k === '-' || k === '_' || k === 'ArrowDown') && !e.repeat) { e.preventDefault(); cambiaPunti(-1); }
    else if (k === 'Tab' || k === 'ArrowRight') { e.preventDefault(); passaTurno(); }
    else if (['1', '2', '3', '4'].includes(k)) selezionaSquadra(Number(k) - 1);
    else if (k === 'z' || k === 'Z') annulla();
    else if (k === 'f' || k === 'F') chiediFine();
    else if (k === 'h' || k === 'H') alternaComandi();
    else if (k === 'Escape') chiediUscita();
    return;
  }

  if (schermata === 'finale') {
    if (e.key === 'z' || e.key === 'Z') annulla();
    else if (e.key === 'Escape') chiudiPartitaFinita();
  }
}

/* =========================================================
   AVVIO
   ========================================================= */
function init() {
  collegaEventi();
  if (!memoria.disponibile()) $('avviso-salvataggio').hidden = false;
  aggiornaHome();
  caricaPersonaggiDaServer();
}

init();
