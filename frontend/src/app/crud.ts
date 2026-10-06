import { Component, HostListener, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Api, msg } from './api';

@Component({
  selector: 'app-crud', imports: [FormsModule, DecimalPipe],
  template: `
  <header class="page-head">
    <div><h1>{{ cfg.title }}</h1><p class="sub">{{ cfg.subtitle }}</p></div>
    <button class="primary" (click)="add()">Ajouter</button>
  </header>
  @if (error()) { <p class="error">{{ error() }}</p> }
  <div class="toolbar"><input class="search" type="search" placeholder="Rechercher…" [ngModel]="term()" (ngModelChange)="term.set($event)">
    <span class="muted">{{ filtered().length }} élément(s)</span></div>
  <div class="scroll"><table>
    <thead><tr>@for (c of cfg.columns; track c.key) { <th [class.num]="c.num">{{ c.label }}</th> }<th></th></tr></thead>
    <tbody>
      @for (r of filtered(); track r.id) {
        <tr [class.low]="cfg.mouvement && r.quantite <= r.seuil">
          @for (c of cfg.columns; track c.key) {
            <td [class.num]="c.num">
              @if (c.labels) { <span class="tag" [attr.data-v]="r[c.key]">{{ c.labels[r[c.key]] || r[c.key] }}</span> }
              @else if (c.num) { {{ (r[c.key] ?? null) === null ? '—' : (r[c.key] | number:'1.0-0') }} }
              @else { {{ r[c.key] ?? '—' }} }
            </td>
          }
          <td class="actions">
            @if (cfg.mouvement) { <button (click)="move(r,'ENTREE')">+ Entrée</button><button (click)="move(r,'SORTIE')">− Sortie</button> }
            <button (click)="edit(r)">Modifier</button><button class="danger" (click)="del(r)">Supprimer</button>
          </td>
        </tr>
      } @empty { <tr><td [attr.colspan]="cfg.columns.length + 1" class="empty-row">{{ loading() ? 'Chargement…' : 'Rien à afficher. Utilisez « Ajouter » pour créer le premier élément.' }}</td></tr> }
    </tbody>
  </table></div>

  @if (form(); as f) {
    <div class="backdrop" (click)="$event.target === $event.currentTarget && form.set(null)">
      <div class="modal" role="dialog" aria-modal="true">
        <h2>{{ f.id ? 'Modifier' : 'Ajouter' }} — {{ cfg.title.toLowerCase() }}</h2>
        @if (formError()) { <p class="error">{{ formError() }}</p> }
        <div class="grid">
          @for (fd of cfg.fields; track fd.key) {
            <label>{{ fd.label }}@if (fd.req || (fd.reqNew && !f.id)) {<i> *</i>}
              @if (fd.type === 'select') {
                <select [(ngModel)]="f[fd.key]">
                  <option [ngValue]="null">—</option>
                  @for (o of opts(fd); track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                </select>
              } @else { <input [type]="fd.type" [(ngModel)]="f[fd.key]" [attr.autocomplete]="fd.type === 'password' ? 'new-password' : null"> }
              @if (fd.hint && f.id) { <small class="muted">{{ fd.hint }}</small> }
            </label>
          }
        </div>
        <div class="row end"><button (click)="form.set(null)">Annuler</button><button class="primary" (click)="save()">Enregistrer</button></div>
      </div>
    </div>
  }`
})
export class Crud implements OnInit {
  api = inject(Api);
  cfg: any = inject(ActivatedRoute).snapshot.data;
  loading = signal(true); rows = signal<any[]>([]); form = signal<any>(null); error = signal(''); formError = signal(''); term = signal('');
  filtered = computed(() => {
    const t = this.term().trim().toLowerCase();
    return t ? this.rows().filter(r => Object.values(r).join(' ').toLowerCase().includes(t)) : this.rows();
  });
  lookups: Record<string, any[]> = {};

  ngOnInit() { this.load(); this.loadLookups(); }
  @HostListener('document:keydown.escape') esc() { this.form.set(null); }
  private loadLookups() {
    for (const f of this.cfg.fields) if (f.source) this.api.list(f.source[0]).subscribe(l => this.lookups[f.key] = l);
  }
  opts(f: any) { return f.options || (this.lookups[f.key] || []).map(x => ({ value: x.id, label: x[f.source[1]] })); }
  load() { this.api.list(this.cfg.resource).subscribe({ next: r => this.rows.set(r), error: e => this.error.set(msg(e)) }); }
  add() {
    const f: any = {};
    for (const fd of this.cfg.fields) f[fd.key] = fd.def ?? null;
    this.formError.set(''); this.loadLookups(); this.form.set(f);
  }
  edit(r: any) { this.formError.set(''); this.loadLookups(); this.form.set({ ...r }); }
  save() {
    const f = this.form(); this.formError.set('');
    for (const fd of this.cfg.fields) {
      const required = fd.req || (fd.reqNew && !f.id);
      if (required && (f[fd.key] === null || f[fd.key] === '' || f[fd.key] === undefined)) {
        this.formError.set(`Le champ « ${fd.label.replace(/ \(.*\)/, '')} » est obligatoire.`); return;
      }
    }
    const req = f.id ? this.api.put(`${this.cfg.resource}/${f.id}`, f) : this.api.post(this.cfg.resource, f);
    req.subscribe({ next: () => { this.form.set(null); this.load(); }, error: e => this.formError.set(msg(e)) });
  }
  del(r: any) {
    if (!confirm('Supprimer cet élément ?')) return;
    this.error.set('');
    this.api.remove(`${this.cfg.resource}/${r.id}`).subscribe({ next: () => this.load(), error: e => this.error.set(msg(e)) });
  }
  move(r: any, type: string) {
    const q = parseInt(prompt(`${type === 'ENTREE' ? 'Entrée' : 'Sortie'} de « ${r.designation} » — quantité :`) || '', 10);
    if (!(q > 0)) return;
    this.error.set('');
    this.api.post(`consommables/${r.id}/mouvement`, { type, quantite: q })
      .subscribe({ next: () => this.load(), error: e => this.error.set(msg(e)) });
  }
}
