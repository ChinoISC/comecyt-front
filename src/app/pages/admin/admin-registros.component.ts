import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface RegistroItem {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string | null;
  lastLoginAt?: string | null;
  curp?: string;
  tipoPerfil?: string;
  telefono?: string;
}

/** Detalle completo del usuario (respuesta de GET /admin/registros/:id) */
interface UsuarioDetalle {
  id: number;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email?: string;
  username?: string;
  lastLoginAt?: string | null;
  visibilidadPerfil?: string;
  enabled?: boolean;
  locked?: boolean;
  fotoDocumentoId?: number | null;
  curp?: string;
  rfc?: string;
  tipoPerfil?: string;
  telefono?: string;
  fechaNacimiento?: string;
  genero?: string;
  nacionalidad?: string;
  paisNacimiento?: string;
  entidadFederativa?: string;
  estadoCivil?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-admin-registros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-registros.component.html',
  styleUrls: ['./admin-registros.component.css']
})
export class AdminRegistrosComponent implements OnInit {
  private http = inject(HttpClient);
  loading = true;
  error: string | null = null;
  registros: RegistroItem[] = [];
  /** Texto para filtrar usuarios (nombre, email, CURP, teléfono, perfil). */
  filtroTexto = '';
  modalVisible = false;
  detalleLoading = false;
  detalle: UsuarioDetalle | null = null;
  /** URL de la foto de perfil (blob) para mostrar en el modal */
  fotoUrl: string | null = null;
  accionEnProceso = false;

  /** Lista de registros filtrada por filtroTexto. */
  get registrosFiltrados(): RegistroItem[] {
    const q = (this.filtroTexto || '').trim().toLowerCase();
    if (!q) return this.registros;
    return this.registros.filter(r => {
      const nombre = this.getNombreCompleto(r).toLowerCase();
      const email = (r.email || '').toLowerCase();
      const curp = (r.curp || '').toLowerCase();
      const telefono = (r.telefono || '').replace(/\s/g, '');
      const tipoPerfil = (r.tipoPerfil || '').toLowerCase();
      return nombre.includes(q) || email.includes(q) || curp.includes(q) ||
             telefono.includes(q.replace(/\s/g, '')) || tipoPerfil.includes(q);
    });
  }

  ngOnInit(): void {
    this.cargarRegistros();
  }

  cargarRegistros(): void {
    this.http.get<RegistroItem[]>(`${environment.apiBaseUrl}/admin/registros`).subscribe({
      next: (data) => {
        this.registros = data;
        this.loading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'No se pudo cargar el listado';
        this.loading = false;
      }
    });
  }

  getNombreCompleto(r: RegistroItem | UsuarioDetalle): string {
    const parts = [r.nombre, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean);
    return parts.join(' ') || '—';
  }

  /** Formatea fecha ISO al formato legible (fecha y hora local). */
  formatearFecha(iso: string | null | undefined): string {
    if (!iso) return 'Nunca';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
    } catch {
      return iso;
    }
  }

  verDetalle(id: number): void {
    this.detalle = null;
    this.fotoUrl = null;
    this.modalVisible = true;
    this.detalleLoading = true;
    this.http.get<UsuarioDetalle>(`${environment.apiBaseUrl}/admin/registros/${id}`).subscribe({
      next: (data) => {
        this.detalle = data;
        this.detalleLoading = false;
        if (data.fotoDocumentoId) {
          this.cargarFoto(data.fotoDocumentoId);
        }
      },
      error: () => {
        this.detalleLoading = false;
        this.cerrarModal();
      }
    });
  }

  private cargarFoto(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (this.fotoUrl) URL.revokeObjectURL(this.fotoUrl);
        this.fotoUrl = url;
      },
      error: () => {
        this.fotoUrl = null;
      }
    });
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.detalle = null;
    if (this.fotoUrl) {
      URL.revokeObjectURL(this.fotoUrl);
      this.fotoUrl = null;
    }
  }

  private get usuarioIdEnDetalle(): number | null {
    return this.detalle?.id ?? null;
  }

  confirmarSuspender(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    if (!confirm('¿Suspender la cuenta de este usuario? No podrá iniciar sesión hasta que se reactive.')) return;
    this.accionEnProceso = true;
    this.http.patch<{ message: string }>(`${environment.apiBaseUrl}/admin/registros/${id}/suspender`, {}).subscribe({
      next: () => {
        this.accionEnProceso = false;
        if (this.detalle) this.detalle.enabled = false;
        if (this.detalle) this.detalle.locked = true;
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al suspender');
      }
    });
  }

  confirmarReactivar(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    if (!confirm('¿Reactivar la cuenta de este usuario?')) return;
    this.accionEnProceso = true;
    this.http.patch<{ message: string }>(`${environment.apiBaseUrl}/admin/registros/${id}/reactivar`, {}).subscribe({
      next: () => {
        this.accionEnProceso = false;
        if (this.detalle) this.detalle.enabled = true;
        if (this.detalle) this.detalle.locked = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al reactivar');
      }
    });
  }

  confirmarRestablecerPassword(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    const nuevaPassword = prompt('Nueva contraseña (dejar vacío para generar una temporal):');
    if (nuevaPassword === null) return; // canceló
    this.accionEnProceso = true;
    const body = nuevaPassword.trim() ? { nuevaPassword: nuevaPassword.trim() } : {};
    this.http.post<{ message: string; nuevaPassword?: string }>(`${environment.apiBaseUrl}/admin/registros/${id}/reset-password`, body).subscribe({
      next: (res) => {
        this.accionEnProceso = false;
        const msg = res.nuevaPassword ? `Contraseña actualizada. Contraseña temporal: ${res.nuevaPassword}` : res.message;
        alert(msg);
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al restablecer contraseña');
      }
    });
  }

  confirmarEliminar(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    if (!confirm('¿Eliminar permanentemente este usuario y todos sus datos? Esta acción no se puede deshacer.')) return;
    this.accionEnProceso = true;
    this.http.delete(`${environment.apiBaseUrl}/admin/registros/${id}`).subscribe({
      next: () => {
        this.accionEnProceso = false;
        this.cerrarModal();
        this.registros = this.registros.filter(r => r.id !== id);
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al eliminar');
      }
    });
  }
}
