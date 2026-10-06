require('dotenv').config();
const fs = require('fs'), path = require('path');
const express = require('express'), cors = require('cors');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { Pool, types } = require('pg');

types.setTypeParser(1082, v => v);          // DATE -> 'YYYY-MM-DD'
types.setTypeParser(1700, v => parseFloat(v)); // NUMERIC -> number
types.setTypeParser(20, v => parseInt(v, 10)); // COUNT -> number

const pool = new Pool({ connectionString: process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/compta_matieres' });
const SECRET = process.env.JWT_SECRET || 'changez-moi';
const app = express();
app.use(cors()); app.use(express.json());

const wrap = fn => (req, res) => fn(req, res).catch(e => {
  const map = { '23505': [409, 'Cette valeur existe déjà.'], '23503': [409, 'Opération impossible : cet élément est utilisé ailleurs.'],
    '23514': [400, 'Valeur invalide.'], '23502': [400, 'Champ obligatoire manquant.'] };
  const [code, msg] = map[e.code] || [500, 'Erreur serveur.'];
  if (code === 500) console.error(e);
  res.status(code).json({ message: msg });
});
const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ message: 'Non authentifié.' }); }
};
const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Réservé aux administrateurs.' });
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const [u] = await q('SELECT * FROM utilisateurs WHERE email=$1', [String(email || '').trim().toLowerCase()]);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
  const user = { id: u.id, nom: u.nom, email: u.email, role: u.role };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '12h' }), user });
}));

// ---------- CRUD générique ----------
const R = {
  bureaux: { open: true, cols: ['nom', 'localisation'], list: `SELECT b.*, count(s.id) AS services_nb,
    coalesce(string_agg(s.nom, ', ' ORDER BY s.nom), '—') AS services_noms FROM bureaux b
    LEFT JOIN services s ON s.bureau_id=b.id GROUP BY b.id ORDER BY b.nom` },
  services: { open: true, cols: ['nom', 'bureau_id'], list: `SELECT s.*, b.nom AS bureau_nom,
    s.nom || ' (' || coalesce(b.nom, 'sans bureau') || ')' AS libelle FROM services s
    LEFT JOIN bureaux b ON b.id=s.bureau_id ORDER BY b.nom, s.nom` },
  categories: { cols: ['nom', 'type'], list: 'SELECT * FROM categories ORDER BY nom' },
  biens: { cols: ['designation', 'categorie_id', 'numero_inventaire', 'etat', 'date_acquisition', 'valeur', 'service_id'],
    list: `SELECT b.*, c.nom AS categorie_nom, s.nom AS service_nom, bu.nom AS bureau_nom FROM biens b
    LEFT JOIN categories c ON c.id=b.categorie_id LEFT JOIN services s ON s.id=b.service_id
    LEFT JOIN bureaux bu ON bu.id=s.bureau_id ORDER BY b.numero_inventaire` },
  consommables: { cols: ['designation', 'unite', 'quantite', 'seuil'], list: 'SELECT * FROM consommables ORDER BY designation' },
};
for (const [name, r] of Object.entries(R)) {
  const clean = b => r.cols.filter(c => c in b).map(c => [c, b[c] === '' ? null : b[c]]);
  app.get(`/api/${name}`, auth, r.open ? (_q, _s, n) => n() : admin, wrap(async (_, res) => res.json(await q(r.list))));
  app.post(`/api/${name}`, auth, admin, wrap(async (req, res) => {
    const f = clean(req.body);
    const [row] = await q(`INSERT INTO ${name} (${f.map(x => x[0])}) VALUES (${f.map((_, i) => '$' + (i + 1))}) RETURNING *`, f.map(x => x[1]));
    res.status(201).json(row);
  }));
  app.put(`/api/${name}/:id`, auth, admin, wrap(async (req, res) => {
    const f = clean(req.body);
    const [row] = await q(`UPDATE ${name} SET ${f.map((x, i) => `${x[0]}=$${i + 1}`)} WHERE id=$${f.length + 1} RETURNING *`, [...f.map(x => x[1]), req.params.id]);
    row ? res.json(row) : res.status(404).json({ message: 'Introuvable.' });
  }));
  app.delete(`/api/${name}/:id`, auth, admin, wrap(async (req, res) => {
    await q(`DELETE FROM ${name} WHERE id=$1`, [req.params.id]); res.status(204).end();
  }));
}

