import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, msg } from './api';

const ETATS: [string, string][] = [['NEUF', 'Neuf'], ['BON', 'Bon'], ['USE', 'Usé'], ['HORS_SERVICE', 'Hors service']];

@Component({
  selector: 'app-controle', imports: [FormsModule],
  template: `
  <header class="page-head">
    <div><h1>Contrôle annuel</h1>
      <p class="sub">{{ api.isAdmin ? 'Ouvrez la campagne de l’année, puis pointez chaque bien : présent, manquant ou déplacé.' : 'Suivi de l’avancement du contrôle (lecture seule).' }}</p></div>
    @if (api.isAdmin) {
      <div class="row noprint"><input type="number" [(ngModel)]="annee" style="width:6.5rem" aria-label="Année">
        <button class="primary" (click)="create()">Ouvrir la campagne</button></div>
    }
  </header>
  @if (error()) { <p class="error">{{ error() }}</p> }
  <div class="tabs noprint">
    @for (c of camps(); track c.id) {
      <button [class.on]="cur()?.id === c.id" (click)="open(c)">{{ c.annee }} <small>{{ c.controles }}/{{ c.total }}</small></button>
    } @empty { <span class="muted">Aucune campagne pour l'instant.</span> }
  </div>
  @if (cur(); as c) {
    <section class="summary">
      <div class="sum-main"><b>{{ c.controles }}<small> / {{ c.total }}</small></b><span>biens contrôlés</span>
        <div class="bar-track"><i [style.width.%]="c.total ? 100 * c.controles / c.total : 0"></i></div></div>
      <div><b class="bad-t">{{ c.manquants }}</b><span>manquant(s)</span></div>
      <div><b class="warn-t">{{ c.deplaces }}</b><span>déplacé(s)</span></div>
      <div><b>{{ c.statut === 'OUVERTE' ? 'Ouverte' : 'Clôturée' }}</b><span>campagne {{ c.annee }}</span></div>
      <div class="row noprint"><button (click)="print()">Imprimer le procès-verbal</button>
        @if (api.isAdmin && c.statut === 'OUVERTE') { <button class="danger" (click)="close()">Clôturer</button> }</div>
    </section>
    <div class="scroll"><table>
      <thead><tr><th>N°</th><th>Bien</th><th>Emplacement attendu</th><th>Constat</th><th>État constaté</th><th>Service constaté</th><th>Observation</th><th>Écart</th>@if (!ro()) {<th class="noprint"></th>}</tr></thead>
      <tbody>
        @for (r of rows(); track r.id) {
          <tr>
            <td>{{ r.numero_inventaire }}</td><td><b>{{ r.designation }}</b></td>
            <td>{{ r.service_attendu ?? '—' }}<small class="sub-line">{{ r.bureau_attendu }}</small></td>
            @if (ro()) {
              <td>{{ r.present === null ? 'À contrôler' : r.present ? 'Présent' : 'Manquant' }}</td>
              <td>{{ r.present ? lab(r.etat_constate) : '—' }}</td><td>{{ r.present ? (r.service_constate ?? '—') : '—' }}</td><td>{{ r.observation ?? '' }}</td>
            } @else {
              <td><select [(ngModel)]="r._p"><option value="">À contrôler</option><option value="true">Présent</option><option value="false">Manquant</option></select></td>
              <td><select [(ngModel)]="r._e" [disabled]="r._p !== 'true'">@for (e of etats; track e[0]) { <option [value]="e[0]">{{ e[1] }}</option> }</select></td>
              <td><select [(ngModel)]="r._s" [disabled]="r._p !== 'true'"><option [ngValue]="null">—</option>
                @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.libelle }}</option> }</select></td>
              <td><input [(ngModel)]="r._o" placeholder="Remarque"></td>
            }
            <td><span class="badge" [class.bad]="ecart(r)">{{ ecart(r) || (r.date_controle ? 'Conforme' : '—') }}</span></td>
            @if (!ro()) { <td class="noprint"><button (click)="save(r)" [disabled]="r._p === ''">Enregistrer</button></td> }
          </tr>
        } @empty { <tr><td colspan="9" class="empty-row">{{ loading() ? 'Chargement…' : 'Aucun bien dans cette campagne. Ajoutez d\'abord des biens durables.' }}</td></tr> }
      </tbody>
    </table></div>
  }`
})
export class Controle implements OnInit {
  api = inject(Api);
  loading = signal(true); camps = signal<any[]>([]); cur = signal<any>(null); rows = signal<any[]>([]); services = signal<any[]>([]);
  error = signal(''); annee = new Date().getFullYear(); etats = ETATS;
  ro = computed(() => !this.api.isAdmin || this.cur()?.statut !== 'OUVERTE');
  lab = (e: string) => ETATS.find(x => x[0] === e)?.[1] ?? '—';

  ngOnInit() { this.api.list('services').subscribe(s => this.services.set(s)); this.reload(); }
  reload(openId?: number) {
    this.api.list('campagnes').subscribe({ next: l => {
      this.camps.set(l);
      const c = l.find(x => x.id === (openId ?? this.cur()?.id)) || l.find(x => x.statut === 'OUVERTE') || l[0];
      if (c) this.open(c); else this.cur.set(null);
    }, error: e => this.error.set(msg(e)) });
  }
  open(c: any) {
    this.cur.set(c); this.loading.set(true);
    this.api.get(`campagnes/${c.id}/controles`).subscribe((rs: any[]) => { this.loading.set(false); this.rows.set(rs.map((r: any) => ({
      ...r, _p: r.present === null ? '' : String(r.present), _e: r.etat_constate ?? r.etat_attendu,
      _s: r.service_constate_id ?? r.service_attendu_id, _o: r.observation ?? '' }))); });
  }
  create() {
    this.error.set('');
    this.api.post('campagnes', { annee: this.annee }).subscribe({ next: c => this.reload(c.id), error: e => this.error.set(msg(e)) });
  }
  close() {
    if (!confirm('Clôturer la campagne ? Les constats ne seront plus modifiables.')) return;
    this.api.post(`campagnes/${this.cur().id}/cloturer`).subscribe({ next: () => this.reload(), error: e => this.error.set(msg(e)) });
  }
  save(r: any) {
    this.error.set('');
    this.api.put(`controles/${r.id}`, { present: r._p === 'true', etat_constate: r._e, service_constate_id: r._s, observation: r._o })
      .subscribe({ next: () => this.reload(), error: e => this.error.set(msg(e)) });
  }
  ecart(r: any): string {
    if (r.present === null) return '';
    if (!r.present) return 'Manquant';
    if (r.service_constate_id !== r.service_attendu_id) return 'Déplacé';
    if (r.etat_constate !== r.etat_attendu) return 'État différent';
    return '';
  }
  print() { window.print(); }
}
