import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  AbstractControl,
  ValidationErrors,
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

/* ===== Validadores de archivos ===== */
function fileRequired(ctrl: AbstractControl): ValidationErrors | null {
  const f = ctrl.value as File | null;
  return f ? null : { requiredFile: true };
}
function fileMaxSizeMB(maxMB: number) {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const f = ctrl.value as File | null;
    if (!f) return null;
    return f.size <= maxMB * 1024 * 1024 ? null : { maxSize: { maxMB, size: f.size } };
  };
}
function fileAccept(acceptList: string[]) {
  const norm = acceptList.map(a => a.trim().toLowerCase());
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const f = ctrl.value as File | null;
    if (!f) return null;
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const mimeOk = !!f.type && norm.includes(f.type.toLowerCase());
    const extOk = norm.includes('.' + ext);
    return (mimeOk || extOk) ? null : { accept: { allow: acceptList, got: f.type || '.' + ext } };
  };
}

/* ===== RFC ===== */
// Permite X en los primeros 4 caracteres (cuando no hay suficiente información)
const RFC_REGEX = /^[A-ZÑ&X]{3,4}\d{6}[A-Z0-9]{2,3}$/;
function rfcValidator(ctrl: AbstractControl): ValidationErrors | null {
  const raw = ctrl.value as string | null;
  const v = (raw || '').toUpperCase().replace(/[-\s]/g, '');
  if (!v) return { required: true };
  return RFC_REGEX.test(v) ? null : { rfc: true };
}

/* ===== Tipado ===== */
type Step2Form = FormGroup<{
  cvFile: FormControl<File | null>;
  rfcNum: FormControl<string | null>;
  fiscalPdf: FormControl<File | null>;
  domicilio: FormControl<File | null>;
  certificados: FormArray<FormControl<File | null>>;
}>;
type FileKeys = 'cvFile' | 'fiscalPdf' | 'domicilio';

