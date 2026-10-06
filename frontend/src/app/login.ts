import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, msg } from './api';
import { Icon } from './icon';

@Component({
  selector: 'app-login', imports: [FormsModule, RouterLink, Icon],
  template: `
  <div class="auth">
    <aside class="auth-art">
      <a class="brand" routerLink="/"><span class="logo"><app-icon name="box" /></span>Compta matières</a>
      <div><h2>Bon retour parmi nous.</h2><p>Retrouvez vos bureaux, vos services et le contrôle de l'année en cours.</p></div>
      <i class="ring r1"></i><i class="ring r2"></i>
    </aside>
    <main class="auth-form">
      <div class="auth-box">
        <h1>Connexion</h1>
        <p class="sub">Saisissez les identifiants fournis par votre administrateur.</p>
        <label>Adresse e-mail<input type="email" [(ngModel)]="email" (keyup.enter)="go()" autocomplete="username" placeholder="nom@entreprise.mg"></label>
        <label>Mot de passe<input type="password" [(ngModel)]="password" (keyup.enter)="go()" autocomplete="current-password"></label>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="primary big" (click)="go()" [disabled]="busy()">Se connecter</button>
        <a routerLink="/" class="back">Retour à l'accueil</a>
      </div>
    </main>
  </div>`
})
export class Login {
  private api = inject(Api); private router = inject(Router);
  email = ''; password = ''; error = signal(''); busy = signal(false);
  go() {
    this.busy.set(true); this.error.set('');
    this.api.login(this.email, this.password).subscribe({
      next: () => this.router.navigate([this.api.home]),
      error: e => { this.error.set(msg(e)); this.busy.set(false); }
    });
  }
}
