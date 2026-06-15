-- SinistroManager — schema D1 (SQLite)
-- Applicare con: wrangler d1 execute sinistromanager --remote --file schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sin_utenti (
  id            TEXT PRIMARY KEY,        -- uuid
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,           -- pbkdf2$iter$salt$hash
  nome          TEXT,
  ruolo         TEXT NOT NULL DEFAULT 'collab',  -- admin | collab
  ini           TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sin_pratiche (
  id                      TEXT PRIMARY KEY,   -- es. SIN-2026-001
  data                    TEXT,
  ora                     TEXT,
  luogo                   TEXT,
  tipo                    TEXT,
  forze                   TEXT,
  fase                    TEXT DEFAULT 'apertura',
  note                    TEXT,
  ass_nome                TEXT,
  ass_cognome             TEXT,
  ass_cf                  TEXT,
  ass_tel                 TEXT,
  ass_email               TEXT,
  ass_ruolo               TEXT,
  ass_targa               TEXT,
  ass_assicurazione       TEXT,
  ass_polizza             TEXT,
  cp_nome                 TEXT,
  cp_cognome              TEXT,
  cp_cf                   TEXT,
  cp_targa                TEXT,
  cp_assicurazione        TEXT,
  cp_sinistro             TEXT,
  danno_fisico            INTEGER DEFAULT 0,
  danno_materiale         INTEGER DEFAULT 0,
  danno_morale            INTEGER DEFAULT 0,
  collab_id               TEXT,
  legale                  TEXT,
  perizia_perito          TEXT,
  perizia_data_nomina     TEXT,
  perizia_data_sopralluogo TEXT,
  perizia_importo         REAL DEFAULT 0,
  perizia_note            TEXT,
  ml_medico               TEXT,
  ml_data_nomina          TEXT,
  ml_data_visita          TEXT,
  ml_invalidita           TEXT,
  ml_lesioni              TEXT,
  ml_note                 TEXT,
  created_at              TEXT DEFAULT (datetime('now')),
  updated_at              TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pratica_cognome ON sin_pratiche(ass_cognome);
CREATE INDEX IF NOT EXISTS idx_pratica_targa   ON sin_pratiche(ass_targa);
CREATE INDEX IF NOT EXISTS idx_pratica_fase    ON sin_pratiche(fase);

CREATE TABLE IF NOT EXISTS sin_rubrica (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL,          -- segnalatore | avvocato | medico | compagnia | carrozzeria
  nome            TEXT NOT NULL,
  specializzazione TEXT,
  struttura       TEXT,
  telefono        TEXT,
  email           TEXT,
  note            TEXT,
  provv_tipo      TEXT,                   -- fisso | percentuale
  provv_valore    REAL,
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rub_tipo ON sin_rubrica(tipo);
CREATE INDEX IF NOT EXISTS idx_rub_nome ON sin_rubrica(nome);

CREATE TABLE IF NOT EXISTS sin_corrispondenza (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pratica_id  TEXT NOT NULL REFERENCES sin_pratiche(id) ON DELETE CASCADE,
  data        TEXT,
  direzione   TEXT,
  oggetto     TEXT,
  importo     REAL DEFAULT 0,
  protocollo  TEXT,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_corr_pratica ON sin_corrispondenza(pratica_id);

CREATE TABLE IF NOT EXISTS sin_documenti (
  id              TEXT PRIMARY KEY,
  pratica_id      TEXT NOT NULL REFERENCES sin_pratiche(id) ON DELETE CASCADE,
  tipo            TEXT,
  nome            TEXT,
  data            TEXT,
  note            TEXT,
  has_file        INTEGER DEFAULT 0,
  file_url        TEXT,
  file_nome       TEXT,
  med_struttura   TEXT,
  med_reparto     TEXT,
  med_medico      TEXT,
  med_specializ   TEXT,
  med_parte       TEXT,
  med_esito       TEXT,
  med_prognosi    TEXT,
  med_num_referto TEXT
);
CREATE INDEX IF NOT EXISTS idx_doc_pratica  ON sin_documenti(pratica_id);
CREATE INDEX IF NOT EXISTS idx_doc_tipo     ON sin_documenti(tipo);

CREATE TABLE IF NOT EXISTS sin_timeline (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pratica_id  TEXT NOT NULL REFERENCES sin_pratiche(id) ON DELETE CASCADE,
  data        TEXT,
  titolo      TEXT,
  descrizione TEXT
);
CREATE INDEX IF NOT EXISTS idx_tl_pratica   ON sin_timeline(pratica_id);

-- Aggiornamenti pratica: diario stato/avanzamento legale
CREATE TABLE IF NOT EXISTS sin_aggiornamenti (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pratica_id  TEXT NOT NULL REFERENCES sin_pratiche(id) ON DELETE CASCADE,
  data        TEXT,
  testo       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agg_pratica ON sin_aggiornamenti(pratica_id);

-- Impostazioni studio (intestazione, P.IVA, regime fiscale...) — key/value
CREATE TABLE IF NOT EXISTS sin_impostazioni (
  chiave TEXT PRIMARY KEY,
  valore TEXT
);

-- Registro fatture/parcelle emesse
CREATE TABLE IF NOT EXISTS sin_fatture (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  numero      TEXT,
  data        TEXT,
  pratica_id  TEXT REFERENCES sin_pratiche(id) ON DELETE SET NULL,
  cliente     TEXT,
  imponibile  REAL DEFAULT 0,
  cassa       REAL DEFAULT 0,
  iva         REAL DEFAULT 0,
  ritenuta    REAL DEFAULT 0,
  totale      REAL DEFAULT 0,
  netto       REAL DEFAULT 0,
  voci_json   TEXT,
  dati_json   TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fatt_pratica ON sin_fatture(pratica_id);

-- Preventivo pratica: voci di spesa previste (onorario, perito, bolli...)
CREATE TABLE IF NOT EXISTS sin_preventivo_voci (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pratica_id  TEXT NOT NULL REFERENCES sin_pratiche(id) ON DELETE CASCADE,
  descrizione TEXT,
  importo     REAL DEFAULT 0,
  ordine      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_prev_pratica ON sin_preventivo_voci(pratica_id);

-- Interlocutori pratica: compagnie da contattare / a chi scrivere
CREATE TABLE IF NOT EXISTS sin_interlocutori (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pratica_id  TEXT NOT NULL REFERENCES sin_pratiche(id) ON DELETE CASCADE,
  compagnia   TEXT,
  referente   TEXT,
  contatto    TEXT,
  ruolo       TEXT,
  stato       TEXT DEFAULT 'da_scrivere',
  note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_int_pratica ON sin_interlocutori(pratica_id);

-- Prima Nota: movimenti di cassa dello studio (entrate/uscite), collegabili a una pratica
CREATE TABLE IF NOT EXISTS sin_movimenti (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  data        TEXT NOT NULL,
  tipo        TEXT NOT NULL,          -- entrata | uscita
  categoria   TEXT,
  descrizione TEXT,
  importo     REAL NOT NULL DEFAULT 0,
  metodo      TEXT,                   -- contante | bonifico | assegno | pos
  pratica_id  TEXT REFERENCES sin_pratiche(id) ON DELETE SET NULL,                   -- opzionale: collega il movimento a una pratica
  note        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mov_data    ON sin_movimenti(data);
CREATE INDEX IF NOT EXISTS idx_mov_pratica ON sin_movimenti(pratica_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo    ON sin_movimenti(tipo);
