CREATE TABLE IF NOT EXISTS utilisateurs (
  id SERIAL PRIMARY KEY, nom TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user');
CREATE TABLE IF NOT EXISTS bureaux (
  id SERIAL PRIMARY KEY, nom TEXT UNIQUE NOT NULL, localisation TEXT);
-- Un bureau contient plusieurs services ; un service appartient à un seul bureau
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY, nom TEXT UNIQUE NOT NULL,
  bureau_id INT REFERENCES bureaux(id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY, nom TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'DURABLE' CHECK (type IN ('DURABLE','CONSOMMABLE')));
CREATE TABLE IF NOT EXISTS biens (
  id SERIAL PRIMARY KEY, designation TEXT NOT NULL,
  categorie_id INT REFERENCES categories(id) ON DELETE RESTRICT,
  numero_inventaire TEXT UNIQUE NOT NULL,
  etat TEXT NOT NULL DEFAULT 'BON' CHECK (etat IN ('NEUF','BON','USE','HORS_SERVICE')),
  date_acquisition DATE, valeur NUMERIC(14,2) DEFAULT 0,
  service_id INT REFERENCES services(id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS consommables (
  id SERIAL PRIMARY KEY, designation TEXT UNIQUE NOT NULL, unite TEXT NOT NULL DEFAULT 'unité',
  quantite INT NOT NULL DEFAULT 0 CHECK (quantite >= 0), seuil INT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS mouvements (
  id SERIAL PRIMARY KEY, consommable_id INT NOT NULL REFERENCES consommables(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ENTREE','SORTIE')), quantite INT NOT NULL CHECK (quantite > 0),
  date TIMESTAMPTZ NOT NULL DEFAULT now(), utilisateur_id INT REFERENCES utilisateurs(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS campagnes (
  id SERIAL PRIMARY KEY, annee INT UNIQUE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'OUVERTE' CHECK (statut IN ('OUVERTE','CLOTUREE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS controles (
  id SERIAL PRIMARY KEY, campagne_id INT NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  bien_id INT NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  present BOOLEAN, etat_constate TEXT, service_constate_id INT REFERENCES services(id) ON DELETE SET NULL,
  observation TEXT, date_controle TIMESTAMPTZ, controleur_id INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  UNIQUE (campagne_id, bien_id));

-- Migration depuis la version 1 (sans effet sur une base neuve)
ALTER TABLE services ADD COLUMN IF NOT EXISTS bureau_id INT REFERENCES bureaux(id) ON DELETE RESTRICT;
ALTER TABLE bureaux ADD COLUMN IF NOT EXISTS localisation TEXT;
ALTER TABLE biens ADD COLUMN IF NOT EXISTS service_id INT REFERENCES services(id) ON DELETE RESTRICT;
ALTER TABLE controles ADD COLUMN IF NOT EXISTS service_constate_id INT REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE bureaux DROP COLUMN IF EXISTS service_id;
ALTER TABLE biens DROP COLUMN IF EXISTS bureau_id;
ALTER TABLE controles DROP COLUMN IF EXISTS bureau_constate_id;
ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
UPDATE utilisateurs SET role='user' WHERE role NOT IN ('admin','user');
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check CHECK (role IN ('admin','user'));