// ---------- Mouvements de consommables ----------
app.post('/api/consommables/:id/mouvement', auth, admin, wrap(async (req, res) => {
  const { type, quantite } = req.body; const n = parseInt(quantite, 10);
  if (!['ENTREE', 'SORTIE'].includes(type) || !(n > 0)) return res.status(400).json({ message: 'Mouvement invalide.' });
  const [row] = await q('UPDATE consommables SET quantite = quantite + $1 WHERE id=$2 AND quantite + $1 >= 0 RETURNING *',
    [type === 'ENTREE' ? n : -n, req.params.id]);
  if (!row) return res.status(400).json({ message: 'Stock insuffisant ou article introuvable.' });
  await q('INSERT INTO mouvements (consommable_id,type,quantite,utilisateur_id) VALUES ($1,$2,$3,$4)', [row.id, type, n, req.user.id]);
  res.json(row);
}));

// ---------- Contrôle annuel ----------
app.get('/api/campagnes', auth, wrap(async (_, res) => res.json(await q(`
  SELECT c.*, count(k.id) AS total, count(k.date_controle) AS controles,
    count(*) FILTER (WHERE k.present = false) AS manquants,
    count(*) FILTER (WHERE k.present AND k.service_constate_id IS DISTINCT FROM b.service_id) AS deplaces
  FROM campagnes c LEFT JOIN controles k ON k.campagne_id=c.id LEFT JOIN biens b ON b.id=k.bien_id
  GROUP BY c.id ORDER BY c.annee DESC`))));
