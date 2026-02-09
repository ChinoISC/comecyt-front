import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

interface Curso {
  id?: number;
  nombre?: string;
  programa?: string;
  horasTotales?: number;
  fechaInicio?: string;
  fechaFin?: string;
  institucion?: string;
  nivelEscolaridad?: string;
}

interface Idioma {
  id?: number;
  nombre?: string;
  dominioNombre?: string;
  conversacion?: string;
  lectura?: string;
  escritura?: string;
  esCertificado?: boolean;
  certInstitucion?: string;
  certPuntuacion?: string;
  vigenciaFin?: string;
}

interface Logro {
  id?: number;
  tipo?: string;
  nombre?: string;
  anio?: number;
  fecha?: string; // Fecha completa en formato ISO (YYYY-MM-DD)
}

interface Certificacion {
  id: number;
  nombre: string;
  nombreCompleto?: string;
  tipo: string;
  contentType?: string;
  fechaSubida: string;
  sizeBytes: number;
}

interface Articulo {
  id?: number;
  titulo?: string;
  revista?: string;
  anio?: number;
  doi?: string;
  url?: string;
}

interface IncidenciaSocial {
  id?: number;
  titulo?: string;
  ubicacion?: string;
  descripcion?: string;
  fecha?: string;
  anio?: number;
}

const TABS_VALIDOS = ['certs', 'cursos', 'herramientas', 'idiomas', 'logros', 'articulos', 'incidencia'] as const;

