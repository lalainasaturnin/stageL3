import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './api';
import { Home } from './home';
import { Login } from './login';
import { Dashboard } from './dashboard';
import { Crud } from './crud';
import { Controle } from './controle';

const ETATS = [{ value: 'NEUF', label: 'Neuf' }, { value: 'BON', label: 'Bon' },
  { value: 'USE', label: 'Usé' }, { value: 'HORS_SERVICE', label: 'Hors service' }];
const L_ETAT = { NEUF: 'Neuf', BON: 'Bon', USE: 'Usé', HORS_SERVICE: 'Hors service' };

const crud = (path: string, data: any) => ({ path, component: Crud, canActivate: [adminGuard], data });

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: Home },
  { path: 'login', component: Login },
  { path: '', canActivate: [authGuard], children: [
    { path: 'dashboard', component: Dashboard, canActivate: [adminGuard] },
    crud('biens', { resource: 'biens', title: 'Biens durables', subtitle: 'Chaque objet est suivi individuellement avec son numéro d\'inventaire.', fields: [
      { key: 'numero_inventaire', label: 'N° d\'inventaire', type: 'text', req: true },
      { key: 'designation', label: 'Désignation', type: 'text', req: true },
      { key: 'categorie_id', label: 'Catégorie', type: 'select', source: ['categories', 'nom'] },
      { key: 'service_id', label: 'Service (et son bureau)', type: 'select', source: ['services', 'libelle'] },
      { key: 'etat', label: 'État', type: 'select', options: ETATS, def: 'BON' },
      { key: 'date_acquisition', label: 'Date d\'acquisition', type: 'date' },
      { key: 'valeur', label: 'Valeur (Ar)', type: 'number' }],
      columns: [{ key: 'numero_inventaire', label: 'N°' }, { key: 'designation', label: 'Désignation' },
        { key: 'categorie_nom', label: 'Catégorie' }, { key: 'service_nom', label: 'Service' },
        { key: 'bureau_nom', label: 'Bureau' }, { key: 'etat', label: 'État', labels: L_ETAT }, { key: 'valeur', label: 'Valeur (Ar)', num: true }] }),
    crud('consommables', { resource: 'consommables', title: 'Consommables', subtitle: 'Stylos, papier, ampoules… Les lignes en alerte sont sous le seuil.', mouvement: true, fields: [
      { key: 'designation', label: 'Désignation', type: 'text', req: true },
      { key: 'unite', label: 'Unité', type: 'text', def: 'unité' },
      { key: 'quantite', label: 'Quantité en stock', type: 'number', def: 0 },
      { key: 'seuil', label: 'Seuil d\'alerte', type: 'number', def: 0 }],
      columns: [{ key: 'designation', label: 'Désignation' }, { key: 'unite', label: 'Unité' },
        { key: 'quantite', label: 'Stock', num: true }, { key: 'seuil', label: 'Seuil', num: true }] }),
    crud('bureaux', { resource: 'bureaux', title: 'Bureaux', subtitle: 'Un bureau peut regrouper plusieurs services.', fields: [
      { key: 'nom', label: 'Nom du bureau', type: 'text', req: true },
      { key: 'localisation', label: 'Localisation (étage, bâtiment…)', type: 'text' }],
      columns: [{ key: 'nom', label: 'Bureau' }, { key: 'localisation', label: 'Localisation' },
        { key: 'services_nb', label: 'Services', num: true }, { key: 'services_noms', label: 'Liste des services' }] }),
    crud('services', { resource: 'services', title: 'Services', subtitle: 'Un service appartient à un seul bureau.', fields: [
      { key: 'nom', label: 'Nom du service', type: 'text', req: true },
      { key: 'bureau_id', label: 'Bureau', type: 'select', source: ['bureaux', 'nom'], req: true }],
      columns: [{ key: 'nom', label: 'Service' }, { key: 'bureau_nom', label: 'Bureau' }] }),
    crud('categories', { resource: 'categories', title: 'Catégories', subtitle: 'Familles de matières : mobilier, véhicules, fournitures…', fields: [
      { key: 'nom', label: 'Nom', type: 'text', req: true },
      { key: 'type', label: 'Type', type: 'select', def: 'DURABLE',
        options: [{ value: 'DURABLE', label: 'Durable' }, { value: 'CONSOMMABLE', label: 'Consommable' }] }],
      columns: [{ key: 'nom', label: 'Catégorie' }, { key: 'type', label: 'Type', labels: { DURABLE: 'Durable', CONSOMMABLE: 'Consommable' } }] }),
    crud('utilisateurs', { resource: 'utilisateurs', title: 'Utilisateurs', subtitle: 'L\'administrateur gère tout ; l\'utilisateur simple suit uniquement le contrôle annuel.', fields: [
      { key: 'nom', label: 'Nom complet', type: 'text', req: true },
      { key: 'email', label: 'Adresse e-mail', type: 'email', req: true },
      { key: 'password', label: 'Mot de passe (6 caractères min.)', type: 'password', reqNew: true, hint: 'Laissez vide pour ne pas le changer.' },
      { key: 'role', label: 'Rôle', type: 'select', def: 'user', req: true,
        options: [{ value: 'user', label: 'Utilisateur simple' }, { value: 'admin', label: 'Administrateur' }] }],
      columns: [{ key: 'nom', label: 'Nom' }, { key: 'email', label: 'E-mail' },
        { key: 'role', label: 'Rôle', labels: { admin: 'Administrateur', user: 'Utilisateur simple' } }] }),
    { path: 'controle', component: Controle },
  ] },
  { path: '**', redirectTo: '' }
];