app.post('/api/campagnes', auth, admin, wrap(async (req, res) => {
  const annee = parseInt(req.body.annee, 10);
  if (!(annee >= 2000 && annee <= 2100)) return res.status(400).json({ message: 'Année invalide.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [c] } = await client.query('INSERT INTO campagnes (annee) VALUES ($1) RETURNING *', [annee]);
    await client.query('INSERT INTO controles (campagne_id, bien_id) SELECT $1, id FROM biens', [c.id]);
    await client.query('COMMIT'); res.status(201).json(c);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));
app.post('/api/campagnes/:id/cloturer', auth, admin, wrap(async (req, res) => {
  const [c] = await q("UPDATE campagnes SET statut='CLOTUREE' WHERE id=$1 RETURNING *", [req.params.id]);
  c ? res.json(c) : res.status(404).json({ message: 'Introuvable.' });
}));
app.get('/api/campagnes/:id/controles', auth, wrap(async (req, res) => res.json(await q(`
  SELECT k.*, b.designation, b.numero_inventaire, b.etat AS etat_attendu, b.service_id AS service_attendu_id,
    sv.nom AS service_attendu, bu.nom AS bureau_attendu, sc.nom AS service_constate, u.nom AS controleur
  FROM controles k JOIN biens b ON b.id=k.bien_id LEFT JOIN services sv ON sv.id=b.service_id
  LEFT JOIN bureaux bu ON bu.id=sv.bureau_id LEFT JOIN services sc ON sc.id=k.service_constate_id
  LEFT JOIN utilisateurs u ON u.id=k.controleur_id
  WHERE k.campagne_id=$1 ORDER BY bu.nom, sv.nom, b.numero_inventaire`, [req.params.id]))));
app.put('/api/controles/:id', auth, admin, wrap(async (req, res) => {
  const { present, etat_constate, service_constate_id, observation } = req.body;
  const [row] = await q(`UPDATE controles k SET present=$1, etat_constate=$2, service_constate_id=$3, observation=$4,
    date_controle=now(), controleur_id=$5 FROM campagnes c WHERE k.id=$6 AND c.id=k.campagne_id AND c.statut='OUVERTE' RETURNING k.*`,
    [present, present ? (etat_constate || null) : null, present ? (service_constate_id || null) : null, observation || null, req.user.id, req.params.id]);
  row ? res.json(row) : res.status(400).json({ message: 'Contrôle introuvable ou campagne clôturée.' });
}));

// ---------- Utilisateurs (administrateur uniquement) ----------
const ROLES = ['admin', 'user'];
const nbAdmins = async () => (await q("SELECT count(*) AS n FROM utilisateurs WHERE role='admin'"))[0].n;
app.get('/api/utilisateurs', auth, admin, wrap(async (_, res) =>
  res.json(await q('SELECT id, nom, email, role FROM utilisateurs ORDER BY nom'))));
app.post('/api/utilisateurs', auth, admin, wrap(async (req, res) => {
  const { nom, email, password, role } = req.body;
  if (!nom || !email) return res.status(400).json({ message: 'Nom et e-mail obligatoires.' });
  if (!password || password.length < 6) return res.status(400).json({ message: 'Mot de passe : 6 caractères minimum.' });
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide.' });
  const [u] = await q('INSERT INTO utilisateurs (nom,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,nom,email,role',
    [nom, email.trim().toLowerCase(), await bcrypt.hash(password, 10), role]);
  res.status(201).json(u);
}));
app.put('/api/utilisateurs/:id', auth, admin, wrap(async (req, res) => {
  const { nom, email, password, role } = req.body, id = parseInt(req.params.id, 10);
  if (!nom || !email) return res.status(400).json({ message: 'Nom et e-mail obligatoires.' });
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide.' });
  if (password && password.length < 6) return res.status(400).json({ message: 'Mot de passe : 6 caractères minimum.' });
  const [cur] = await q('SELECT role FROM utilisateurs WHERE id=$1', [id]);
  if (!cur) return res.status(404).json({ message: 'Introuvable.' });
  if (cur.role === 'admin' && role !== 'admin' && (await nbAdmins()) <= 1)
    return res.status(400).json({ message: 'Il doit rester au moins un administrateur.' });
  const [u] = await q(`UPDATE utilisateurs SET nom=$1, email=$2, role=$3${password ? ', password_hash=$5' : ''} WHERE id=$4 RETURNING id,nom,email,role`,
    password ? [nom, email.trim().toLowerCase(), role, id, await bcrypt.hash(password, 10)] : [nom, email.trim().toLowerCase(), role, id]);
  res.json(u);
}));
app.delete('/api/utilisateurs/:id', auth, admin, wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  await q('DELETE FROM utilisateurs WHERE id=$1', [id]); res.status(204).end();
}));

// ---------- Tableau de bord ----------
app.get('/api/dashboard', auth, admin, wrap(async (_, res) => {
  const [kpis] = await q(`SELECT (SELECT count(*) FROM biens) AS biens, (SELECT coalesce(sum(valeur),0) FROM biens) AS valeur,
    (SELECT count(*) FROM bureaux) AS bureaux, (SELECT count(*) FROM services) AS services,
    (SELECT count(*) FROM consommables) AS consommables, (SELECT count(*) FROM consommables WHERE quantite <= seuil) AS alertes,
    (SELECT count(*) FROM biens WHERE etat='HORS_SERVICE') AS hors_service, (SELECT count(*) FROM utilisateurs) AS utilisateurs`);
  const [controle] = await q(`SELECT c.id, c.annee, c.statut, count(k.id) AS total, count(k.date_controle) AS controles,
    count(*) FILTER (WHERE k.present) AS presents, count(*) FILTER (WHERE k.present = false) AS manquants,
    count(*) FILTER (WHERE k.present AND k.service_constate_id IS DISTINCT FROM b.service_id) AS deplaces
    FROM campagnes c LEFT JOIN controles k ON k.campagne_id=c.id LEFT JOIN biens b ON b.id=k.bien_id
    GROUP BY c.id ORDER BY (c.statut='OUVERTE') DESC, c.annee DESC LIMIT 1`);
  res.json({ kpis, controle: controle || null,
    par_service: await q(`SELECT s.nom, count(b.id) AS nb FROM services s LEFT JOIN biens b ON b.service_id=s.id
      GROUP BY s.id ORDER BY nb DESC, s.nom LIMIT 8`),
    par_etat: await q('SELECT etat, count(*) AS nb FROM biens GROUP BY etat'),
    par_categorie: await q(`SELECT c.nom, coalesce(sum(b.valeur),0) AS valeur FROM categories c JOIN biens b ON b.categorie_id=c.id
      GROUP BY c.id ORDER BY valeur DESC LIMIT 6`),
    alertes_stock: await q('SELECT id, designation, quantite, seuil, unite FROM consommables WHERE quantite <= seuil ORDER BY quantite LIMIT 6'),
    mouvements: await q(`SELECT m.type, m.quantite, m.date, c.designation, u.nom AS utilisateur FROM mouvements m
      JOIN consommables c ON c.id=m.consommable_id LEFT JOIN utilisateurs u ON u.id=m.utilisateur_id ORDER BY m.date DESC LIMIT 6`),
    derniers_biens: await q(`SELECT b.designation, b.numero_inventaire, b.etat, s.nom AS service_nom FROM biens b
      LEFT JOIN services s ON s.id=b.service_id ORDER BY b.id DESC LIMIT 6`) });
}));

async function init() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const [{ n }] = await q('SELECT count(*) AS n FROM utilisateurs');
  if (n === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@entreprise.mg', pwd = process.env.ADMIN_PASSWORD || 'admin123';
    await q('INSERT INTO utilisateurs (nom,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Administrateur', email.toLowerCase(), await bcrypt.hash(pwd, 10), 'admin']);
    console.log(`Compte admin créé : ${email}`);
  }
}
const PORT = process.env.PORT || 3000;
(async () => {
  for (let i = 0; i < 20; i++) {   // attend que PostgreSQL soit prêt
    try { await init(); break; } catch (e) { if (i === 19) throw e; console.log('Attente de PostgreSQL...'); await new Promise(r => setTimeout(r, 2000)); }
  }
  app.listen(PORT, () => console.log(`API sur le port ${PORT}`));
})().catch(e => { console.error(e); process.exit(1); });