@Component({
  selector: 'app-trayectoria',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './trayectoria.html',
  styleUrls: ['./trayectoria.css']
})
export class TrayectoriaComponent implements OnInit, AfterViewInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  // Datos
  cursos: Curso[] = [];
  idiomas: Idioma[] = [];
  logros: Logro[] = [];
  certificaciones: Certificacion[] = [];
  /** Lista de herramientas con id para eliminar correctamente (evita bug con comillas en nombre). */
  herramientas: Array<{ id: number; nombre: string }> = [];
  articulos: Articulo[] = [];
  incidenciaSocial: IncidenciaSocial[] = [];

  // Estados de carga
  loadingCursos = false;
  loadingIdiomas = false;
  loadingLogros = false;
  loadingCertificaciones = false;
  loadingArticulos = false;
  loadingIncidencia = false;

  // Formularios
  cursoForm: Curso = {};
  idiomaForm: Idioma = {};
  logroForm: Logro = {};
  articuloForm: Articulo = {};
  incidenciaForm: IncidenciaSocial = {};
  herramientaInput = '';

  ngOnInit(): void {
    window.trayectoriaComponent = this;
    this.cargarTodosLosDatos();
  }

  ngAfterViewInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab && TABS_VALIDOS.includes(tab as typeof TABS_VALIDOS[number])) {
        this.activarPestana(tab);
      }
    });
    // Por si la página se carga con ?tab= ya en la URL
    const tabInicial = this.route.snapshot.queryParamMap.get('tab');
    if (tabInicial && TABS_VALIDOS.includes(tabInicial as typeof TABS_VALIDOS[number])) {
      setTimeout(() => this.activarPestana(tabInicial), 150);
    }
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Activa la pestaña indicada (certs | cursos | herramientas | idiomas | logros | articulos). */
  activarPestana(tabId: string): void {
    setTimeout(() => {
      const tabEl = document.getElementById(`${tabId}-tab`);
      if (tabEl && typeof (window as any).bootstrap !== 'undefined') {
        const Tab = (window as any).bootstrap.Tab;
        const tab = Tab.getOrCreateInstance(tabEl);
        tab.show();
      }
    }, 200);
  }

  cargarTodosLosDatos(): void {
    this.cargarCursos();
    this.cargarIdiomas();
    this.cargarLogros();
    this.cargarCertificaciones();
    this.cargarHerramientas();
    this.cargarArticulos();
    this.cargarIncidenciaSocial();
  }

  // ========== CURSOS ==========
  cargarCursos(): void {
    this.loadingCursos = true;
    this.http.get<Curso[]>(`${environment.apiBaseUrl}/trayectoria/cursos`).subscribe({
      next: (data) => {
        this.cursos = data;
        this.loadingCursos = false;
        this.renderizarCursos();
      },
      error: (err) => {
        console.error('Error al cargar cursos:', err);
        this.loadingCursos = false;
        Swal.fire('Error', 'No se pudieron cargar los cursos', 'error');
      }
    });
  }

  guardarCurso(): void {
    const form = document.getElementById('courseForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const cursoData: Curso = {
      nombre: (document.getElementById('courseTitle') as HTMLInputElement).value,
      programa: (document.getElementById('courseProvider') as HTMLInputElement).value || undefined,
      horasTotales: parseInt((document.getElementById('courseHours') as HTMLInputElement).value) || undefined,
      institucion: (document.getElementById('courseInstitucion') as HTMLInputElement)?.value || undefined,
    };

    if (this.cursoForm.id) {
      cursoData.id = this.cursoForm.id;
    }

    this.http.post<Curso>(`${environment.apiBaseUrl}/trayectoria/cursos`, cursoData).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Curso guardado correctamente', 'success');
        form.reset();
        form.classList.remove('was-validated');
        this.cursoForm = {};
        this.cargarCursos();
      },
      error: (err) => {
        console.error('Error al guardar curso:', err);
        Swal.fire('Error', 'No se pudo guardar el curso', 'error');
      }
    });
  }

  eliminarCurso(id: number): void {
    Swal.fire({
      title: '¿Eliminar curso?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/cursos/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Curso eliminado correctamente', 'success');
            this.cargarCursos();
          },
          error: (err) => {
            console.error('Error al eliminar curso:', err);
            Swal.fire('Error', 'No se pudo eliminar el curso', 'error');
          }
        });
      }
    });
  }

  renderizarCursos(): void {
    const list = document.getElementById('coursesList');
    const empty = document.getElementById('coursesEmpty');
    const countBadge = document.getElementById('courseCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.cursos.length.toString();

    list.innerHTML = '';
    if (this.cursos.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.cursos.forEach(curso => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-book text-borgona me-2"></i>${escapeHtml(curso.nombre || 'Sin título')}
          </div>
          ${curso.programa ? `<div class="text-muted small mb-1"><i class="fas fa-building me-1"></i>${escapeHtml(curso.programa)}</div>` : ''}
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${curso.horasTotales ? `<span class="badge bg-secondary"><i class="fas fa-clock me-1"></i>${curso.horasTotales} hrs</span>` : ''}
            ${curso.institucion ? `<span class="text-muted small"><i class="fas fa-university me-1"></i>${escapeHtml(curso.institucion)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarCurso(${curso.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarCurso(${curso.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarCurso(id: number): void {
    const curso = this.cursos.find(c => c.id === id);
    if (!curso) return;

    this.cursoForm = { ...curso };
    (document.getElementById('courseTitle') as HTMLInputElement).value = curso.nombre || '';
    (document.getElementById('courseProvider') as HTMLInputElement).value = curso.programa || '';
    (document.getElementById('courseHours') as HTMLInputElement).value = curso.horasTotales?.toString() || '';
    const institucionInput = document.getElementById('courseInstitucion') as HTMLInputElement;
    if (institucionInput) institucionInput.value = curso.institucion || '';

    // Cambiar texto del botón
    const submitBtn = document.querySelector('#courseForm button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) submitBtn.textContent = 'Actualizar';
  }

  // ========== IDIOMAS ==========
  cargarIdiomas(): void {
    this.loadingIdiomas = true;
    this.http.get<Idioma[]>(`${environment.apiBaseUrl}/trayectoria/idiomas`).subscribe({
      next: (data) => {
        this.idiomas = data;
        this.loadingIdiomas = false;
        this.renderizarIdiomas();
      },
      error: (err) => {
        console.error('Error al cargar idiomas:', err);
        this.loadingIdiomas = false;
        Swal.fire('Error', 'No se pudieron cargar los idiomas', 'error');
      }
    });
  }

  guardarIdioma(): void {
    const form = document.getElementById('langForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const idiomaData: Idioma = {
      nombre: (document.getElementById('langName') as HTMLInputElement).value,
      dominioNombre: (document.getElementById('langLevel') as HTMLSelectElement).value || undefined,
    };

    if (this.idiomaForm.id) {
      idiomaData.id = this.idiomaForm.id;
    }

    this.http.post<Idioma>(`${environment.apiBaseUrl}/trayectoria/idiomas`, idiomaData).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Idioma guardado correctamente', 'success');
        form.reset();
        form.classList.remove('was-validated');
        this.idiomaForm = {};
        this.cargarIdiomas();
      },
      error: (err) => {
        console.error('Error al guardar idioma:', err);
        Swal.fire('Error', 'No se pudo guardar el idioma', 'error');
      }
    });
  }

  eliminarIdioma(id: number): void {
    Swal.fire({
      title: '¿Eliminar idioma?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/idiomas/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Idioma eliminado correctamente', 'success');
            this.cargarIdiomas();
          },
          error: (err) => {
            console.error('Error al eliminar idioma:', err);
            Swal.fire('Error', 'No se pudo eliminar el idioma', 'error');
          }
        });
      }
    });
  }

  renderizarIdiomas(): void {
    const list = document.getElementById('langsList');
    const empty = document.getElementById('langsEmpty');
    const countBadge = document.getElementById('langCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.idiomas.length.toString();

    list.innerHTML = '';
    if (this.idiomas.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.idiomas.forEach(idioma => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      const nivelBadge = idioma.dominioNombre ? {
        'basico': 'bg-secondary',
        'intermedio': 'bg-info',
        'avanzado': 'bg-primary',
        'nativo': 'bg-success'
      }[idioma.dominioNombre.toLowerCase()] || 'bg-secondary' : 'bg-secondary';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-language text-borgona me-2"></i>${escapeHtml(idioma.nombre || 'Sin nombre')}
          </div>
          ${idioma.dominioNombre ? `<span class="badge ${nivelBadge}"><i class="fas fa-signal me-1"></i>${escapeHtml(idioma.dominioNombre)}</span>` : ''}
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarIdioma(${idioma.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarIdioma(${idioma.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarIdioma(id: number): void {
    const idioma = this.idiomas.find(i => i.id === id);
    if (!idioma) return;

    this.idiomaForm = { ...idioma };
    (document.getElementById('langName') as HTMLInputElement).value = idioma.nombre || '';
    (document.getElementById('langLevel') as HTMLSelectElement).value = idioma.dominioNombre || 'basico';

    const submitBtn = document.querySelector('#langForm button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) submitBtn.textContent = 'Actualizar';
  }

  // ========== LOGROS ==========
  cargarLogros(): void {
    this.loadingLogros = true;
    this.http.get<Logro[]>(`${environment.apiBaseUrl}/trayectoria/logros`).subscribe({
      next: (data) => {
        this.logros = data;
        this.loadingLogros = false;
        this.renderizarLogros();
      },
      error: (err) => {
        console.error('Error al cargar logros:', err);
        this.loadingLogros = false;
        Swal.fire('Error', 'No se pudieron cargar los logros', 'error');
      }
    });
  }

  guardarLogro(): void {
    const form = document.getElementById('achievementForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const fechaInput = (document.getElementById('achDate') as HTMLInputElement).value;
    let anio: number | undefined;
    if (fechaInput) {
      // Extraer el año de la fecha
      anio = new Date(fechaInput).getFullYear();
    }

    const logroData: Logro = {
      nombre: (document.getElementById('achTitle') as HTMLInputElement).value,
      tipo: (document.getElementById('achDesc') as HTMLTextAreaElement).value || undefined,
      fecha: fechaInput || undefined,
      anio: anio,
    };

    if (this.logroForm.id) {
      logroData.id = this.logroForm.id;
    }

    this.http.post<Logro>(`${environment.apiBaseUrl}/trayectoria/logros`, logroData).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Logro guardado correctamente', 'success');
        form.reset();
        form.classList.remove('was-validated');
        this.logroForm = {};
        this.cargarLogros();
      },
      error: (err) => {
        console.error('Error al guardar logro:', err);
        Swal.fire('Error', 'No se pudo guardar el logro', 'error');
      }
    });
  }

  eliminarLogro(id: number): void {
    Swal.fire({
      title: '¿Eliminar logro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/logros/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Logro eliminado correctamente', 'success');
            this.cargarLogros();
          },
          error: (err) => {
            console.error('Error al eliminar logro:', err);
            Swal.fire('Error', 'No se pudo eliminar el logro', 'error');
          }
        });
      }
    });
  }

  renderizarLogros(): void {
    const list = document.getElementById('achievementsList');
    const empty = document.getElementById('achEmpty');
    const countBadge = document.getElementById('logroCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.logros.length.toString();

    list.innerHTML = '';
    if (this.logros.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.logros.forEach(logro => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      
      // Formatear fecha si existe
      let fechaFormateada = '';
      if (logro.fecha) {
        try {
          const fecha = new Date(logro.fecha);
          fechaFormateada = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
          // Si hay error, usar la fecha tal cual
          fechaFormateada = logro.fecha;
        }
      } else if (logro.anio) {
        fechaFormateada = logro.anio.toString();
      }
      
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-trophy text-warning me-2"></i>${escapeHtml(logro.nombre || 'Sin título')}
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${logro.tipo ? `<span class="text-muted small">${escapeHtml(logro.tipo)}</span>` : ''}
            ${fechaFormateada ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${escapeHtml(fechaFormateada)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarLogro(${logro.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarLogro(${logro.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarLogro(id: number): void {
    const logro = this.logros.find(l => l.id === id);
    if (!logro) return;

    this.logroForm = { ...logro };
    (document.getElementById('achTitle') as HTMLInputElement).value = logro.nombre || '';
    (document.getElementById('achDesc') as HTMLTextAreaElement).value = logro.tipo || '';
    
    // Cargar fecha si existe
    const fechaInput = document.getElementById('achDate') as HTMLInputElement;
    if (logro.fecha) {
      fechaInput.value = logro.fecha;
    } else if (logro.anio) {
      // Si solo tenemos el año, establecer el 1 de enero de ese año
      fechaInput.value = `${logro.anio}-01-01`;
    } else {
      fechaInput.value = '';
    }

    const submitBtn = document.querySelector('#achievementForm button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) submitBtn.textContent = 'Actualizar';
  }

  // ========== CERTIFICACIONES ==========
  cargarCertificaciones(): void {
    this.loadingCertificaciones = true;
    // Mostrar indicador de carga en la lista
    const list = document.getElementById('certList');
    const empty = document.getElementById('certEmpty');
    if (list) {
      list.innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-borgona" role="status"><span class="visually-hidden">Cargando...</span></div> <span class="ms-2">Cargando certificaciones...</span></li>';
    }
    if (empty) empty.style.display = 'none';

    this.http.get<Certificacion[]>(`${environment.apiBaseUrl}/trayectoria/certificaciones`).subscribe({
      next: (data) => {
        this.certificaciones = data;
        this.loadingCertificaciones = false;
        this.renderizarCertificaciones();
      },
      error: (err) => {
        console.error('Error al cargar certificaciones:', err);
        this.loadingCertificaciones = false;
        if (list) list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        Swal.fire('Error', 'No se pudieron cargar las certificaciones', 'error');
      }
    });
  }

  subirCertificacion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    const nombreInput = document.getElementById('certName') as HTMLInputElement;
    if (nombreInput && nombreInput.value) {
      formData.append('nombre', nombreInput.value);
    }

    // Mostrar barra de progreso con SweetAlert
    Swal.fire({
      title: 'Subiendo certificación...',
      html: `
        <div class="mb-3">
          <p>Archivo: <strong>${file.name}</strong></p>
          <p>Tamaño: <strong>${(file.size / (1024 * 1024)).toFixed(2)} MB</strong></p>
        </div>
        <div class="progress" style="height: 25px;">
          <div id="upload-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-borgona" 
               role="progressbar" style="width: 0%">0%</div>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        // Simular progreso (ya que no tenemos eventos de progreso reales del HTTP)
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          const progressBar = document.getElementById('upload-progress');
          if (progressBar) {
            progressBar.style.width = `${Math.min(progress, 90)}%`;
            progressBar.textContent = `${Math.min(progress, 90)}%`;
          }
          if (progress >= 90) {
            clearInterval(interval);
          }
        }, 200);
      }
    });

    this.http.post<Certificacion>(`${environment.apiBaseUrl}/trayectoria/certificaciones`, formData).subscribe({
      next: () => {
        // Completar la barra de progreso
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.textContent = '100%';
        }
        
        setTimeout(() => {
          Swal.fire('Éxito', 'Certificación subida correctamente', 'success');
          input.value = '';
          if (nombreInput) nombreInput.value = '';
          // Recargar inmediatamente
          this.cargarCertificaciones();
        }, 500);
      },
      error: (err) => {
        console.error('Error al subir certificación:', err);
        Swal.fire('Error', 'No se pudo subir la certificación: ' + (err.error?.message || 'Error desconocido'), 'error');
      }
    });
  }

  verCertificacion(id: number, nombre: string, contentType?: string): void {
    // Obtener el documento del backend
    this.http.get(`${environment.apiBaseUrl}/documentos/${id}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Crear una URL temporal para el blob
        const url = window.URL.createObjectURL(blob);
        
        // Determinar si es una imagen o PDF para mostrar en modal o nueva ventana
        const esImagen = contentType?.includes('image') || nombre.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/);
        const esPDF = contentType?.includes('pdf') || nombre.toLowerCase().endsWith('.pdf');
        
        if (esImagen) {
          // Para imágenes, mostrar en un modal de SweetAlert
          Swal.fire({
            title: nombre,
            imageUrl: url,
            imageWidth: '80%',
            imageAlt: nombre,
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
              popup: 'swal2-image-modal'
            }
          });
        } else if (esPDF) {
          // Para PDFs, abrir en nueva ventana
          window.open(url, '_blank');
        } else {
          // Para otros tipos, descargar directamente
          const link = document.createElement('a');
          link.href = url;
          link.download = nombre;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        // Limpiar la URL después de un tiempo
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: (err) => {
        console.error('Error al cargar certificación:', err);
        Swal.fire('Error', 'No se pudo cargar la certificación', 'error');
      }
    });
  }

  eliminarCertificacion(id: number): void {
    Swal.fire({
      title: '¿Eliminar certificación?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/certificaciones/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Certificación eliminada correctamente', 'success');
            this.cargarCertificaciones();
          },
          error: (err) => {
            console.error('Error al eliminar certificación:', err);
            Swal.fire('Error', 'No se pudo eliminar la certificación', 'error');
          }
        });
      }
    });
  }

  renderizarCertificaciones(): void {
    const list = document.getElementById('certList');
    const empty = document.getElementById('certEmpty');
    const countBadge = document.getElementById('certCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.certificaciones.length.toString();

    list.innerHTML = '';
    if (this.certificaciones.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.certificaciones.forEach(cert => {
      const li = document.createElement('div');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      const sizeMB = (cert.sizeBytes / (1024 * 1024)).toFixed(2);
      
      // Determinar icono y color según el tipo de archivo
      let icono = 'fa-file';
      let colorIcono = 'text-secondary';
      const nombreLower = cert.nombre?.toLowerCase() || '';
      const contentType = cert.contentType?.toLowerCase() || '';
      
      if (nombreLower.endsWith('.pdf') || contentType.includes('pdf')) {
        icono = 'fa-file-pdf';
        colorIcono = 'text-danger';
      } else if (nombreLower.match(/\.(jpg|jpeg|png|gif)$/) || contentType.includes('image')) {
        icono = 'fa-file-image';
        colorIcono = 'text-info';
      } else if (nombreLower.match(/\.(doc|docx)$/) || contentType.includes('word')) {
        icono = 'fa-file-word';
        colorIcono = 'text-primary';
      } else if (nombreLower.match(/\.(xls|xlsx)$/) || contentType.includes('excel')) {
        icono = 'fa-file-excel';
        colorIcono = 'text-success';
      }
      
      // Obtener extensión del archivo
      const extension = nombreLower.substring(nombreLower.lastIndexOf('.'));
      const tipoArchivo = extension.toUpperCase().replace('.', '') || 'ARCHIVO';
      
      // Escapar caracteres especiales para uso en atributos HTML
      const escapeHtml = (str: string) => {
        if (!str) return '';
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };
      
      const escapeJs = (str: string) => {
        if (!str) return '';
        return str
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r');
      };
      
      const nombreEscapado = escapeHtml(cert.nombre || 'Sin nombre');
      const nombreJsEscapado = escapeJs(cert.nombre || '');
      const contentTypeJsEscapado = escapeJs(cert.contentType || '');
      
      li.innerHTML = `
        <div class="flex-grow-1">
          <i class="fas ${icono} ${colorIcono} me-2"></i>
          <span class="fw-bold">${nombreEscapado}</span>
          <small class="text-muted ms-2">(${tipoArchivo})</small>
          <br>
          <small class="text-muted">${sizeMB} MB</small>
        </div>
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="window.trayectoriaComponent.verCertificacion(${cert.id}, '${nombreJsEscapado}', '${contentTypeJsEscapado}')" title="Ver certificación">
            <i class="fas fa-eye"></i> Ver
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarCertificacion(${cert.id})" title="Eliminar certificación">
            <i class="fas fa-trash-alt"></i> Eliminar
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  // ========== HERRAMIENTAS ==========
  cargarHerramientas(): void {
    this.http.get<Array<{id: number, nombre: string}>>(`${environment.apiBaseUrl}/trayectoria/herramientas`).subscribe({
      next: (data) => {
        this.herramientas = data.map(h => ({ id: h.id, nombre: h.nombre }));
        this.renderizarHerramientas();
      },
      error: (err) => {
        console.error('Error al cargar herramientas:', err);
        // No mostrar error, solo dejar lista vacía
      }
    });
  }

  agregarHerramienta(): void {
    const input = document.getElementById('toolInput') as HTMLInputElement;
    const herramienta = input.value.trim();
    if (!herramienta) {
      Swal.fire('Advertencia', 'Ingresa el nombre de la herramienta', 'warning');
      return;
    }

    if (this.herramientas.length >= 12) {
      Swal.fire('Advertencia', 'Máximo 12 herramientas permitidas', 'warning');
      return;
    }

    if (this.herramientas.some(h => h.nombre === herramienta)) {
      Swal.fire('Advertencia', 'Esta herramienta ya está registrada', 'warning');
      return;
    }

    // Guardar en backend y agregar a la lista con el id devuelto (evita recarga y bugs)
    this.http.post<{id: number, nombre: string}>(`${environment.apiBaseUrl}/trayectoria/herramientas/agregar`, { nombre: herramienta }).subscribe({
      next: (saved) => {
        input.value = '';
        this.herramientas = [...this.herramientas, { id: saved.id, nombre: saved.nombre }];
        this.renderizarHerramientas();
      },
      error: (err) => {
        console.error('Error al agregar herramienta:', err);
        const mensaje = err.error?.message || 'No se pudo agregar la herramienta';
        Swal.fire('Error', mensaje, 'error');
      }
    });
  }

  eliminarHerramienta(id: number): void {
    const item = this.herramientas.find(h => h.id === id);
    const nombre = item?.nombre ?? 'esta herramienta';
    Swal.fire({
      title: '¿Eliminar herramienta?',
      text: `¿Estás seguro de eliminar "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/herramientas/${id}`).subscribe({
          next: () => {
            this.herramientas = this.herramientas.filter(h => h.id !== id);
            this.renderizarHerramientas();
          },
          error: (err) => {
            console.error('Error al eliminar herramienta:', err);
            Swal.fire('Error', 'No se pudo eliminar la herramienta', 'error');
          }
        });
      }
    });
  }

  renderizarHerramientas(): void {
    const list = document.getElementById('toolsList');
    const empty = document.getElementById('toolsEmpty');
    const countBadge = document.getElementById('toolCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = `${this.herramientas.length}/12`;

    list.innerHTML = '';
    if (this.herramientas.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.herramientas.forEach(h => {
      const badge = document.createElement('span');
      badge.className = 'badge bg-borgona me-2 mb-2 d-inline-flex align-items-center';
      badge.innerHTML = `
        ${this.escapeHtml(h.nombre)}
        <button class="btn-close btn-close-white ms-2" onclick="window.trayectoriaComponent.eliminarHerramienta(${h.id})" aria-label="Eliminar"></button>
      `;
      list.appendChild(badge);
    });
  }

  // ========== ARTÍCULOS ==========
  cargarArticulos(): void {
    this.loadingArticulos = true;
    this.http.get<Articulo[]>(`${environment.apiBaseUrl}/trayectoria/articulos`).subscribe({
      next: (data) => {
        this.articulos = data;
        this.loadingArticulos = false;
        this.renderizarArticulos();
      },
      error: (err) => {
        console.error('Error al cargar artículos:', err);
        this.loadingArticulos = false;
        Swal.fire('Error', 'No se pudieron cargar los artículos', 'error');
      }
    });
  }

  guardarArticulo(): void {
    const form = document.getElementById('articleForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const articuloData: any = {
      titulo: (document.getElementById('articleTitle') as HTMLInputElement).value,
      revista: (document.getElementById('articleJournal') as HTMLInputElement).value || undefined,
      anio: (document.getElementById('articleYear') as HTMLInputElement).value ? 
            parseInt((document.getElementById('articleYear') as HTMLInputElement).value) : undefined,
      doi: (document.getElementById('articleDOI') as HTMLInputElement).value || undefined,
    };

    if (this.articuloForm.id) {
      articuloData.id = this.articuloForm.id;
    }

    this.http.post<Articulo>(`${environment.apiBaseUrl}/trayectoria/articulos`, articuloData).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Artículo guardado correctamente', 'success');
        form.reset();
        form.classList.remove('was-validated');
        this.articuloForm = {};
        this.cargarArticulos();
      },
      error: (err) => {
        console.error('Error al guardar artículo:', err);
        Swal.fire('Error', 'No se pudo guardar el artículo: ' + (err.error?.message || 'Error desconocido'), 'error');
      }
    });
  }

  eliminarArticulo(id: number): void {
    Swal.fire({
      title: '¿Eliminar artículo?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/articulos/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Artículo eliminado correctamente', 'success');
            this.cargarArticulos();
          },
          error: (err) => {
            console.error('Error al eliminar artículo:', err);
            Swal.fire('Error', 'No se pudo eliminar el artículo', 'error');
          }
        });
      }
    });
  }

  renderizarArticulos(): void {
    const list = document.getElementById('articlesList');
    const empty = document.getElementById('articlesEmpty');
    const countBadge = document.getElementById('articleCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.articulos.length.toString();

    list.innerHTML = '';
    if (this.articulos.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.articulos.forEach(articulo => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      
      // Construir URL del DOI si existe
      let urlDOI = '';
      if (articulo.doi) {
        urlDOI = articulo.doi.startsWith('http') ? articulo.doi : `https://doi.org/${articulo.doi}`;
      }
      
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-file-alt text-borgona me-2"></i>${escapeHtml(articulo.titulo || 'Sin título')}
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${articulo.revista ? `<span class="text-muted small"><i class="fas fa-book me-1"></i>${escapeHtml(articulo.revista)}</span>` : ''}
            ${articulo.anio ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${articulo.anio}</span>` : ''}
            ${articulo.doi ? `<span class="badge bg-secondary"><i class="fas fa-link me-1"></i>DOI</span>` : ''}
          </div>
          ${urlDOI ? `<div class="mt-1"><a href="${escapeHtml(urlDOI)}" target="_blank" class="text-primary small"><i class="fas fa-external-link-alt me-1"></i>Ver artículo</a></div>` : ''}
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarArticulo(${articulo.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarArticulo(${articulo.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarArticulo(id: number): void {
    const articulo = this.articulos.find(a => a.id === id);
    if (!articulo) return;

    this.articuloForm = { ...articulo };
    (document.getElementById('articleTitle') as HTMLInputElement).value = articulo.titulo || '';
    (document.getElementById('articleJournal') as HTMLInputElement).value = articulo.revista || '';
    (document.getElementById('articleYear') as HTMLInputElement).value = articulo.anio?.toString() || '';
    (document.getElementById('articleDOI') as HTMLInputElement).value = articulo.doi || '';
    
    // Si hay DOI, mostrar la URL generada
    const urlInput = document.getElementById('articleURL') as HTMLInputElement;
    if (urlInput && articulo.doi) {
      urlInput.value = articulo.doi.startsWith('http') ? articulo.doi : `https://doi.org/${articulo.doi}`;
    }

    // Cambiar texto del botón
    const submitBtn = document.querySelector('#articleForm button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) {
      const icon = submitBtn.querySelector('i');
      submitBtn.innerHTML = icon ? `<i class="${icon.className}"></i> Actualizar` : '<i class="fas fa-save me-1"></i> Actualizar';
    }
  }

  // ========== INCIDENCIA SOCIAL ==========
  cargarIncidenciaSocial(): void {
    this.loadingIncidencia = true;
    this.http.get<IncidenciaSocial[]>(`${environment.apiBaseUrl}/trayectoria/incidencia-social`).subscribe({
      next: (data) => {
        this.incidenciaSocial = data;
        this.loadingIncidencia = false;
        this.renderizarIncidenciaSocial();
      },
      error: (err) => {
        console.error('Error al cargar incidencia social:', err);
        this.loadingIncidencia = false;
      }
    });
  }

  guardarIncidenciaSocial(): void {
    const form = document.getElementById('incidenciaForm') as HTMLFormElement;
    if (!form?.checkValidity()) {
      form?.classList.add('was-validated');
      return;
    }
    const titulo = (document.getElementById('incidenciaTitulo') as HTMLInputElement)?.value?.trim();
    if (!titulo) {
      Swal.fire('Advertencia', 'El título / investigación es requerido', 'warning');
      return;
    }
    const payload: IncidenciaSocial = {
      titulo,
      ubicacion: (document.getElementById('incidenciaUbicacion') as HTMLInputElement)?.value?.trim() || undefined,
      descripcion: (document.getElementById('incidenciaDescripcion') as HTMLTextAreaElement)?.value?.trim() || undefined,
      fecha: (document.getElementById('incidenciaFecha') as HTMLInputElement)?.value || undefined,
      anio: parseInt((document.getElementById('incidenciaAnio') as HTMLInputElement)?.value || '', 10) || undefined
    };
    if (this.incidenciaForm.id) payload.id = this.incidenciaForm.id;

    this.http.post<IncidenciaSocial>(`${environment.apiBaseUrl}/trayectoria/incidencia-social`, payload).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Registro guardado correctamente', 'success');
        form.reset();
        form.classList.remove('was-validated');
        this.incidenciaForm = {};
        this.cargarIncidenciaSocial();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error');
      }
    });
  }

  eliminarIncidenciaSocial(id: number): void {
    Swal.fire({
      title: '¿Eliminar registro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/incidencia-social/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Registro eliminado correctamente', 'success');
            this.cargarIncidenciaSocial();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  renderizarIncidenciaSocial(): void {
    const list = document.getElementById('incidenciaList');
    const empty = document.getElementById('incidenciaEmpty');
    const countBadge = document.getElementById('incidenciaCount');
    if (!list || !empty) return;

    if (countBadge) countBadge.textContent = this.incidenciaSocial.length.toString();
    list.innerHTML = '';
    if (this.incidenciaSocial.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.incidenciaSocial.forEach(inc => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const tit = this.escapeHtml(inc.titulo || 'Sin título');
      const ubi = inc.ubicacion ? this.escapeHtml(inc.ubicacion) : '';
      const desc = inc.descripcion ? this.escapeHtml(inc.descripcion.slice(0, 150)) + (inc.descripcion.length > 150 ? '...' : '') : '';
      const fecha = inc.fecha || (inc.anio ? String(inc.anio) : '');
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-handshake-angle text-borgona me-2"></i>${tit}</div>
          ${ubi ? `<div class="small text-muted mb-1"><i class="fas fa-map-marker-alt me-1"></i>${ubi}</div>` : ''}
          ${desc ? `<p class="mb-1 small">${desc}</p>` : ''}
          ${fecha ? `<span class="badge bg-secondary">${this.escapeHtml(fecha)}</span>` : ''}
        </div>
        <div class="btn-group ms-2">
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarIncidenciaSocial(${inc.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      list.appendChild(li);
    });
  }
}

// Exponer el componente globalmente para los onclick
declare global {
  interface Window {
    trayectoriaComponent: TrayectoriaComponent;
  }
}
