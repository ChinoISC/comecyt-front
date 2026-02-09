import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PuntoMes {
  mes: string;
  etiqueta: string;
  cantidad: number;
}

export interface DashboardStats {
  totalUsuarios: number;
  investigadores: number;
  innovadores: number;
  cuentasActivas: number;
  cuentasSuspendidas: number;
  registrosPorMes: PuntoMes[];
  porTipoPerfil: Record<string, number>;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  loading = true;
  error: string | null = null;
  stats: DashboardStats | null = null;

  ngOnInit(): void {
    this.http.get<DashboardStats>(`${environment.apiBaseUrl}/admin/dashboard/stats`).subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'No se pudieron cargar las estadísticas';
        this.loading = false;
      }
    });
  }

  /** Máxima cantidad en registrosPorMes para escalar barras (0 evitado). */
  get maxRegistrosMes(): number {
    if (!this.stats?.registrosPorMes?.length) return 1;
    return Math.max(1, ...this.stats.registrosPorMes.map(p => p.cantidad));
  }

  /** Porcentaje de barra (0-100) para un punto. */
  barHeight(cantidad: number): number {
    return (cantidad / this.maxRegistrosMes) * 100;
  }

  /** Datos para gráfica circular: { label, valor, porcentaje }. */
  get pieData(): { label: string; valor: number; porcentaje: number }[] {
    if (!this.stats?.porTipoPerfil) return [];
    const total = this.stats.investigadores + this.stats.innovadores || 1;
    return [
      { label: 'Investigadores', valor: this.stats.investigadores, porcentaje: (this.stats.investigadores / total) * 100 },
      { label: 'Innovadores', valor: this.stats.innovadores, porcentaje: (this.stats.innovadores / total) * 100 }
    ];
  }

  /** Conic-gradient para dona: INVESTIGADOR % y INNOVADOR %. */
  get donutGradient(): string {
    const inv = this.stats?.investigadores ?? 0;
    const inn = this.stats?.innovadores ?? 0;
    const total = inv + inn || 1;
    const pctInv = (inv / total) * 100;
    return `conic-gradient(#6a0032 0% ${pctInv}%, #2d7d46 ${pctInv}% 100%)`;
  }
}
