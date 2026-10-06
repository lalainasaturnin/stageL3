import { Component, inject, signal, computed } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from './api';
import { Icon } from './icon';

@Component({
  selector: 'app-root', imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
  @if (showNav()) {
    <div class="shell">
      <aside class="side noprint">
        <a class="brand" routerLink="/"><span class="logo"><app-icon name="box" /></span>Compta matières</a>
        <nav>
          @if (api.isAdmin) {
            <a routerLink="/dashboard" routerLinkActive="on"><app-icon name="grid" />Tableau de bord</a>
            <a routerLink="/biens" routerLinkActive="on"><app-icon name="box" />Biens durables</a>
            <a routerLink="/consommables" routerLinkActive="on"><app-icon name="layers" />Consommables</a>
          }
          <a routerLink="/controle" routerLinkActive="on"><app-icon name="check" />Contrôle annuel</a>
          @if (api.isAdmin) {
            <span class="group">Organisation</span>
            <a routerLink="/bureaux" routerLinkActive="on"><app-icon name="building" />Bureaux</a>
            <a routerLink="/services" routerLinkActive="on"><app-icon name="briefcase" />Services</a>
            <a routerLink="/categories" routerLinkActive="on"><app-icon name="tag" />Catégories</a>
            <a routerLink="/utilisateurs" routerLinkActive="on"><app-icon name="users" />Utilisateurs</a>
          }
        </nav>
        <div class="who">
          <span class="avatar">{{ initials() }}</span>
          <div><b>{{ api.user()?.nom }}</b><small>{{ api.isAdmin ? 'Administrateur' : 'Utilisateur simple' }}</small></div>
          <button class="icon-btn" (click)="out()" title="Se déconnecter" aria-label="Se déconnecter"><app-icon name="logout" /></button>
        </div>
      </aside>
      <main><router-outlet /></main>
    </div>
  } @else { <router-outlet /> }`
})
export class App {
  api = inject(Api); private router = inject(Router);
  url = signal(this.router.url);
  showNav = computed(() => !!this.api.user() && !['/', '/login'].includes(this.url().split('?')[0]));
  initials = computed(() => (this.api.user()?.nom || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase());
  constructor() {
    this.router.events.subscribe(e => { if (e instanceof NavigationEnd) this.url.set(e.urlAfterRedirects); });
  }
  out() { this.api.logout(); this.router.navigate(['/login']); }
}
