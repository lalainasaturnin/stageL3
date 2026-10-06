import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from './api';
import { Icon } from './icon';

@Component({
  selector: 'app-home', imports: [RouterLink, Icon],
  template: `
  <header class="topbar">
    <a class="brand" routerLink="/"><span class="logo"><app-icon name="box" /></span>Compta matières</a>
    <a class="btn primary" [routerLink]="api.token ? api.home : '/login'">{{ api.token ? 'Ouvrir l’application' : 'Se connecter' }}</a>
  </header>
  <section class="hero">
    <div class="hero-text">
      <h1>Chaque bien à sa place, contrôlé chaque année.</h1>
      <p>Suivez le mobilier, les véhicules et les fournitures de l'entreprise, bureau par bureau et service par service,
        et menez l'inventaire annuel sans papier égaré.</p>
      <a class="btn primary big" [routerLink]="api.token ? api.home : '/login'">{{ api.token ? 'Ouvrir l’application' : 'Se connecter' }}</a>
    </div>
    <div class="mock" aria-hidden="true">
      <div class="mock-head"><b>Contrôle 2026</b><span class="muted">68 % terminé</span></div>
      <div class="bar-track"><i style="width:68%"></i></div>
      <ul>
        <li><div><b>Bureau en bois</b><small>INV-0012 · Finances</small></div><span class="tag" data-v="BON">Présent</span></li>
        <li><div><b>Moto Yamaha</b><small>INV-0041 · Logistique</small></div><span class="tag" data-v="HORS_SERVICE">Manquant</span></li>
        <li><div><b>Armoire métallique</b><small>INV-0027 · Ressources humaines</small></div><span class="tag" data-v="USE">Déplacé</span></li>
        <li><div><b>Ordinateur portable</b><small>INV-0058 · Finances</small></div><span class="tag" data-v="BON">Présent</span></li>
      </ul>
    </div>
  </section>
  <section class="points">
    <article><span class="chip c1"><app-icon name="box" /></span><h3>Biens et consommables</h3>
      <p>Chaque objet durable a son numéro d'inventaire. Les fournitures ont un stock et un seuil d'alerte.</p></article>
    <article><span class="chip c2"><app-icon name="building" /></span><h3>Bureaux et services</h3>
      <p>Un bureau regroupe plusieurs services ; un service appartient à un seul bureau.</p></article>
    <article><span class="chip c3"><app-icon name="check" /></span><h3>Contrôle annuel</h3>
      <p>Présent, manquant, déplacé : les écarts apparaissent aussitôt et le procès-verbal s'imprime en un clic.</p></article>
  </section>
  <footer class="foot">Compta matières · Gestion de la comptabilité matières</footer>`
})
export class Home { api = inject(Api); }
