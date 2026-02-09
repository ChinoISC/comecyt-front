import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { Usuario } from '../../core/models/user';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

/** Niveles de visibilidad en el módulo público de investigadoras e investigadores */
export type VisibilidadPerfil = 'MINIMA' | 'ESTANDAR' | 'COMPLETA';

interface PerfilCompleto {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  curp: string;
  rfc: string;
  genero: string;
  fechaNacimiento: string;
  nacionalidad: string;
  paisNacimiento: string;
  entidadFederativa: string;
  estadoCivil: string;
  gradoAcademico: string;
  fotoDocumentoId: number | null;
  curriculumDocumentoId: number | null;
  visibilidadPerfil: VisibilidadPerfil;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  perfil: PerfilCompleto | null = null;
  loading = true;
  
  fotoFile: File | null = null;
  fotoPreview: string | SafeResourceUrl | null = null;
  curriculumFile: File | null = null;
  curriculumPreview: string | null = null;
  
  uploading = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.loading = true;
    this.authService.me().subscribe({
      next: (usuario: Usuario) => {
        // Convertir Usuario a PerfilCompleto
        this.perfil = {
          id: usuario.id,
          nombre: usuario.nombre || '',
          apellidoPaterno: usuario.apellidoPaterno || '',
          apellidoMaterno: usuario.apellidoMaterno || '',
          email: usuario.email || '',
          curp: usuario.curp || '',
          rfc: usuario.rfc || '',
          genero: usuario.genero || '',
          fechaNacimiento: usuario.fechaNacimiento || '',
          nacionalidad: usuario.nacionalidad || '',
          paisNacimiento: usuario.paisNacimiento || '',
          entidadFederativa: usuario.entidadFederativa || '',
          estadoCivil: usuario.estadoCivil || '',
          gradoAcademico: usuario.gradoAcademico || '',
          fotoDocumentoId: usuario.fotoDocumentoId || null,
          curriculumDocumentoId: usuario.curriculumDocumentoId || null,
          visibilidadPerfil: (usuario.visibilidadPerfil === 'MINIMA' || usuario.visibilidadPerfil === 'COMPLETA' ? usuario.visibilidadPerfil : 'ESTANDAR') as VisibilidadPerfil
        };
        
        // Cargar foto y curriculum si existen
        if (this.perfil.fotoDocumentoId) {
          this.cargarFoto(this.perfil.fotoDocumentoId);
        }
        if (this.perfil.curriculumDocumentoId) {
          this.cargarCurriculum(this.perfil.curriculumDocumentoId);
        }
        
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar el perfil. Por favor, intente nuevamente.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  cargarFoto(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.fotoPreview = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        },
        error: () => {
          // Si hay error, simplemente no mostrar la foto
          this.fotoPreview = null;
        }
      });
  }

  cargarCurriculum(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.curriculumPreview = url;
        },
        error: () => {
          // Si hay error, simplemente no mostrar el curriculum
          this.curriculumPreview = null;
        }
      });
  }

  onFotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El archivo debe ser una imagen',
          confirmButtonColor: '#800020'
        });
        return;
      }
      
      // Validar tamaño (10MB)
      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El archivo es demasiado grande. Máximo 10MB',
          confirmButtonColor: '#800020'
        });
        return;
      }
      
      this.fotoFile = file;
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.fotoPreview = this.sanitizer.bypassSecurityTrustResourceUrl(result);
      };
      reader.readAsDataURL(file);
    }
  }

  onCurriculumChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar que sea un PDF
      if (file.type !== 'application/pdf') {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El archivo debe ser un PDF',
          confirmButtonColor: '#800020'
        });
        return;
      }
      
      // Validar tamaño (10MB)
      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El archivo es demasiado grande. Máximo 10MB',
          confirmButtonColor: '#800020'
        });
        return;
      }
      
      this.curriculumFile = file;
      
      // Para PDF, solo guardamos el nombre del archivo
      this.curriculumPreview = file.name;
    }
  }

  elegirVisibilidad(nivel: VisibilidadPerfil): void {
    if (this.perfil) {
      this.perfil.visibilidadPerfil = nivel;
    }
  }

  guardarCambios(): void {
    if (!this.perfil) return;
    
    this.uploading = true;
    
    // Mostrar loading
    Swal.fire({
      title: 'Guardando cambios...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    const uploads: Promise<any>[] = [];
    
    // Guardar preferencia de visibilidad (PATCH /me)
    uploads.push(
      this.http.patch(`${environment.apiBaseUrl}/usuarios/me`, {
        visibilidadPerfil: this.perfil.visibilidadPerfil
      }).toPromise()
    );
    
    // Subir foto si hay nueva
    if (this.fotoFile) {
      const formData = new FormData();
      formData.append('foto', this.fotoFile);
      
      uploads.push(
        this.http.post(`${environment.apiBaseUrl}/usuarios/me/foto`, formData).toPromise()
      );
    }
    
    // Subir curriculum si hay nuevo
    if (this.curriculumFile) {
      const formData = new FormData();
      formData.append('curriculum', this.curriculumFile);
      
      uploads.push(
        this.http.post(`${environment.apiBaseUrl}/usuarios/me/curriculum`, formData).toPromise()
      );
    }
    
    // Esperar a que todas las subidas terminen
    Promise.all(uploads)
      .then(() => {
        this.uploading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Cambios guardados correctamente',
          confirmButtonColor: '#800020'
        }).then(() => {
          // Recargar perfil para actualizar IDs
          this.cargarPerfil();
        });
      })
      .catch((error) => {
        this.uploading = false;
        const body = error?.error;
        const errorMessage = (typeof body === 'object' && body != null && 'message' in body)
          ? (body as { message?: string }).message
          : (typeof body === 'string' ? body : null);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage || error?.message || 'No se pudieron guardar los cambios. Por favor, intente nuevamente.',
          confirmButtonColor: '#800020'
        });
      });
  }

  descargarCurriculum(): void {
    if (!this.perfil?.curriculumDocumentoId) return;
    
    this.http.get(`${environment.apiBaseUrl}/documentos/${this.perfil.curriculumDocumentoId}`, { 
      responseType: 'blob' 
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'curriculum.pdf';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo descargar el curriculum',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  formatearGenero(genero: string): string {
    const generos: { [key: string]: string } = {
      'MASCULINO': 'Masculino',
      'FEMENINO': 'Femenino',
      'OTRO': 'Otro'
    };
    return generos[genero] || genero;
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    // Si la fecha viene en formato yyyy-MM-dd, convertirla correctamente sin restar un día
    const partes = fecha.split('-');
    if (partes.length === 3) {
      // Crear fecha en formato local (sin considerar zona horaria)
      const anio = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Los meses en JavaScript van de 0-11
      const dia = parseInt(partes[2], 10);
      const date = new Date(anio, mes, dia);
      return date.toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    }
    // Si viene en otro formato, intentar parsearlo normalmente
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha; // Si no se puede parsear, devolver original
    return date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }
}
