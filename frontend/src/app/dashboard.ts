import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Api, msg } from './api';
import { Icon } from './icon';
import { ChartCmp } from './chart';

const ETAT: any = { NEUF: 'Neuf', BON: 'Bon', USE: 'Usé', HORS_SERVICE: 'Hors service' };
const ETAT_COL: any = { NEUF: '#1f9d72', BON: '#3340c8', USE: '#f4a62a', HORS_SERVICE: '#e0525a' };
const PALETTE = ['#3340c8', '#f4a62a', '#1f9d72', '#e0525a', '#4fa3e0', '#8a5cf6'];

@Component({
  selector: 'app-dashboard', imports: [RouterLink, DatePipe, DecimalPipe, Icon, ChartCmp],
  template: `
  <header class="page-head">
    <div><h1>Bonjour, {{ prenom }}</h1><p class="sub">{{ today | date:'fullDate' }} · voici l'état de vos matières.</p></div>
    <a class="btn primary" routerLink="/controle">Aller au contrôle annuel</a>
  </header>
  @if (error()) { <p class="error">{{ error() }}</p> }
  @if (v(); as v) {
    <section class="kpis">
      <div class="kpi"><span class="chip c1"><app-icon name="box" /></span><div><b>{{ v.kpis.biens | number }}</b><span>biens durables</span></div></div>
      <div class="kpi"><span class="chip c2"><app-icon name="coin" /></span><div><b>{{ v.kpis.valeur | number:'1.0-0' }} Ar</b><span>valeur totale</span></div></div>
      <div class="kpi"><span class="chip c3"><app-icon name="building" /></span><div><b>{{ v.kpis.bureaux }}</b><span>bureaux</span></div></div>
      <div class="kpi"><span class="chip c4"><app-icon name="briefcase" /></span><div><b>{{ v.kpis.services }}</b><span>services</span></div></div>
      <div class="kpi" [class.warn]="v.kpis.alertes > 0"><span class="chip c5"><app-icon name="alert" /></span><div><b>{{ v.kpis.alertes }}</b><span>consommables en alerte</span></div></div>
      <div class="kpi" [class.warn]="v.kpis.hors_service > 0"><span class="chip c5"><app-icon name="tool" /></span><div><b>{{ v.kpis.hors_service }}</b><span>biens hors service</span></div></div>
      <div class="kpi"><span class="chip c6"><app-icon name="layers" /></span><div><b>{{ v.kpis.consommables }}</b><span>articles consommables</span></div></div>
      <div class="kpi"><span class="chip c6"><app-icon name="users" /></span><div><b>{{ v.kpis.utilisateurs }}</b><span>utilisateurs</span></div></div>
    </section>

    <section class="dash">
      <article class="card s8"><h3>Biens par service</h3><p class="sub">Les 8 services qui détiennent le plus de biens.</p>
        <div class="chart"><app-chart type="bar" title="Biens" [labels]="v.svcLabels" [data]="v.svcData" [colors]="['#3340c8']" /></div></article>
      <article class="card s4"><h3>État des biens</h3><p class="sub">Répartition selon l'état constaté.</p>
        <div class="chart"><app-chart type="doughnut" [labels]="v.etatLabels" [data]="v.etatData" [colors]="v.etatColors" /></div></article>

      <article class="card s4"><h3>Contrôle {{ v.ctrl ? v.ctrl.annee : '' }}</h3>
        @if (v.ctrl) {
          <p class="sub">{{ v.ctrl.controles }} bien(s) contrôlé(s) sur {{ v.ctrl.total }} — {{ v.ctrl.pct }} %</p>
          <div class="chart"><app-chart type="doughnut" [labels]="['À leur place','Déplacés','Manquants','À contrôler']" [data]="v.ctrlData"
            [colors]="['#1f9d72','#f4a62a','#e0525a','#d7dbee']" /></div>
        } @else { <p class="sub">Aucune campagne pour le moment.</p>
          <p><a routerLink="/controle" class="link">Lancer le contrôle de l'année</a></p> }</article>
      <article class="card s8"><h3>Valeur par catégorie</h3><p class="sub">En ariary, pour les catégories qui comptent le plus.</p>
        <div class="chart"><app-chart type="bar" [horizontal]="true" title="Valeur (Ar)" [labels]="v.catLabels" [data]="v.catData" [colors]="v.catColors" /></div></article>

      <article class="card s4"><h3>Stock à réapprovisionner</h3>
        <ul class="list">
          @for (a of v.alertes_stock; track a.id) {
            <li><span>{{ a.designation }}</span><span class="pill bad">{{ a.quantite }} / {{ a.seuil }} {{ a.unite }}</span></li>
          } @empty { <li class="muted">Tous les stocks sont au-dessus du seuil.</li> }
        </ul></article>
      <article class="card s4"><h3>Derniers mouvements</h3>
        <ul class="list">
          @for (m of v.mouvements; track $index) {
            <li><span>{{ m.designation }}<small>{{ m.date | date:'dd/MM HH:mm' }} · {{ m.utilisateur || '—' }}</small></span>
              <span class="pill" [class.ok]="m.type === 'ENTREE'" [class.bad]="m.type === 'SORTIE'">{{ m.type === 'ENTREE' ? '+' : '−' }}{{ m.quantite }}</span></li>
          } @empty { <li class="muted">Aucun mouvement enregistré.</li> }
        </ul></article>
      <article class="card s4"><h3>Derniers biens ajoutés</h3>
        <ul class="list">
          @for (b of v.derniers_biens; track b.numero_inventaire) {
            <li><span>{{ b.designation }}<small>{{ b.numero_inventaire }} · {{ b.service_nom || 'sans service' }}</small></span>
              <span class="tag" [attr.data-v]="b.etat">{{ etat(b.etat) }}</span></li>
          } @empty { <li class="muted">Aucun bien enregistré.</li> }
        </ul></article>
    </section>
  } @else if (!error()) { <p class="muted">Chargement…</p> }`
})
export class Dashboard implements OnInit {
  private api = inject(Api);
  v = signal<any>(null); error = signal(''); today = new Date();
  prenom = (this.api.user()?.nom || '').split(' ')[0];
  etat = (e: string) => ETAT[e] || e;
  ngOnInit() {
    this.api.get('dashboard').subscribe({ next: d => this.v.set(this.prep(d)), error: e => this.error.set(msg(e)) });
  }
  private prep(d: any) {
    const c = d.controle;
    const ctrl = c ? { ...c, pct: c.total ? Math.round(100 * c.controles / c.total) : 0 } : null;
    return { ...d, ctrl,
      svcLabels: d.par_service.map((x: any) => x.nom), svcData: d.par_service.map((x: any) => x.nb),
      etatLabels: d.par_etat.map((x: any) => ETAT[x.etat]), etatData: d.par_etat.map((x: any) => x.nb),
      etatColors: d.par_etat.map((x: any) => ETAT_COL[x.etat]),
      catLabels: d.par_categorie.map((x: any) => x.nom), catData: d.par_categorie.map((x: any) => x.valeur),
      catColors: d.par_categorie.map((_: any, i: number) => PALETTE[i % PALETTE.length]),
      ctrlData: ctrl ? [ctrl.presents - ctrl.deplaces, ctrl.deplaces, ctrl.manquants, ctrl.total - ctrl.controles] : [] };
  }
}
