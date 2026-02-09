import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CursoItem {
  nombre: string | null;
  programa: string | null;
  horasTotales: number | null;
  institucion: string | null;
}
export interface IdiomaItem {
  nombre: string | null;
  nivel: string | null;
}
export interface LogroItem {
  tipo: string | null;
  nombre: string | null;
  anio: number | null;
}
export interface ArticuloItem {
  titulo: string | null;
  nombreRevista: string | null;
  anio: number | null;
  doi: string | null;
}

export interface Investigador {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  telefono: string | null;
  gradoAcademico: string | null;
  semblanza: string | null;
  fotoDocumentoId: number | null;
  curriculumDocumentoId: number | null;
  cursos?: CursoItem[];
  idiomas?: IdiomaItem[];
  logros?: LogroItem[];
  herramientas?: string[];
  articulos?: ArticuloItem[];
  fotoUrl?: string | SafeResourceUrl | null;
  curriculumUrl?: string | null;
}

/** Cabeceras para evitar caché del navegador en la lista de investigadores */
const NO_CACHE_HEADERS = new HttpHeaders({
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
});

@Component({
  selector: 'app-investigadores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './investigadores.html',
  styleUrl: './investigadores.css'
})
export class InvestigadoresComponent implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  
  investigadores: Investigador[] = [];
  investigadoresFiltrados: Investigador[] = [];
  loading = true;
  error: string | null = null;
  
  // Filtros
  searchTerm: string = '';
  filtroGrado: string = '';
  filtroIdioma: string = '';
  filtroHerramienta: string = '';
  gradosDisponibles: string[] = [];
  idiomasDisponibles: string[] = [];
  herramientasDisponibles: string[] = [];
  
  // Ruta del avatar por defecto
  readonly DEFAULT_AVATAR = '/assets/img/default-avatar.png';
  
  private modalListeners: Array<() => void> = [];
  private routerSub?: Subscription;
  private visibilityHandler = () => this.onVisibilityChange();

  ngOnInit(): void {
    this.cargarInvestigadores();
    // Recargar datos cada vez que se navega a esta ruta (p. ej. desde menú o perfil)
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      if (e.urlAfterRedirects?.includes('investigadores')) {
        this.cargarInvestigadores();
      }
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.cargarInvestigadores();
    }
  }

  ngAfterViewInit(): void {
    // Configurar listeners para mover modales al body cuando se abren
    this.setupModalListeners();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.modalListeners.forEach(cleanup => cleanup());
    this.modalListeners = [];
  }

  private setupModalListeners(): void {
    // Esperar a que los modales se rendericen
    setTimeout(() => {
      this.investigadores.forEach(investigador => {
        const modalId = `modalInvest${investigador.id}`;
        const modalElement = document.getElementById(modalId);
        
        if (modalElement) {
          // Mover el modal al body si no está ya ahí
          if (modalElement.parentElement !== document.body) {
            document.body.appendChild(modalElement);
          }
          
          // Al abrir el modal: asegurar posición en body y actualizar datos del investigador desde el backend
          const showHandler = () => {
            if (modalElement.parentElement !== document.body) {
              document.body.appendChild(modalElement);
            }
            const idStr = modalElement.id.replace('modalInvest', '');
            const id = parseInt(idStr, 10);
            if (!isNaN(id)) {
              this.refrescarDatosInvestigador(id);
            }
          };
          
          modalElement.addEventListener('show.bs.modal', showHandler);
          
          // Guardar función de limpieza
          this.modalListeners.push(() => {
            modalElement.removeEventListener('show.bs.modal', showHandler);
          });
        }
      });
    }, 100);
  }

  cargarInvestigadores(): void {
    this.loading = true;
    this.error = null;
    const url = `${environment.apiBaseUrl}/usuarios/investigadores?_t=${Date.now()}`;
    this.http.get<Investigador[]>(url, { headers: NO_CACHE_HEADERS }).subscribe({
      next: (data) => {
        console.log('Investigadores cargados:', data);
        // Log para verificar datos de cada investigador
        data.forEach(inv => {
          console.log(`Investigador ${inv.id}:`, {
            nombre: inv.nombre,
            semblanza: inv.semblanza,
            fotoDocumentoId: inv.fotoDocumentoId,
            curriculumDocumentoId: inv.curriculumDocumentoId
          });
        });
        // Normalizar datos de trayectoria (por si el backend no envía los arrays)
        this.investigadores = data.map(inv => ({
          ...inv,
          cursos: inv.cursos ?? [],
          idiomas: inv.idiomas ?? [],
          logros: inv.logros ?? [],
          herramientas: inv.herramientas ?? [],
          articulos: inv.articulos ?? []
        }));
        
        // Extraer opciones para todos los filtros (grado, idioma, herramienta)
        this.extraerOpcionesFiltros();
        
        // Cargar fotos y curriculums para cada investigador
        this.investigadores.forEach(investigador => {
          if (investigador.fotoDocumentoId) {
            this.cargarFoto(investigador);
          } else {
            investigador.fotoUrl = null;
          }
          
          if (investigador.curriculumDocumentoId) {
            this.cargarCurriculum(investigador);
          } else {
            investigador.curriculumUrl = null;
          }
        });
        
        // Aplicar filtros iniciales (mostrar todos)
        this.aplicarFiltros();
        
        // Mover modales al body después de que se rendericen
        setTimeout(() => {
          this.setupModalListeners();
        }, 200);
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar investigadores:', err);
        this.error = 'No se pudieron cargar las investigadoras y los investigadores. Por favor, intente más tarde.';
        this.loading = false;
      }
    });
  }

  cargarFoto(investigador: Investigador): void {
    if (!investigador.fotoDocumentoId) {
      investigador.fotoUrl = null;
      return;
    }
    
    this.http.get(`${environment.apiBaseUrl}/documentos/${investigador.fotoDocumentoId}`, { 
      responseType: 'blob' 
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        investigador.fotoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        console.log(`Foto cargada para investigador ${investigador.id}:`, url);
      },
      error: (err) => {
        console.error(`Error al cargar foto para investigador ${investigador.id}:`, err);
        investigador.fotoUrl = null;
      }
    });
  }

  cargarCurriculum(investigador: Investigador): void {
    if (!investigador.curriculumDocumentoId) {
      investigador.curriculumUrl = null;
      return;
    }
    
    this.http.get(`${environment.apiBaseUrl}/documentos/${investigador.curriculumDocumentoId}`, { 
      responseType: 'blob' 
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        investigador.curriculumUrl = url;
        console.log(`Curriculum cargado para investigador ${investigador.id}:`, url);
      },
      error: (err) => {
        console.error(`Error al cargar curriculum para investigador ${investigador.id}:`, err);
        investigador.curriculumUrl = null;
      }
    });
  }

  /**
   * Actualiza los datos de un investigador desde el backend (se llama al abrir su modal).
   * Así el modal muestra siempre la información más reciente sin recargar la página.
   */
  refrescarDatosInvestigador(id: number): void {
    const url = `${environment.apiBaseUrl}/usuarios/investigadores?_t=${Date.now()}`;
    this.http.get<Investigador[]>(url, { headers: NO_CACHE_HEADERS }).subscribe({
      next: (data) => {
        const actualizado = data.find(inv => inv.id === id);
        if (!actualizado) return;
        const inv = this.investigadores.find(i => i.id === id);
        if (!inv) return;
        Object.assign(inv, {
          ...actualizado,
          cursos: actualizado.cursos ?? [],
          idiomas: actualizado.idiomas ?? [],
          logros: actualizado.logros ?? [],
          herramientas: actualizado.herramientas ?? [],
          articulos: actualizado.articulos ?? []
        });
        this.cargarFoto(inv);
        this.cargarCurriculum(inv);
      },
      error: () => { /* fallo silencioso; el modal sigue mostrando los datos que ya tenía */ }
    });
  }

  getNombreCompleto(investigador: Investigador): string {
    const partes = [
      investigador.nombre,
      investigador.apellidoPaterno,
      investigador.apellidoMaterno
    ].filter(p => p != null && p.trim() !== '');
    return partes.join(' ') || 'Sin nombre';
  }

  getFotoUrl(investigador: Investigador): string | SafeResourceUrl {
    // Si ya se cargó la foto como blob, usar esa URL
    if (investigador.fotoUrl) {
      return investigador.fotoUrl;
    }
    // Si no hay foto, usar imagen por defecto (ruta absoluta desde la raíz)
    return this.DEFAULT_AVATAR;
  }

  getCvUrl(investigador: Investigador): string | null {
    // Si ya se cargó el curriculum como blob, usar esa URL
    if (investigador.curriculumUrl) {
      return investigador.curriculumUrl;
    }
    return null;
  }

  getGradoDisplay(grado: string | null): string {
    if (!grado) return 'Investigador/a';
    return grado;
  }

  /** True si no hay semblanza, ni CV, ni ningún dato de trayectoria visible (para mostrar ayuda en el modal). */
  sinSemblanzaNiCvNiTrayectoria(investigador: Investigador): boolean {
    const tieneSemblanza = investigador.semblanza != null && investigador.semblanza.trim() !== '';
    const tieneCv = !!(investigador.curriculumDocumentoId || investigador.curriculumUrl);
    const cursos = investigador.cursos ?? [];
    const idiomas = investigador.idiomas ?? [];
    const logros = investigador.logros ?? [];
    const herramientas = investigador.herramientas ?? [];
    const articulos = investigador.articulos ?? [];
    const tieneTrayectoria = cursos.length > 0 || idiomas.length > 0 || logros.length > 0 || herramientas.length > 0 || articulos.length > 0;
    return !tieneSemblanza && !tieneCv && !tieneTrayectoria;
  }

  openModal(modalId: string): void {
    // Esta función se puede usar para abrir modales programáticamente si es necesario
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      // Mover el modal al body si no está ya ahí (para evitar problemas de z-index)
      if (modalElement.parentElement !== document.body) {
        document.body.appendChild(modalElement);
      }
      
      // Bootstrap 5 modal
      const modal = new (window as any).bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true
      });
      modal.show();
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.DEFAULT_AVATAR) {
      // Solo cambiar si no es ya la imagen por defecto (evitar loop infinito)
      img.src = this.DEFAULT_AVATAR;
      // Si aún falla, usar un placeholder base64 como último recurso
      img.onerror = () => {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Vc3VhcmlvPC90ZXh0Pjwvc3ZnPg==';
      };
    }
  }

  // ============================================
  // MÉTODOS DE FILTRADO
  // ============================================

  extraerOpcionesFiltros(): void {
    const grados = new Set<string>();
    const idiomas = new Set<string>();
    const herramientas = new Set<string>();
    this.investigadores.forEach(inv => {
      if (inv.gradoAcademico && inv.gradoAcademico.trim() !== '') {
        grados.add(inv.gradoAcademico);
      }
      (inv.idiomas ?? []).forEach(i => {
        if (i.nombre && i.nombre.trim() !== '') idiomas.add(i.nombre.trim());
      });
      (inv.herramientas ?? []).forEach(h => {
        if (h && h.trim() !== '') herramientas.add(h.trim());
      });
    });
    this.gradosDisponibles = Array.from(grados).sort();
    this.idiomasDisponibles = Array.from(idiomas).sort();
    this.herramientasDisponibles = Array.from(herramientas).sort();
  }

  tieneFiltrosActivos(): boolean {
    return !!(this.searchTerm?.trim() || this.filtroGrado || this.filtroIdioma || this.filtroHerramienta);
  }

  aplicarFiltros(): void {
    let filtrados = [...this.investigadores];

    // Filtro por búsqueda de texto (nombre)
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const termino = this.searchTerm.toLowerCase().trim();
      filtrados = filtrados.filter(inv => {
        const nombreCompleto = this.getNombreCompleto(inv).toLowerCase();
        return nombreCompleto.includes(termino);
      });
    }

    // Filtro por grado académico
    if (this.filtroGrado && this.filtroGrado !== '') {
      filtrados = filtrados.filter(inv => inv.gradoAcademico === this.filtroGrado);
    }

    // Filtro por idioma
    if (this.filtroIdioma && this.filtroIdioma !== '') {
      filtrados = filtrados.filter(inv => {
        const list = inv.idiomas ?? [];
        return list.some(i => (i.nombre || '').trim() === this.filtroIdioma);
      });
    }

    // Filtro por herramienta
    if (this.filtroHerramienta && this.filtroHerramienta !== '') {
      filtrados = filtrados.filter(inv => {
        const list = inv.herramientas ?? [];
        return list.some(h => (h || '').trim() === this.filtroHerramienta);
      });
    }

    this.investigadoresFiltrados = filtrados;
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.filtroGrado = '';
    this.filtroIdioma = '';
    this.filtroHerramienta = '';
    this.aplicarFiltros();
  }
}
