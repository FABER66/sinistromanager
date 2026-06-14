#!/usr/bin/env node
// Genera l'utente admin per D1: stampa l'INSERT SQL su stdout, le credenziali su stderr.
// Uso: node scripts/gen-admin.mjs [email] [password] [nome]
//   email/password opzionali: se assenti, email = admin dello studio, password = generata forte.
import { webcrypto as crypto } from 'node:crypto';

const PBKDF2_ITER = 100000;
const enc = new TextEncoder();
const bufToB64 = (b) => Buffer.from(b).toString('base64');

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${PBKDF2_ITER}$${bufToB64(salt)}$${bufToB64(new Uint8Array(bits))}`;
}

function strongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*?';
  const r = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(r, b => chars[b % chars.length]).join('');
}

function ini(nome) {
  return (nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'AD';
}

const email = (process.argv[2] || 'studio@sinistromanager.it').toLowerCase();
const password = process.argv[3] || strongPassword();
const nome = process.argv[4] || 'Amministratore';
const id = crypto.randomUUID();
const hash = await hashPassword(password);

const sql = `INSERT INTO sin_utenti (id,email,password_hash,nome,ruolo,ini) VALUES ` +
  `('${id}','${email}','${hash}','${nome.replace(/'/g, "''")}','admin','${ini(nome)}');`;

process.stdout.write(sql + '\n');
process.stderr.write(`\n=== CREDENZIALI ADMIN (salvale!) ===\nEmail:    ${email}\nPassword: ${password}\nNome:     ${nome}\nUUID:     ${id}\n====================================\n`);
