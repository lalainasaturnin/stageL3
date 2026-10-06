import { Component, ElementRef, Input, OnChanges, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { Chart, BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
Chart.register(BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  selector: 'app-chart',
  template: `@if (empty) { <p class="empty">Pas encore de données à afficher.</p> }
    <div class="cv" [hidden]="empty"><canvas #c></canvas></div>`,
  styles: [`:host{display:block;height:100%}.cv{position:relative;height:100%;min-height:220px}.empty{margin:2rem 0;text-align:center;color:#6b7194}`]
})
export class ChartCmp implements AfterViewInit, OnChanges, OnDestroy {
  @Input() type: 'bar' | 'doughnut' = 'bar';
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() colors: string[] = ['#3340c8'];
  @Input() horizontal = false;
  @Input() title = '';
  @ViewChild('c') cv!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  get empty() { return !this.data.length || this.data.every(v => !v); }
  ngAfterViewInit() { this.draw(); }
  ngOnChanges() { if (this.cv) this.draw(); }
  ngOnDestroy() { this.chart?.destroy(); }
  private draw() {
    this.chart?.destroy(); this.chart = undefined;
    if (this.empty) return;
    const bar = this.type === 'bar';
    const compact = (v: any) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));
    this.chart = new Chart(this.cv.nativeElement, {
      type: this.type,
      data: { labels: this.labels, datasets: [{ label: this.title, data: this.data, backgroundColor: this.colors,
        borderWidth: bar ? 0 : 3, borderColor: '#fff', borderRadius: bar ? 6 : 0, maxBarThickness: 38 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: this.horizontal ? 'y' : 'x',
        cutout: bar ? undefined : '66%',
        plugins: { legend: { display: !bar, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14, font: { family: 'inherit' } } } },
        scales: bar ? {
          x: { grid: { display: this.horizontal, color: '#eceef7' }, border: { display: false }, ticks: { font: { family: 'inherit' }, ...(this.horizontal ? { callback: compact } : {}) } },
          y: { beginAtZero: true, grid: { display: !this.horizontal, color: '#eceef7' }, border: { display: false }, ticks: { precision: 0, font: { family: 'inherit' }, ...(this.horizontal ? {} : { callback: compact }) } }
        } : {}
      }
    });
  }
}