@Component({
  selector: 'app-registro-step2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro-step2.html',
  styleUrls: ['./registro-step2.css'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class RegistroStep2Component implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);
  
  readonly MAX_MB = 10;
  showCerts = false;
  submitting = false;
  archivosYaCargados = false; // Flag para indicar si ya se cargaron archivos

  // === Estado para el highlight de dropzones (lo usa el template con dragging()==='...') ===
  private _dragging: FileKeys | number | null = null;
  dragging(): FileKeys | number | null { return this._dragging; }

  form: Step2Form = this.fb.group({
    cvFile: this.fb.control<File | null>(null, [
      fileRequired, fileMaxSizeMB(this.MAX_MB), fileAccept(['.pdf', 'application/pdf'])
    ]),
    rfcNum: this.fb.control<string | null>(null, [rfcValidator]),
    fiscalPdf: this.fb.control<File | null>(null, [
      fileRequired, fileMaxSizeMB(this.MAX_MB), fileAccept(['.pdf', 'application/pdf'])
    ]),
    domicilio: this.fb.control<File | null>(null, [
      fileRequired,
      fileMaxSizeMB(this.MAX_MB),
      fileAccept(['.pdf','.jpg','.jpeg','.png','application/pdf','image/jpeg','image/png'])
    ]),
    certificados: this.fb.array<FormControl<File | null>>([]),
  });

  /** Alias para f.cvFile, f.rfcNum, etc. */
  f = this.form.controls;

  constructor() {
    // Normaliza RFC a mayúsculas y sin separadores
    this.f.rfcNum.valueChanges.subscribe(v => {
      const norm = (v || '').toUpperCase().replace(/[-\s]/g, '');
      if (v !== norm) this.f.rfcNum.setValue(norm, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    // Cargar RFC del usuario desde la BD
    this.cargarRFC();
  }

  /**
   * Carga el RFC del usuario desde la base de datos
   */
  private cargarRFC(): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    this.authService.me().subscribe({
      next: (usuario) => {
        if (usuario.rfc) {
          // Poblar el campo RFC con el valor de la BD
          this.f.rfcNum.setValue(usuario.rfc.toUpperCase().replace(/[-\s]/g, ''));
        }
      },
      error: (err) => {
        // No mostrar error si no se puede cargar, simplemente dejar el campo vacío
        console.log('No se pudo cargar el RFC del usuario:', err);
      }
    });
  }

  /* ===== Getters para facilitar el acceso ===== */
  get certificadosArray(): FormArray<FormControl<File | null>> {
    return this.form.get('certificados') as FormArray<FormControl<File | null>>;
  }

  /* ===== Drag & drop helpers (firmas que espera tu HTML) ===== */
  onInputFile(e: Event, key: FileKeys | number) {
    const input = e.target as HTMLInputElement;
    const file: File | null = input.files?.[0] ?? null;
    
    if (typeof key === 'number') {
      // Es un índice del array de certificados
      const control = this.certificadosArray.at(key);
      control.setValue(file);
      control.markAsTouched();
    } else {
      // Es un campo normal
      (this.f[key] as FormControl<File | null>).setValue(file);
      (this.f[key] as FormControl<File | null>).markAsTouched();
    }
  }

  onDrop(e: DragEvent, key: FileKeys | number) {
    e.preventDefault();
    e.stopPropagation();
    const file: File | null = e.dataTransfer?.files?.[0] || null;
    
    if (typeof key === 'number') {
      // Es un índice del array de certificados
      const control = this.certificadosArray.at(key);
      control.setValue(file);
      control.markAsTouched();
    } else {
      // Es un campo normal
      (this.f[key] as FormControl<File | null>).setValue(file);
      (this.f[key] as FormControl<File | null>).markAsTouched();
    }
    this._dragging = null;
  }

  onDragOver(e: DragEvent, key: FileKeys | number) {
    e.preventDefault();
    this._dragging = key;
  }

  onDragLeave() { this._dragging = null; }

  clearFile(key: FileKeys | number) {
    if (typeof key === 'number') {
      // Es un índice del array de certificados
      const control = this.certificadosArray.at(key);
      control.setValue(null);
      control.markAsTouched();
    } else {
      // Es un campo normal
      (this.f[key] as FormControl<File | null>).setValue(null);
      (this.f[key] as FormControl<File | null>).markAsTouched();
    }
  }

  /* ===== Métodos para manejar certificados dinámicos ===== */
  agregarCertificado() {
    const nuevoControl = this.fb.control<File | null>(null, [
      fileMaxSizeMB(this.MAX_MB),
      fileAccept(['.pdf','.jpg','.jpeg','.png','application/pdf','image/jpeg','image/png'])
    ]);
    this.certificadosArray.push(nuevoControl);
  }

  eliminarCertificado(index: number) {
    // Si el usuario quiere eliminar el archivo, solo limpiamos el control
    // Si quiere eliminar el campo completo, se puede hacer con removeAt
    const control = this.certificadosArray.at(index);
    control.setValue(null);
    control.markAsTouched();
  }

  eliminarCampoCertificado(index: number) {
    // Elimina completamente el campo del array
    this.certificadosArray.removeAt(index);
  }

  getCertificadoControl(index: number): FormControl<File | null> {
    return this.certificadosArray.at(index) as FormControl<File | null>;
  }

  trackByIndex(index: number): number {
    return index;
  }

  isDraggingOver(index: number): boolean {
    const drag = this.dragging();
    return drag === index;
  }

  hasCertificados(): boolean {
    return this.certificadosArray.length > 0 && 
           this.certificadosArray.controls.some((c: any) => c.value);
  }

  humanSize(bytes?: number) {
    if (bytes == null) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  }

  /* ===== Navegación y guardado ===== */
  saveDraft(ev?: Event) {
    ev?.preventDefault();
    this.router.navigateByUrl('/landing');
  }

  submit(ev?: Event) {
    ev?.preventDefault();
    
    if (this.archivosYaCargados) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivos ya registrados',
        text: 'Los archivos ya han sido cargados previamente. No se pueden modificar.',
        confirmButtonColor: '#800020'
      });
      return;
    }
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor, complete todos los campos obligatorios',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.submitting = true;

    // Mostrar loading
    Swal.fire({
      title: 'Guardando documentos...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Crear FormData con los archivos
    const formData = new FormData();
    
    if (this.f.cvFile.value) {
      formData.append('cvFile', this.f.cvFile.value);
    }
    if (this.f.fiscalPdf.value) {
      formData.append('fiscalPdf', this.f.fiscalPdf.value);
    }
    if (this.f.domicilio.value) {
      formData.append('domicilio', this.f.domicilio.value);
    }
    
    // Convertir array dinámico de certificados a cert1, cert2, etc. para compatibilidad con backend
    const certificados = this.certificadosArray.controls
      .map(control => control.value)
      .filter((file): file is File => file !== null);
    
    certificados.forEach((file, index) => {
      const certKey = `cert${index + 1}`;
      formData.append(certKey, file);
    });

    // Enviar al backend
    this.http.post<{status: string; message: string; documentosGuardados: number}>(
      `${environment.apiBaseUrl}/documentos/registro2`,
      formData
    ).subscribe({
      next: (response) => {
        this.submitting = false;
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: `Documentos guardados correctamente (${response.documentosGuardados} archivos)`,
          confirmButtonColor: '#800020'
        }).then(() => {
          this.router.navigateByUrl('/completarRegistro');
        });
      },
      error: (err) => {
        this.submitting = false;
        console.error('Error al guardar documentos:', err);
        const errorMessage = err?.error?.message || 'No se pudieron guardar los documentos. Por favor, intente nuevamente.';
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar',
          text: errorMessage,
          confirmButtonColor: '#800020'
        });
      }
    });
  }
}
