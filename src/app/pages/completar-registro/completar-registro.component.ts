import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { Usuario } from '../../core/models/user';
import Swal from 'sweetalert2';

/**
 * Control de navegación entre secciones
 */
type View =
  | 'inicio' | 'area-conocimiento' | 'aportaciones' | 'divulgacion' | 'congresos'
  | 'cursos' | 'estancias' | 'trayectoria-profesional' | 'idiomas' | 'logros'
  | 'trayectoria-academica' | 'institucion' | 'personaPrincipal' | 'documentos';

const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function requiredFile(): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    return ctrl.value instanceof File ? null : { requiredFile: true };
  };
}

@Component({
  selector: 'app-completar-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './completar-registro.component.html',
  styleUrl: './completar-registro.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class CompletarRegistroComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Estados
  view = signal<View>('inicio');
  submitting = signal(false);
  errorMsg = '';
  okMsg = '';
  currentUsuarioId: number | null = null;
  /** Tipo de perfil del usuario: INVESTIGADOR | INNOVADOR (para generar ID interno SIIMEX-XXX-INV/IND) */
  currentTipoPerfil: string | null = null;
  jsonFileName: string | null = null;
  isDraggingJson = false;

  form!: FormGroup;
  private readonly STORAGE_KEY = 'siimex_migration_session';

  // Lista de entidades federativas de México
  entidadesFederativas: string[] = [
    'Aguascalientes',
    'Baja California',
    'Baja California Sur',
    'Campeche',
    'Chiapas',
    'Chihuahua',
    'Ciudad de México',
    'Coahuila',
    'Colima',
    'Durango',
    'Estado de México',
    'Guanajuato',
    'Guerrero',
    'Hidalgo',
    'Jalisco',
    'Michoacán',
    'Morelos',
    'Nayarit',
    'Nuevo León',
    'Oaxaca',
    'Puebla',
    'Querétaro',
    'Quintana Roo',
    'San Luis Potosí',
    'Sinaloa',
    'Sonora',
    'Tabasco',
    'Tamaulipas',
    'Tlaxcala',
    'Veracruz',
    'Yucatán',
    'Zacatecas'
  ];

  // Lista de estados de Estados Unidos
  estadosEstadosUnidos: string[] = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Carolina del Norte',
    'Carolina del Sur',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Distrito de Columbia',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Luisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Míchigan',
    'Minnesota',
    'Misisipi',
    'Misuri',
    'Montana',
    'Nebraska',
    'Nevada',
    'Nueva Hampshire',
    'Nueva Jersey',
    'Nueva York',
    'Nuevo México',
    'Ohio',
    'Oklahoma',
    'Oregón',
    'Pensilvania',
    'Rhode Island',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Virginia Occidental',
    'Washington',
    'Wisconsin',
    'Wyoming'
  ];

  ngOnInit(): void {
    this.initForm();
    
    // Verificar si el usuario ya completó el registro
    this.checkIfRegistrationCompleted();
    
    // Cargar datos del usuario primero, antes de cargar borrador
    this.loadUserData(); // Cargar datos de Registro1 automáticamente
    
    // Luego cargar borrador si existe (esto sobreescribirá los datos del usuario si hay borrador)
    this.loadDraft(); 
    
    // 💡 SOLUCIÓN AL ERROR DE rfcNum: 
    // Sincroniza el RFC de la pantalla 1 con el campo técnico rfcNum para que no sea invalidado
    this.form.get('pers_rfc')?.valueChanges.subscribe(val => {
      this.form.get('rfcNum')?.setValue(val, { emitEvent: false });
    });

    // Limpiar campos de estado/entidad cuando cambie el país
    this.form.get('inst_pais_nombre')?.valueChanges.subscribe(pais => {
      if (pais === 'México') {
        // Si se selecciona México, limpiar el campo de estado de EUA
        this.form.get('inst_estado_usa')?.setValue('', { emitEvent: false });
      } else if (pais === 'Estados Unidos') {
        // Si se selecciona EUA, limpiar el campo de entidad federativa
        this.form.get('inst_entidad_nombre')?.setValue('', { emitEvent: false });
      } else {
        // Si no hay país seleccionado, limpiar ambos
        this.form.get('inst_entidad_nombre')?.setValue('', { emitEvent: false });
        this.form.get('inst_estado_usa')?.setValue('', { emitEvent: false });
      }
    });

    // Validar que las horas totales no sean negativas (mínimo 0, pero inicializa en 5)
    this.form.get('curso_horas_totales')?.valueChanges.subscribe(val => {
      if (val !== null && val !== undefined) {
        const numVal = Number(val);
        if (isNaN(numVal) || numVal < 0) {
          this.form.get('curso_horas_totales')?.setValue(0, { emitEvent: false });
        }
      }
    });

    // Validar que todos los campos numéricos no acepten valores negativos
    // art_anio tiene un mínimo especial de 1800
    const numericFields = ['art_total_citas', 'art_autor_orden', 'logro_anio'];
    numericFields.forEach(fieldName => {
      this.form.get(fieldName)?.valueChanges.subscribe(val => {
        if (val !== null && val !== undefined && val !== '') {
          const numVal = Number(val);
          if (!isNaN(numVal) && numVal < 0) {
            this.form.get(fieldName)?.setValue(0, { emitEvent: false });
          }
        }
      });
    });

    // Validación especial para art_anio: mínimo 1800
    this.form.get('art_anio')?.valueChanges.subscribe(val => {
      if (val !== null && val !== undefined && val !== '') {
        const numVal = Number(val);
        if (!isNaN(numVal) && numVal < 1800) {
          this.form.get('art_anio')?.setValue(1800, { emitEvent: false });
        }
      } else if (val === null || val === undefined || val === '') {
        // Si está vacío, establecer un valor por defecto solo si hay otros datos del artículo
        const titulo = this.form.get('art_titulo')?.value;
        if (titulo && titulo.trim() !== '') {
          // Si hay título pero no año, no establecer un año por defecto
          // El usuario debe ingresarlo
        }
      }
    });

    // Validación condicional: art_fondo_prog_nombre es obligatorio si art_recibio_apoyo_SECIHTI es true
    this.form.get('art_recibio_apoyo_SECIHTI')?.valueChanges.subscribe(recibioApoyo => {
      const fondoProgControl = this.form.get('art_fondo_prog_nombre');
      if (recibioApoyo) {
        fondoProgControl?.setValidators([Validators.required]);
      } else {
        fondoProgControl?.clearValidators();
        fondoProgControl?.setValue('', { emitEvent: false });
      }
      setTimeout(() => fondoProgControl?.updateValueAndValidity({ emitEvent: false }), 0);
    });

    // Validación condicional: Si el nivel de idioma cambia a Básico o Regular, desactivar certificación
    this.form.get('idioma_dominio_nombre')?.valueChanges.subscribe(nivelDominio => {
      const esCertificadoControl = this.form.get('idioma_es_certificado');
      if (nivelDominio !== 'Avanzado' && nivelDominio !== 'Excelente') {
        esCertificadoControl?.setValue(false, { emitEvent: false });
        this.form.get('idioma_cert_institucion')?.setValue('', { emitEvent: false });
        this.form.get('idioma_cert_puntuacion')?.setValue('', { emitEvent: false });
        this.form.get('idioma_vigencia_fin')?.setValue('', { emitEvent: false });
        this.form.get('idioma_cert_institucion')?.clearValidators();
        this.form.get('idioma_cert_puntuacion')?.clearValidators();
      } else {
        if (esCertificadoControl?.value) {
          this.form.get('idioma_cert_institucion')?.setValidators([Validators.required]);
          this.form.get('idioma_cert_puntuacion')?.setValidators([Validators.required]);
        }
      }
      setTimeout(() => {
        this.form.get('idioma_cert_institucion')?.updateValueAndValidity({ emitEvent: false });
        this.form.get('idioma_cert_puntuacion')?.updateValueAndValidity({ emitEvent: false });
      }, 0);
    });

    // Validación condicional: Si se activa certificación, validar campos requeridos
    this.form.get('idioma_es_certificado')?.valueChanges.subscribe(esCertificado => {
      if (esCertificado && this.mostrarCertificacion()) {
        this.form.get('idioma_cert_institucion')?.setValidators([Validators.required]);
        this.form.get('idioma_cert_puntuacion')?.setValidators([Validators.required]);
      } else {
        this.form.get('idioma_cert_institucion')?.clearValidators();
        this.form.get('idioma_cert_puntuacion')?.clearValidators();
      }
      setTimeout(() => {
        this.form.get('idioma_cert_institucion')?.updateValueAndValidity({ emitEvent: false });
        this.form.get('idioma_cert_puntuacion')?.updateValueAndValidity({ emitEvent: false });
      }, 0);
    });

    // Validación condicional: Si hay producto obtenido en divulgación, el archivo es requerido
    this.form.get('divulg_prod_obtenido_nombre')?.valueChanges.subscribe(productoObtenido => {
      const archivoControl = this.form.get('divulg_archivo');
      if (productoObtenido && productoObtenido !== '') {
        archivoControl?.setValidators([requiredFile()]);
      } else {
        archivoControl?.clearValidators();
        archivoControl?.setValue(null, { emitEvent: false });
      }
      setTimeout(() => archivoControl?.updateValueAndValidity({ emitEvent: false }), 0);
    });

    // Validación condicional: Si es empleo actual, deshabilitar y limpiar fecha de término
    this.form.get('tray_prof_es_actual')?.valueChanges.subscribe(esActual => {
      const fechaFinControl = this.form.get('tray_prof_fecha_fin');
      if (esActual) {
        fechaFinControl?.setValue('', { emitEvent: false });
        fechaFinControl?.disable({ emitEvent: false });
      } else {
        fechaFinControl?.enable({ emitEvent: false });
      }
    });

    // Validación condicional: inst_entidad_nombre es obligatorio si inst_pais_nombre es 'México'
    // inst_estado_usa es obligatorio si inst_pais_nombre es 'Estados Unidos'
    this.form.get('inst_pais_nombre')?.valueChanges.subscribe(paisNombre => {
      const entidadControl = this.form.get('inst_entidad_nombre');
      const estadoUsaControl = this.form.get('inst_estado_usa');
      
      if (paisNombre === 'México') {
        entidadControl?.setValidators([Validators.required]);
        estadoUsaControl?.clearValidators();
        estadoUsaControl?.setValue('', { emitEvent: false });
      } else if (paisNombre === 'Estados Unidos') {
        estadoUsaControl?.setValidators([Validators.required]);
        entidadControl?.clearValidators();
        entidadControl?.setValue('', { emitEvent: false });
      } else {
        entidadControl?.clearValidators();
        estadoUsaControl?.clearValidators();
        entidadControl?.setValue('', { emitEvent: false });
        estadoUsaControl?.setValue('', { emitEvent: false });
      }
      
      setTimeout(() => {
        entidadControl?.updateValueAndValidity({ emitEvent: false });
        estadoUsaControl?.updateValueAndValidity({ emitEvent: false });
      }, 0);
    });

    // Verificar estado inicial: si ya está marcado como actual, deshabilitar fecha de término
    const esActualInicial = this.form.get('tray_prof_es_actual')?.value;
    if (esActualInicial) {
      const fechaFinControl = this.form.get('tray_prof_fecha_fin');
      fechaFinControl?.setValue('', { emitEvent: false });
      fechaFinControl?.disable({ emitEvent: false });
    }
  }

  /**
   * Verificar si el usuario ya completó el registro
   */
  private checkIfRegistrationCompleted(): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    // Verificar si el usuario tiene un PerfilMigracion guardado
    this.http.get<any>(`${environment.apiBaseUrl}/migracion/verificar`).subscribe({
      next: (response: any) => {
        if (response && response.tienePerfilMigracion) {
          // El usuario ya completó el registro
          this.showRegistrationCompletedAlert(
            response.usuarioId, 
            response.perfilMigracionId,
            response.nombreCompleto,
            response.curp
          );
        }
        // Si no tiene perfilMigracion, permitir continuar normalmente
      },
      error: (err) => {
        // Si hay error al verificar, permitir continuar (por si acaso)
        // Error al verificar estado del registro - continuar normalmente
        // No mostrar error al usuario, permitir que continúe
      }
    });
  }

  /**
   * Mostrar alerta de que el registro ya está completado
   */
  private showRegistrationCompletedAlert(
    usuarioId: number, 
    perfilMigracionId: number | null,
    nombreCompleto: string,
    curp: string
  ): void {
    Swal.fire({
      icon: 'info',
      title: 'Registro ya completado',
      html: `
        <p><strong>Usuaria o usuario:</strong> ${nombreCompleto}</p>
        <p><strong>CURP:</strong> ${curp}</p>
        <p>La usuaria o el usuario ya ha completado su registro previamente.</p>
        ${perfilMigracionId ? `<p><small>ID de Perfil Migración: ${perfilMigracionId}</small></p>` : ''}
        <p><strong>No es necesario completarlo nuevamente.</strong></p>
        <p>Serás redirigido a tu perfil...</p>
      `,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Ir a mi perfil',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: false,
      timer: 5000,
      timerProgressBar: true
    }).then(() => {
      // Redirigir a perfil
      this.router.navigate(['/app/perfil']);
    });
  }

  /**
   * Generar ID interno con formato SIIMEX-XXX-INV (investigador) o SIIMEX-XXX-IND (innovador).
   * XXX es el id de usuario rellenado a 3 dígitos (001, 002, ...).
   */
  private generarIdInterno(tipoPerfil: string | null, usuarioId: number | null): string {
    const sufijo = (tipoPerfil || '').toUpperCase() === 'INNOVADOR' ? 'IND' : 'INV';
    const numero = usuarioId != null ? String(usuarioId).padStart(3, '0') : '001';
    return `SIIMEX-${numero}-${sufijo}`;
  }

  /**
   * Actualizar ID interno cuando se disponga de tipoPerfil y usuarioId (tras cargar datos del usuario).
   */
  private actualizarUUID(): void {
    if (this.currentUsuarioId != null) {
      const idGenerado = this.generarIdInterno(this.currentTipoPerfil, this.currentUsuarioId);
      this.form.get('uuid_interno')?.setValue(idGenerado, { emitEvent: false });
    }
  }

  /**
   * Cargar automáticamente los datos de Registro1 del usuario autenticado
   */
  private loadUserData(): void {
    if (!this.authService.isLoggedIn()) {
      return; // No hay usuario autenticado
    }

    this.authService.me().subscribe({
      next: (userData: Usuario) => {
        // Guardar el usuarioId y tipoPerfil para usarlos al enviar el formulario y generar ID interno
        if (userData.id) {
          this.currentUsuarioId = userData.id;
        }
        this.currentTipoPerfil = userData.tipoPerfil ?? null;

        // Mapear los datos de Registro1 al formulario
        const formData: { [key: string]: string } = {};

        if (userData.nombre) {
          formData['pers_nombre'] = userData.nombre;
        }
        if (userData.apellidoPaterno) {
          formData['pers_primer_apellido'] = userData.apellidoPaterno;
        }
        if (userData.apellidoMaterno) {
          formData['pers_segundo_apellido'] = userData.apellidoMaterno;
        }
        if (userData.curp) {
          formData['pers_curp'] = userData.curp;
        }
        if (userData.rfc) {
          formData['pers_rfc'] = userData.rfc;
          formData['rfcNum'] = userData.rfc; // También actualizar el campo técnico
        }
        if (userData.fechaNacimiento) {
          // Mantener el formato yyyy-MM-dd para el input type="date"
          formData['pers_fecha_nacimiento'] = userData.fechaNacimiento;
        }
        if (userData.entidadFederativa) {
          formData['pers_entidad_nombre'] = userData.entidadFederativa;
        }
        if (userData.paisNacimiento) {
          formData['pers_pais_nac_nombre'] = userData.paisNacimiento;
        }
        if (userData.nacionalidad) {
          formData['pers_nacionalidad_nombre'] = userData.nacionalidad;
        }
        if (userData.genero) {
          // Mapear el enum del backend al valor del select
          const generoMap: { [key: string]: string } = {
            'MASCULINO': 'Hombre',
            'FEMENINO': 'Mujer',
            'OTRO': 'Otro'
          };
          const generoMapeado = generoMap[userData.genero] || userData.genero;
          formData['pers_sexo_nombre'] = generoMapeado;
        }
        if (userData.estadoCivil) {
          // Mapear el enum del backend al valor del select
          const estadoCivilMap: { [key: string]: string } = {
            'SOLTERO': 'Soltero(a)',
            'CASADO': 'Casado(a)',
            'DIVORCIADO': 'Divorciado(a)',
            'VIUDO': 'Viudo(a)',
            'UNION_LIBRE': 'Unión Libre'
          };
          const estadoCivilMapeado = estadoCivilMap[userData.estadoCivil] || userData.estadoCivil;
          formData['pers_estado_civil_nombre'] = estadoCivilMapeado;
        }

        // Generar ID interno: SIIMEX-XXX-INV (investigador) o SIIMEX-XXX-IND (innovador)
        const idInterno = this.generarIdInterno(userData.tipoPerfil ?? null, userData.id ?? null);
        formData['uuid_interno'] = idInterno;

        // Verificar si hay datos guardados en sessionStorage
        const saved = sessionStorage.getItem(this.STORAGE_KEY);
        if (!saved) {
          // No hay datos guardados, aplicar los datos del usuario directamente
          this.form.patchValue(formData);
        } else {
          // Hay datos guardados, pero verificar si son del usuario actual
          try {
            const savedData = JSON.parse(saved) as { [key: string]: any };
            // Verificar si el CURP guardado coincide con el del usuario actual
            const savedCurp = savedData['pers_curp'];
            const currentCurp = userData.curp;
            
            if (savedCurp && currentCurp && savedCurp === currentCurp) {
              // Los datos guardados son del mismo usuario
              // Aplicar los datos guardados primero
              this.form.patchValue(savedData);
              // Luego asegurar que genero y estadoCivil del usuario se apliquen (sobrescriben los guardados)
              if (formData['pers_sexo_nombre']) {
                this.form.patchValue({ pers_sexo_nombre: formData['pers_sexo_nombre'] });
              }
              if (formData['pers_estado_civil_nombre']) {
                this.form.patchValue({ pers_estado_civil_nombre: formData['pers_estado_civil_nombre'] });
              }
            } else {
              // Los datos guardados son de otro usuario, limpiarlos y aplicar datos del usuario actual
              sessionStorage.removeItem(this.STORAGE_KEY);
              this.form.patchValue(formData);
            }
          } catch (e) {
            // Error al parsear, limpiar sessionStorage y aplicar datos del usuario
            sessionStorage.removeItem(this.STORAGE_KEY);
            this.form.patchValue(formData);
          }
        }
        
        // Inicializar validaciones condicionales después de cargar datos
        this.actualizarValidacionesCondicionales();
      },
      error: (err: unknown) => {
        // No mostrar error si el usuario no está autenticado o no tiene Registro1
        // No se pudieron cargar los datos del usuario - continuar sin datos previos
      }
    });
  }

  /**
   * 📝 CONFIGURACIÓN DEL FORMULARIO (SNAKE_CASE)
   * He restaurado los campos exactamente como los tenías, pero con los Validators que pediste.
   */
  private initForm(): void {
    this.form = this.fb.group({
      // CONTROL
      uuid_interno: [''], // Se genera automáticamente basado en datos del usuario
      fecha_migracion: [new Date().toISOString()],
      estatus_migracion: ['PENDIENTE'],

      // 1. PERFIL (CVU)
      perfil_cvu: [''], perfil_login: [''], perfil_correo_alterno: [''], perfil_nivel_academico: [''],
      perfil_titulo_tratamiento: [''], perfil_filtro: [''], perfil_institucion_receptora: [''],
      perfil_created_date: [null], perfil_last_modified_date: [null],

      // 2. PERSONA PRINCIPAL
      pers_nombre: ['', [Validators.required]],
      pers_primer_apellido: ['', [Validators.required]],
      pers_segundo_apellido: [''],
      pers_curp: ['', [Validators.required]],
      pers_rfc: ['', [Validators.required]],
      pers_fecha_nacimiento: ['', [Validators.required]],
      pers_sexo_id: [''], pers_sexo_nombre: [''], pers_pais_nac_id: [''], pers_pais_nac_nombre: [''],
      pers_entidad_clave: [''], pers_entidad_nombre: ['', [Validators.required]], pers_estado_civil_id: [''], pers_estado_civil_nombre: [''],
      pers_nacionalidad_id: [''], pers_nacionalidad_nombre: [''],
      pers_orcid_url: ['', [Validators.pattern('https?://.*')]],
      pers_scholar_url: ['', [Validators.pattern('https?://.*')]],
      pers_semblanza: ['', [Validators.required]],

      // 3. FOTO E INTERESES
      foto_uri: [''], interes_descripcion: [''], habilidad_descripcion: [''], habilidad_nivel: [''],

      // 4. ÁREA DEL CONOCIMIENTO
      area_id: [''], area_nombre: ['', [Validators.required]], area_clave: ['', [Validators.required]],
      area_version: ['', [Validators.pattern('^[0-9]{4}$')]],
      campo_id: [''], campo_nombre: [''], campo_clave: [''],
      disciplina_id: [''], disciplina_nombre: [''], disciplina_clave: [''],
      subdisciplina_id: [''], subdisciplina_nombre: [''], subdisciplina_clave: [''],

      // 5. INSTITUCIÓN
      inst_clave_oficial: ['', [Validators.required]],
      inst_nombre: ['', [Validators.required]],
      inst_tipo_id: ['', [Validators.required]], inst_tipo_nombre: [''],
      inst_pais_nombre: ['', [Validators.required]], inst_entidad_nombre: [''],
      inst_estado_usa: [''],
      inst_nivel_uno_nombre: [''], inst_nivel_dos_nombre: [''],

      // 6. TRAYECTORIA ACADÉMICA
      acad_nivel_nombre: ['', [Validators.required]],
      acad_titulo: ['', [Validators.required]],
      acad_estatus_nombre: ['', [Validators.required]],
      acad_cedula_profesional: ['', [Validators.required]],
      acad_opcion_titulacion: [''], acad_titulo_tesis: [''], acad_fecha_obtencion: [''],

      // 7. IDIOMAS
      idioma_nombre: ['', [Validators.required]],
      idioma_dominio_nombre: ['', [Validators.required]],
      idioma_conversacion: [''], idioma_lectura: [''], idioma_escritura: [''],
      idioma_es_certificado: [false], idioma_cert_institucion: [''], idioma_cert_puntuacion: [''], idioma_vigencia_fin: [''],

      // 8. TRAYECTORIA PROFESIONAL / ESTANCIAS
      tray_prof_nombramiento: ['', [Validators.required]],
      tray_prof_fecha_inicio: ['', [Validators.required]],
      tray_prof_fecha_fin: [''], tray_prof_es_actual: [false], tray_prof_logros: [''],
      estancia_nombre_proyecto: ['', [Validators.required]],
      estancia_tipo_nombre: ['', [Validators.required]],
      estancia_logros: [''],
      estancia_fecha_inicio: ['', [Validators.required]],
      estancia_fecha_fin: [''],
      estancia_institucion_receptora: ['', [Validators.required]],

      // 9. DOCENCIA Y EVENTOS
      curso_nombre: ['', [Validators.required]],
      curso_programa: ['', [Validators.required]],
      curso_horas_totales: [5, [Validators.required, Validators.min(0)]],
      curso_fecha_inicio: ['', [Validators.required]],
      curso_fecha_fin: [''],
      curso_institucion: ['', [Validators.required]],
      curso_nivel_escolaridad: ['', [Validators.required]],
      congreso_nombre_evento: ['', [Validators.required]],
      congreso_titulo_trabajo: [''],
      congreso_tipo_part_nombre: ['', [Validators.required]],
      congreso_fecha: ['', [Validators.required]],
      congreso_pais_sede: ['', [Validators.required]],

      // 10. DIVULGACIÓN
      divulg_titulo: ['', [Validators.required]],
      divulg_tipo_div_nombre: ['', [Validators.required]],
      divulg_medio_nombre: ['', [Validators.required]],
      divulg_dirigido_a: [''], divulg_prod_obtenido_nombre: [''],
      divulg_fecha: ['', [Validators.required]],
      divulg_institucion_organizadora: [''],
      divulg_archivo: [null], // Archivo para productos obtenidos

      // 11. PRODUCCIÓN CIENTÍFICA (Aportaciones)
      art_id_externo: [''], art_eje: [''], art_tipo: [''], art_producto_principal: [false],
      art_anio: [null, [Validators.required, Validators.min(1800)]],
      art_issn: [''], art_issn_electronico: [''], art_doi: [''],
      art_nombre_revista: ['', [Validators.required]],
      art_titulo: ['', [Validators.required]],
      art_rol_part_nombre: ['', [Validators.required]],
      art_estado_nombre: ['Publicado', [Validators.required]],
      art_objetivo_nombre: [''], art_recibio_apoyo_SECIHTI: [false], art_fondo_prog_nombre: [''],
      art_total_citas: [0],

      // 12. AUTORÍA
      art_autor_nombre_completo: ['', [Validators.required]],
      art_autor_orcid: [''], art_autor_orden: [1],

      // 13. LOGROS
      logro_tipo: [''], 
      logro_nombre: ['', [Validators.required]],
      logro_anio: [null, [Validators.required]],

      // 14. DOCUMENTOS Y ARCHIVOS
      doc_nombre_archivo: [''],
      rfcNum: ['', [Validators.required]],
      cvFile: [null], fiscalPdf: [null], domicilio: [null], cert1: [null], cert2: [null]
    });
  }

  // --- VALIDACIÓN VISUAL ---
  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /**
   * Resalta los campos faltantes y hace focus en el primero
   */
  private resaltarYEnfocarCamposFaltantes(): void {
    const camposInvalidos: { campo: string; nombre: string; seccion: View }[] = [];
    
    // Mapeo completo de campos a sus nombres legibles y secciones
    const mapeoCampos: { [key: string]: { nombre: string; seccion: View } } = {
      // Persona Principal
      'pers_nombre': { nombre: 'Nombre(s)', seccion: 'personaPrincipal' },
      'pers_primer_apellido': { nombre: 'Primer Apellido', seccion: 'personaPrincipal' },
      'pers_curp': { nombre: 'CURP', seccion: 'personaPrincipal' },
      'pers_rfc': { nombre: 'RFC', seccion: 'personaPrincipal' },
      'pers_fecha_nacimiento': { nombre: 'Fecha de Nacimiento', seccion: 'personaPrincipal' },
      'pers_semblanza': { nombre: 'Resumen de trayectoria (Semblanza)', seccion: 'personaPrincipal' },
      'pers_entidad_nombre': { nombre: 'Entidad Federativa', seccion: 'personaPrincipal' },
      'rfcNum': { nombre: 'RFC (Número)', seccion: 'personaPrincipal' },
      
      // Institución
      'inst_clave_oficial': { nombre: 'Clave Oficial de la Institución', seccion: 'institucion' },
      'inst_nombre': { nombre: 'Nombre de la Institución', seccion: 'institucion' },
      'inst_tipo_id': { nombre: 'Tipo de Institución', seccion: 'institucion' },
      'inst_pais_nombre': { nombre: 'País de la Institución', seccion: 'institucion' },
      'inst_entidad_nombre': { nombre: 'Estado o Entidad Federativa', seccion: 'institucion' },
      'inst_estado_usa': { nombre: 'Estado (Estados Unidos)', seccion: 'institucion' },
      
      // Área de Conocimiento
      'area_nombre': { nombre: 'Área de Conocimiento', seccion: 'area-conocimiento' },
      'area_clave': { nombre: 'Clave del Área', seccion: 'area-conocimiento' },
      'area_version': { nombre: 'Año del Catálogo SECIHTI', seccion: 'area-conocimiento' },
      
      // Trayectoria Académica
      'acad_nivel_nombre': { nombre: 'Nivel Académico', seccion: 'trayectoria-academica' },
      'acad_estatus_nombre': { nombre: 'Estatus Académico', seccion: 'trayectoria-academica' },
      'acad_titulo': { nombre: 'Título Obtenido', seccion: 'trayectoria-academica' },
      'acad_cedula_profesional': { nombre: 'Cédula Profesional', seccion: 'trayectoria-academica' },
      
      // Trayectoria Profesional
      'tray_prof_nombramiento': { nombre: 'Puesto o Nombramiento', seccion: 'trayectoria-profesional' },
      'tray_prof_fecha_inicio': { nombre: 'Fecha de Inicio', seccion: 'trayectoria-profesional' },
      
      // Cursos
      'curso_nombre': { nombre: 'Nombre del Curso', seccion: 'cursos' },
      'curso_programa': { nombre: 'Nombre del Programa Académico', seccion: 'cursos' },
      'curso_horas_totales': { nombre: 'Horas Totales', seccion: 'cursos' },
      'curso_fecha_inicio': { nombre: 'Fecha de Inicio del Curso', seccion: 'cursos' },
      'curso_institucion': { nombre: 'Institución donde se impartió', seccion: 'cursos' },
      'curso_nivel_escolaridad': { nombre: 'Nivel de Escolaridad del Curso', seccion: 'cursos' },
      
      // Idiomas
      'idioma_nombre': { nombre: 'Idioma', seccion: 'idiomas' },
      'idioma_dominio_nombre': { nombre: 'Dominio Global del Idioma', seccion: 'idiomas' },
      'idioma_cert_institucion': { nombre: 'Institución Evaluadora', seccion: 'idiomas' },
      'idioma_cert_puntuacion': { nombre: 'Puntuación / Score', seccion: 'idiomas' },
      
      // Estancias
      'estancia_nombre_proyecto': { nombre: 'Nombre del Proyecto o Estancia', seccion: 'estancias' },
      'estancia_fecha_inicio': { nombre: 'Fecha de Inicio', seccion: 'estancias' },
      'estancia_tipo_nombre': { nombre: 'Tipo de Estancia', seccion: 'estancias' },
      'estancia_institucion_receptora': { nombre: 'Institución Receptora', seccion: 'estancias' },
      
      // Artículos (Aportaciones)
      'art_titulo': { nombre: 'Título del Artículo', seccion: 'aportaciones' },
      'art_anio': { nombre: 'Año de Publicación', seccion: 'aportaciones' },
      'art_nombre_revista': { nombre: 'Revista Científica', seccion: 'aportaciones' },
      'art_rol_part_nombre': { nombre: 'Tu Rol en el Artículo', seccion: 'aportaciones' },
      'art_estado_nombre': { nombre: 'Estado de la Obra', seccion: 'aportaciones' },
      'art_autor_nombre_completo': { nombre: 'Nombre Completo del Autor', seccion: 'aportaciones' },
      'art_fondo_prog_nombre': { nombre: 'Fondo / Programa', seccion: 'aportaciones' },
      
      // Congresos
      'congreso_nombre_evento': { nombre: 'Nombre del Congreso / Simposio', seccion: 'congresos' },
      'congreso_fecha': { nombre: 'Fecha del Evento', seccion: 'congresos' },
      'congreso_pais_sede': { nombre: 'País sede', seccion: 'congresos' },
      'congreso_tipo_part_nombre': { nombre: 'Tipo de Participación', seccion: 'congresos' },
      
      // Divulgación
      'divulg_titulo': { nombre: 'Título del Trabajo', seccion: 'divulgacion' },
      'divulg_tipo_div_nombre': { nombre: 'Tipo de Divulgación', seccion: 'divulgacion' },
      'divulg_medio_nombre': { nombre: 'Medio de Comunicación', seccion: 'divulgacion' },
      'divulg_fecha': { nombre: 'Fecha de Realización', seccion: 'divulgacion' },
      'divulg_archivo': { nombre: 'Documento Probatorio', seccion: 'divulgacion' },
      
      // Logros
      'logro_nombre': { nombre: 'Nombre del Logro', seccion: 'logros' },
      'logro_anio': { nombre: 'Año de Obtención', seccion: 'logros' }
    };

    // Recorrer todos los controles del formulario para encontrar campos inválidos
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (control && control.invalid) {
        // Priorizar campos con error 'required'
        if (control.hasError('required')) {
          const info = mapeoCampos[key];
          if (info) {
            // Verificar validaciones condicionales
            // idioma_cert_institucion y idioma_cert_puntuacion solo son requeridos si idioma_es_certificado es true
            if ((key === 'idioma_cert_institucion' || key === 'idioma_cert_puntuacion')) {
              const esCertificado = this.form.get('idioma_es_certificado')?.value;
              const dominioNombre = this.form.get('idioma_dominio_nombre')?.value;
              // Solo es requerido si es certificado Y el dominio es Avanzado o Excelente
              if (esCertificado && (dominioNombre === 'Avanzado' || dominioNombre === 'Excelente')) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // art_fondo_prog_nombre solo es requerido si art_recibio_apoyo_SECIHTI es true
            else if (key === 'art_fondo_prog_nombre') {
              const recibioApoyo = this.form.get('art_recibio_apoyo_SECIHTI')?.value;
              if (recibioApoyo) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // divulg_archivo solo es requerido si hay un producto obtenido
            else if (key === 'divulg_archivo') {
              const prodObtenido = this.form.get('divulg_prod_obtenido_nombre')?.value;
              if (prodObtenido && prodObtenido !== '') {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // inst_entidad_nombre solo es requerido si inst_pais_nombre es 'México'
            else if (key === 'inst_entidad_nombre') {
              const paisNombre = this.form.get('inst_pais_nombre')?.value;
              if (paisNombre === 'México') {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // inst_estado_usa solo es requerido si inst_pais_nombre es 'Estados Unidos'
            else if (key === 'inst_estado_usa') {
              const paisNombre = this.form.get('inst_pais_nombre')?.value;
              if (paisNombre === 'Estados Unidos') {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // Para todos los demás campos, agregarlos directamente
            else {
              camposInvalidos.push({
                campo: key,
                nombre: info.nombre,
                seccion: info.seccion
              });
            }
          }
        }
      }
    });

    // Si no hay campos requeridos faltantes, buscar otros tipos de errores
    if (camposInvalidos.length === 0) {
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control && control.invalid) {
          const info = mapeoCampos[key];
          if (info && !camposInvalidos.find(c => c.campo === key)) {
            camposInvalidos.push({
              campo: key,
              nombre: info.nombre,
              seccion: info.seccion
            });
          }
        }
      });
    }

    if (camposInvalidos.length > 0) {
      // Ordenar por sección para agrupar
      const seccionesOrden: { [key: string]: number } = {
        'personaPrincipal': 1,
        'institucion': 2,
        'area-conocimiento': 3,
        'trayectoria-academica': 4,
        'trayectoria-profesional': 5,
        'idiomas': 6,
        'cursos': 7,
        'estancias': 8,
        'aportaciones': 9,
        'congresos': 10,
        'divulgacion': 11,
        'logros': 12
      };

      camposInvalidos.sort((a, b) => {
        const ordenA = seccionesOrden[a.seccion] || 999;
        const ordenB = seccionesOrden[b.seccion] || 999;
        return ordenA - ordenB;
      });

      const primerCampo = camposInvalidos[0];
      
      // Función auxiliar para encontrar un elemento en el DOM
      const encontrarElemento = (campo: string, seccion?: View): HTMLElement | null => {
        // Mapeo especial para campos de archivo que pueden tener nombres diferentes en el HTML
        const campoMapeo: { [key: string]: string[] } = {
          'divulg_archivo': ['divulg_archivo', 'divulgArchivo'],
          'cert1': ['cert1'],
          'cert2': ['cert2'],
          'cvFile': ['cvFile'],
          'fiscalPdf': ['fiscalPdf'],
          'domicilio': ['domicilio']
        };
        
        const nombresBuscar = campoMapeo[campo] || [campo];
        
        // Si se proporciona una sección, buscar primero en esa sección
        if (seccion) {
          const seccionElement = document.querySelector(`section[ng-reflect-ng-switch-case="${seccion}"]`) ||
                                 document.querySelector(`section[ng-reflect-ng-switch-case="'${seccion}'"]`);
          if (seccionElement) {
            for (const nombreBuscar of nombresBuscar) {
              // Estrategia 1: Buscar por formControlName dentro de la sección
              let elemento = seccionElement.querySelector(`[formControlName="${nombreBuscar}"]`) as HTMLElement;
              if (elemento) return elemento;
              
              // Estrategia 2: Buscar por ID dentro de la sección
              elemento = seccionElement.querySelector(`#${nombreBuscar}`) as HTMLElement;
              if (elemento) return elemento;
              
              // Estrategia 3: Buscar por ID con sufijo _inicio
              elemento = seccionElement.querySelector(`#${nombreBuscar}_inicio`) as HTMLElement;
              if (elemento) return elemento;
              
              // Estrategia 4: Buscar input[type="file"] con name o id
              elemento = seccionElement.querySelector(`input[type="file"][name="${nombreBuscar}"], input[type="file"][id="${nombreBuscar}"]`) as HTMLElement;
              if (elemento) return elemento;
            }
          }
        }
        
        // Búsqueda global si no se encontró en la sección específica
        for (const nombreBuscar of nombresBuscar) {
          // Estrategia 1: Buscar por formControlName
          let elemento = document.querySelector(`[formControlName="${nombreBuscar}"]`) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 2: Buscar por ID exacto
          elemento = document.getElementById(nombreBuscar) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 3: Buscar por ID sin prefijos comunes
          const idSinPrefijo = nombreBuscar
            .replace(/^(pers_|inst_|area_|acad_|tray_prof_|curso_|idioma_|estancia_|art_|congreso_|divulg_|logro_)/, '')
            .replace(/_/g, '-');
          elemento = document.getElementById(idSinPrefijo) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 4: Buscar por ID con sufijo _inicio (para campos duplicados)
          elemento = document.getElementById(`${nombreBuscar}_inicio`) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 5: Buscar input[type="file"] con name o id
          elemento = document.querySelector(`input[type="file"][name="${nombreBuscar}"], input[type="file"][id="${nombreBuscar}"]`) as HTMLElement;
          if (elemento) return elemento;
        }
        
        // Estrategia 6: Buscar en la sección activa actual
        const seccionActual = this.view();
        const seccionElement = document.querySelector(`section[ng-reflect-ng-switch-case="${seccionActual}"]`) ||
                               document.querySelector(`section[ng-reflect-ng-switch-case="'${seccionActual}'"]`);
        if (seccionElement) {
          for (const nombreBuscar of nombresBuscar) {
            let elemento = seccionElement.querySelector(`[formControlName="${nombreBuscar}"]`) as HTMLElement;
            if (elemento) return elemento;
          }
        }
        
        return null;
      };

      // Navegar a la sección del primer campo inválido PRIMERO
      this.setView(primerCampo.seccion);
      
      // Esperar a que Angular renderice la nueva vista antes de buscar elementos
      setTimeout(() => {
        // Resaltar todos los campos inválidos
        camposInvalidos.forEach((campoInfo, index) => {
          setTimeout(() => {
            const elemento = encontrarElemento(campoInfo.campo, campoInfo.seccion);
            if (elemento) {
              // Agregar clase de resaltado temporal
              elemento.classList.add('campo-faltante-resaltado');
              // También agregar clase is-invalid si es un input/select/textarea
              if (elemento.tagName === 'INPUT' || elemento.tagName === 'SELECT' || elemento.tagName === 'TEXTAREA') {
                elemento.classList.add('is-invalid');
              }
              // Remover después de 4 segundos
              setTimeout(() => {
                elemento.classList.remove('campo-faltante-resaltado');
              }, 4000);
            }
          }, 150 * (index + 1));
        });

        // Hacer scroll y focus en el primer campo después de un delay adicional
        setTimeout(() => {
          const primerElemento = encontrarElemento(primerCampo.campo, primerCampo.seccion);
          if (primerElemento) {
            // Scroll suave al elemento
            primerElemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            // Delay antes del focus para asegurar que el scroll termine
            setTimeout(() => {
              if (primerElemento instanceof HTMLInputElement || 
                  primerElemento instanceof HTMLSelectElement || 
                  primerElemento instanceof HTMLTextAreaElement) {
                primerElemento.focus();
                // Si es un select, intentar abrirlo (solo funciona en algunos navegadores)
                if (primerElemento instanceof HTMLSelectElement) {
                  // Forzar el focus y hacer click para abrir el dropdown
                  primerElemento.click();
                }
              }
            }, 600);
          } else {
            // Si no se encuentra el elemento, hacer scroll al inicio de la sección
            const seccionElement = document.querySelector(`section[ng-reflect-ng-switch-case="${primerCampo.seccion}"]`) ||
                                   document.querySelector(`section[ng-reflect-ng-switch-case="'${primerCampo.seccion}'"]`);
            if (seccionElement) {
              seccionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }, 300);
      }, 200); // Esperar 200ms para que Angular renderice la nueva vista

      // Agrupar campos por sección para el mensaje
      const camposPorSeccion: { [key: string]: string[] } = {};
      camposInvalidos.forEach(campo => {
        if (!camposPorSeccion[campo.seccion]) {
          camposPorSeccion[campo.seccion] = [];
        }
        camposPorSeccion[campo.seccion].push(campo.nombre);
      });

      // Construir mensaje agrupado por sección
      const nombresSecciones: { [key: string]: string } = {
        'personaPrincipal': 'Datos Personales',
        'institucion': 'Institución',
        'area-conocimiento': 'Área de Conocimiento',
        'trayectoria-academica': 'Trayectoria Académica',
        'trayectoria-profesional': 'Trayectoria Profesional',
        'idiomas': 'Idiomas',
        'cursos': 'Cursos Impartidos',
        'estancias': 'Estancias de Investigación',
        'aportaciones': 'Aportaciones Científicas',
        'congresos': 'Congresos y Eventos',
        'divulgacion': 'Divulgación Científica',
        'logros': 'Logros y Reconocimientos'
      };

      let mensajeHtml = '';
      const primeraSeccion = nombresSecciones[primerCampo.seccion] || primerCampo.seccion;
      
      // Mensaje destacado sobre la navegación
      mensajeHtml += `<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-bottom: 15px; border-radius: 4px;">`;
      mensajeHtml += `<strong>📍 Te hemos llevado a la sección: "${primeraSeccion}"</strong><br>`;
      mensajeHtml += `<small>Revisa los campos marcados en rojo y completa la información faltante.</small>`;
      mensajeHtml += `</div>`;
      
      // Lista de campos faltantes agrupados por sección
      Object.keys(camposPorSeccion).forEach(seccion => {
        const nombreSeccion = nombresSecciones[seccion] || seccion;
        const esPrimeraSeccion = seccion === primerCampo.seccion;
        mensajeHtml += `<div style="${esPrimeraSeccion ? 'background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 10px;' : 'margin-bottom: 10px;'}">`;
        mensajeHtml += `<strong style="color: ${esPrimeraSeccion ? '#800020' : '#333'};">
          ${esPrimeraSeccion ? '👉 ' : ''}${nombreSeccion}:
        </strong><br>`;
        camposPorSeccion[seccion].forEach(nombre => {
          mensajeHtml += `• ${nombre}<br>`;
        });
        mensajeHtml += `</div>`;
      });

      const totalCampos = camposInvalidos.length;
      const titulo = totalCampos === 1 
        ? 'Falta completar 1 campo obligatorio'
        : `Faltan completar ${totalCampos} campos obligatorios`;

      Swal.fire({
        icon: 'warning',
        title: titulo,
        html: `<div style="text-align: left; max-height: 400px; overflow-y: auto; padding: 5px;">${mensajeHtml}</div>`,
        confirmButtonColor: '#800020',
        confirmButtonText: 'Entendido',
        width: '700px',
        customClass: {
          popup: 'swal-popup-custom'
        },
        didOpen: () => {
          // Asegurar que el scroll funcione después de que se abra el modal
          setTimeout(() => {
            const primerElemento = encontrarElemento(primerCampo.campo, primerCampo.seccion);
            if (primerElemento) {
              primerElemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
              setTimeout(() => {
                if (primerElemento instanceof HTMLInputElement || 
                    primerElemento instanceof HTMLSelectElement || 
                    primerElemento instanceof HTMLTextAreaElement) {
                  primerElemento.focus();
                }
              }, 300);
            }
          }, 100);
        }
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor, complete todos los campos obligatorios',
        confirmButtonColor: '#800020'
      });
    }
  }

  setView(v: View): void {
    this.saveDraft();
    // Asegurar que los campos de fecha estén correctamente inicializados
    this.asegurarFechasCorrectas(v);
    this.view.set(v);
    // Scroll al inicio del contenido después de que Angular renderice
    setTimeout(() => {
      const sectionContainer = document.querySelector('.section-container');
      if (sectionContainer) {
        sectionContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const mainContent = document.querySelector('.content') || document.querySelector('main');
        if (mainContent) {
          mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 150);
  }

  /**
   * Asegura que los campos de fecha de cada sección estén correctamente inicializados
   * y no tengan valores compartidos incorrectamente
   */
  private asegurarFechasCorrectas(seccionActual: View): void {
    // Mapeo de secciones a sus campos de fecha correctos
    const camposPorSeccion: { [key: string]: string[] } = {
      'cursos': ['curso_fecha_inicio', 'curso_fecha_fin'],
      'estancias': ['estancia_fecha_inicio', 'estancia_fecha_fin'],
      'trayectoria-profesional': ['tray_prof_fecha_inicio', 'tray_prof_fecha_fin'],
      'congresos': ['congreso_fecha'],
      'divulgacion': ['divulg_fecha']
    };

    const camposCorrectos = camposPorSeccion[seccionActual];
    if (camposCorrectos) {
      // Verificar que los campos correctos tengan valores válidos
      // y que no haya valores compartidos incorrectamente
      camposCorrectos.forEach(campo => {
        const control = this.form.get(campo);
        if (control) {
          const valor = control.value;
          // Si el valor es una fecha pero no corresponde al formato esperado, limpiarlo
          if (valor && typeof valor === 'string' && valor.length > 0) {
            // Validar que sea una fecha válida en formato YYYY-MM-DD
            const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!fechaRegex.test(valor)) {
              control.setValue('', { emitEvent: false });
            }
          }
        }
      });
    }
  }

  /**
   * Métodos para manejar la selección y arrastre del archivo JSON
   */
  triggerFileInput(): void {
    const input = document.getElementById('migracion_json') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  onFileSelectedJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        this.jsonFileName = file.name;
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor, selecciona un archivo JSON válido',
          confirmButtonColor: '#800020'
        });
        input.value = '';
        this.jsonFileName = null;
      }
    }
  }

  onDragOverJson(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingJson = true;
  }

  onDragLeaveJson(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingJson = false;
  }

  onDropJson(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingJson = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        this.jsonFileName = file.name;
        // Asignar el archivo al input
        const input = document.getElementById('migracion_json') as HTMLInputElement;
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor, arrastra un archivo JSON válido',
          confirmButtonColor: '#800020'
        });
      }
    }
  }

  clearJsonFile(event: Event): void {
    event.stopPropagation();
    const input = document.getElementById('migracion_json') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
    this.jsonFileName = null;
  }

  /**
   * Procesa la migración de forma independiente (separada del formulario principal)
   * Lee el archivo JSON y carga automáticamente los datos en el formulario
   */
  procesarMigracion(): void {
    const migracionJsonInput = document.getElementById('migracion_json') as HTMLInputElement;
    const migracionJsonFile = migracionJsonInput?.files?.[0];
    
    if (!migracionJsonFile) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivo requerido',
        text: 'Por favor, selecciona el archivo JSON para la migración',
        confirmButtonColor: '#800020'
      });
      return;
    }

    Swal.fire({
      title: 'Cargando archivo JSON...',
      html: '<p>Leyendo y procesando datos del archivo...</p><div class="spinner-border text-primary mt-3" role="status"><span class="visually-hidden">Cargando...</span></div>',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Leer el archivo JSON
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonContent = e.target?.result as string;
        const jsonData = JSON.parse(jsonContent);
        
        // Mapear los datos del JSON al formulario
        const datosMapeados = this.mapearDatosJSON(jsonData);
        
        // Cargar los datos en el formulario
        this.form.patchValue(datosMapeados);
        
        // Sincronizar RFC con el campo técnico rfcNum
        if (datosMapeados['pers_rfc']) {
          this.form.get('rfcNum')?.setValue(datosMapeados['pers_rfc'], { emitEvent: false });
        }
        
        // Guardar el borrador automáticamente
        this.saveDraft();
        
        // Actualizar UUID basado en los datos cargados
        this.actualizarUUID();
        
        // Contar campos cargados por sección
        const camposCargados = Object.keys(datosMapeados).filter(key => {
          const valor = datosMapeados[key];
          return valor !== null && valor !== undefined && valor !== '';
        }).length;
        
        // Contar secciones completadas
        const secciones = {
          'Datos Personales': ['pers_nombre', 'pers_curp', 'pers_rfc'].some(k => datosMapeados[k]),
          'Institución': ['inst_nombre', 'inst_clave_oficial'].some(k => datosMapeados[k]),
          'Área de Conocimiento': ['area_nombre', 'area_clave'].some(k => datosMapeados[k]),
          'Trayectoria Académica': ['acad_nivel_nombre', 'acad_titulo'].some(k => datosMapeados[k]),
          'Trayectoria Profesional': ['tray_prof_nombramiento'].some(k => datosMapeados[k]),
          'Idiomas': ['idioma_nombre'].some(k => datosMapeados[k]),
          'Estancias': ['estancia_nombre_proyecto'].some(k => datosMapeados[k]),
          'Cursos': ['curso_nombre'].some(k => datosMapeados[k]),
          'Artículos': ['art_titulo'].some(k => datosMapeados[k]),
          'Congresos': ['congreso_nombre_evento'].some(k => datosMapeados[k]),
          'Divulgación': ['divulg_titulo'].some(k => datosMapeados[k]),
          'Logros': ['logro_nombre'].some(k => datosMapeados[k])
        };
        
        const seccionesCompletadas = Object.values(secciones).filter(v => v).length;
        
        Swal.fire({
          icon: 'success',
          title: '¡Datos cargados exitosamente!',
          html: `
            <p>Se han importado <strong>${camposCargados}</strong> campos del archivo JSON.</p>
            <p>Secciones con datos: <strong>${seccionesCompletadas} de ${Object.keys(secciones).length}</strong></p>
            <p class="mt-3">Los datos han sido cargados en el formulario. Puedes revisarlos y completar los campos faltantes.</p>
          `,
          confirmButtonColor: '#800020',
          confirmButtonText: 'Continuar con el registro',
          width: '600px'
        }).then(() => {
          this.setView('personaPrincipal');
        });
        
      } catch (error) {
        console.error('Error al procesar JSON:', error);
        this.jsonFileName = null;
        Swal.fire({
          icon: 'error',
          title: 'Error al leer el archivo',
          text: 'El archivo JSON no es válido o está corrupto. Por favor, verifica el formato del archivo.',
          confirmButtonColor: '#800020'
        });
      }
    };
    
    reader.onerror = () => {
      this.jsonFileName = null;
      Swal.fire({
        icon: 'error',
        title: 'Error al leer el archivo',
        text: 'No se pudo leer el archivo JSON. Por favor, intente nuevamente.',
        confirmButtonColor: '#800020'
      });
    };
    
    reader.readAsText(migracionJsonFile);
  }

  /**
   * Mapea los datos del JSON a los campos del formulario
   * Basado en la estructura real del JSON de SECIHTI
   */
  private mapearDatosJSON(jsonData: any): { [key: string]: any } {
    const datosMapeados: { [key: string]: any } = {};
    
    // Función auxiliar para obtener valores anidados
    const getValue = (obj: any, path: string): any => {
      const keys = path.split('.');
      let value = obj;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return null;
        }
      }
      return value;
    };
    
    // Función auxiliar para obtener valor de objeto anidado (ej: sexo.nombre)
    const getNestedValue = (obj: any, path: string, subKey?: string): any => {
      const value = getValue(obj, path);
      if (value && typeof value === 'object' && subKey) {
        return value[subKey] || value.nombre || value.id || value;
      }
      return value;
    };
    
    // Función auxiliar para mapear valores con múltiples posibles rutas
    const mapField = (formField: string, ...jsonPaths: string[]): void => {
      for (const path of jsonPaths) {
        const value = getValue(jsonData, path);
        if (value !== null && value !== undefined && value !== '') {
          datosMapeados[formField] = value;
          return;
        }
      }
    };
    
    // Obtener el objeto principal del perfil
    const perfil = jsonData.perfil || jsonData;
    const principal = perfil.principal || perfil;
    
    // 1. DATOS PERSONALES (desde perfil.principal)
    if (principal.nombre) datosMapeados['pers_nombre'] = principal.nombre;
    if (principal.primerApellido) datosMapeados['pers_primer_apellido'] = principal.primerApellido;
    if (principal.segundoApellido) datosMapeados['pers_segundo_apellido'] = principal.segundoApellido;
    if (principal.curp) datosMapeados['pers_curp'] = principal.curp;
    if (principal.rfc) datosMapeados['pers_rfc'] = principal.rfc;
    if (principal.fechaNacimiento) datosMapeados['pers_fecha_nacimiento'] = principal.fechaNacimiento;
    
    // Mapear sexo (puede ser objeto con id y nombre, o string)
    if (principal.sexo) {
      const sexo = typeof principal.sexo === 'object' ? principal.sexo.nombre : principal.sexo;
      if (sexo) {
        // Convertir a formato del formulario
        const sexoMap: { [key: string]: string } = {
          'Masculino': 'Hombre',
          'MASCULINO': 'Hombre',
          'M': 'Hombre',
          'Femenino': 'Mujer',
          'FEMENINO': 'Mujer',
          'F': 'Mujer'
        };
        datosMapeados['pers_sexo_nombre'] = sexoMap[sexo] || sexo;
      }
    }
    
    // Mapear país de nacimiento
    if (principal.paisNacimiento) {
      const pais = typeof principal.paisNacimiento === 'object' ? principal.paisNacimiento.nombre : principal.paisNacimiento;
      if (pais) datosMapeados['pers_pais_nac_nombre'] = pais;
    }
    
    // Mapear entidad federativa
    if (principal.entidadFederativa) {
      const entidad = typeof principal.entidadFederativa === 'object' ? principal.entidadFederativa.nombre : principal.entidadFederativa;
      if (entidad) datosMapeados['pers_entidad_nombre'] = entidad;
    }
    
    // Mapear nacionalidad
    if (principal.nacionalidad) {
      const nacionalidad = typeof principal.nacionalidad === 'object' ? principal.nacionalidad.nombre : principal.nacionalidad;
      if (nacionalidad) datosMapeados['pers_nacionalidad_nombre'] = nacionalidad;
    }
    
    // Mapear estado civil
    if (principal.estadoCivil) {
      const estadoCivil = typeof principal.estadoCivil === 'object' ? principal.estadoCivil.nombre : principal.estadoCivil;
      if (estadoCivil) datosMapeados['pers_estado_civil_nombre'] = estadoCivil;
    }
    
    // ORCID y Scholar
    if (principal.orcId) datosMapeados['pers_orcid_url'] = principal.orcId;
    if (principal.linkedin && principal.linkedin.includes('scholar')) datosMapeados['pers_scholar_url'] = principal.linkedin;
    
    // Semblanza
    if (principal.semblanza) datosMapeados['pers_semblanza'] = principal.semblanza;
    
    // 2. ÁREA DE CONOCIMIENTO (desde perfil.principal.areaConocimiento)
    const areaConocimiento = principal.areaConocimiento;
    if (areaConocimiento) {
      if (areaConocimiento.area) {
        if (areaConocimiento.area.nombre) datosMapeados['area_nombre'] = areaConocimiento.area.nombre;
        if (areaConocimiento.area.clave) datosMapeados['area_clave'] = areaConocimiento.area.clave;
        if (areaConocimiento.area.version) datosMapeados['area_version'] = areaConocimiento.area.version;
      }
      if (areaConocimiento.campo) {
        if (areaConocimiento.campo.nombre) datosMapeados['campo_nombre'] = areaConocimiento.campo.nombre;
        if (areaConocimiento.campo.clave) datosMapeados['campo_clave'] = areaConocimiento.campo.clave;
      }
      if (areaConocimiento.disciplina) {
        if (areaConocimiento.disciplina.nombre) datosMapeados['disciplina_nombre'] = areaConocimiento.disciplina.nombre;
        if (areaConocimiento.disciplina.clave) datosMapeados['disciplina_clave'] = areaConocimiento.disciplina.clave;
      }
      if (areaConocimiento.subdisciplina) {
        if (areaConocimiento.subdisciplina.nombre) datosMapeados['subdisciplina_nombre'] = areaConocimiento.subdisciplina.nombre;
        if (areaConocimiento.subdisciplina.clave) datosMapeados['subdisciplina_clave'] = areaConocimiento.subdisciplina.clave;
      }
    }
    
    // 3. INSTITUCIÓN (tomar de trayectoria profesional actual o académica más reciente)
    const trayectoriaProfesional = perfil.trayectoriaProfesional;
    const trayectoriaAcademica = perfil.trayectoriaAcademica;
    
    // Buscar institución en trayectoria profesional actual
    let institucion = null;
    if (Array.isArray(trayectoriaProfesional) && trayectoriaProfesional.length > 0) {
      const profActual = trayectoriaProfesional.find((t: any) => t.esActual || t.esPrincipal) || trayectoriaProfesional[0];
      institucion = profActual?.institucion;
    }
    
    // Si no hay profesional, buscar en académica más reciente
    if (!institucion && Array.isArray(trayectoriaAcademica) && trayectoriaAcademica.length > 0) {
      institucion = trayectoriaAcademica[trayectoriaAcademica.length - 1]?.institucion;
    }
    
    if (institucion) {
      if (institucion.clave) datosMapeados['inst_clave_oficial'] = institucion.clave;
      if (institucion.nombre) datosMapeados['inst_nombre'] = institucion.nombre;
      if (institucion.tipo) {
        const tipo = typeof institucion.tipo === 'object' ? institucion.tipo.nombre : institucion.tipo;
        if (tipo === 'Nacional') datosMapeados['inst_tipo_id'] = 'NAC';
        else if (tipo === 'Extranjera') datosMapeados['inst_tipo_id'] = 'EXT';
      }
      if (institucion.pais) {
        const pais = typeof institucion.pais === 'object' ? institucion.pais.nombre : institucion.pais;
        if (pais) datosMapeados['inst_pais_nombre'] = pais;
      }
      if (institucion.entidad) {
        const entidad = typeof institucion.entidad === 'object' ? institucion.entidad.nombre : institucion.entidad;
        if (entidad) datosMapeados['inst_entidad_nombre'] = entidad;
      }
      if (institucion.nivelUno) {
        const nivelUno = typeof institucion.nivelUno === 'object' ? institucion.nivelUno.nombre : institucion.nivelUno;
        if (nivelUno) datosMapeados['inst_nivel_uno_nombre'] = nivelUno;
      }
      if (institucion.nivelDos) {
        const nivelDos = typeof institucion.nivelDos === 'object' ? institucion.nivelDos.nombre : institucion.nivelDos;
        if (nivelDos) datosMapeados['inst_nivel_dos_nombre'] = nivelDos;
      }
    }
    
    // 4. TRAYECTORIA ACADÉMICA (tomar el grado más alto o más reciente)
    if (Array.isArray(trayectoriaAcademica) && trayectoriaAcademica.length > 0) {
      // Buscar doctorado primero, luego maestría, luego licenciatura
      const doctorado = trayectoriaAcademica.find((t: any) => t.nivelEscolaridad?.nombre === 'Doctorado' || t.nivelEscolaridad?.id === '8');
      const maestria = trayectoriaAcademica.find((t: any) => t.nivelEscolaridad?.nombre === 'Maestría' || t.nivelEscolaridad?.id === '7');
      const licenciatura = trayectoriaAcademica.find((t: any) => t.nivelEscolaridad?.nombre === 'Licenciatura' || t.nivelEscolaridad?.id === '5');
      
      const grado = doctorado || maestria || licenciatura || trayectoriaAcademica[trayectoriaAcademica.length - 1];
      
      if (grado) {
        if (grado.nivelEscolaridad) {
          const nivel = typeof grado.nivelEscolaridad === 'object' ? grado.nivelEscolaridad.nombre : grado.nivelEscolaridad;
          if (nivel) datosMapeados['acad_nivel_nombre'] = nivel;
        }
        if (grado.titulo) datosMapeados['acad_titulo'] = grado.titulo;
        if (grado.estatus) {
          const estatus = typeof grado.estatus === 'object' ? grado.estatus.nombre : grado.estatus;
          if (estatus) {
            // Mapear estatus
            const estatusMap: { [key: string]: string } = {
              'Grado obtenido': 'Titulado',
              'Grado en curso': 'En curso',
              'Grado en trámite': 'En trámite'
            };
            datosMapeados['acad_estatus_nombre'] = estatusMap[estatus] || estatus;
          }
        }
        if (grado.cedulaProfesional) datosMapeados['acad_cedula_profesional'] = grado.cedulaProfesional;
        if (grado.opcionTitulacion) {
          const opcion = typeof grado.opcionTitulacion === 'object' ? grado.opcionTitulacion.nombre : grado.opcionTitulacion;
          if (opcion) datosMapeados['acad_opcion_titulacion'] = opcion;
        }
        if (grado.tituloTesis) datosMapeados['acad_titulo_tesis'] = grado.tituloTesis;
        if (grado.fechaObtencion) datosMapeados['acad_fecha_obtencion'] = grado.fechaObtencion;
      }
    }
    
    // 5. TRAYECTORIA PROFESIONAL (tomar el empleo actual o principal)
    if (Array.isArray(trayectoriaProfesional) && trayectoriaProfesional.length > 0) {
      const profActual = trayectoriaProfesional.find((t: any) => t.esActual || t.esPrincipal) || trayectoriaProfesional[0];
      
      if (profActual) {
        if (profActual.nombramiento) datosMapeados['tray_prof_nombramiento'] = profActual.nombramiento;
        if (profActual.fechaInicio) datosMapeados['tray_prof_fecha_inicio'] = profActual.fechaInicio;
        if (profActual.fechaFin) datosMapeados['tray_prof_fecha_fin'] = profActual.fechaFin;
        if (profActual.esActual !== undefined) datosMapeados['tray_prof_es_actual'] = profActual.esActual;
        if (profActual.logros) datosMapeados['tray_prof_logros'] = profActual.logros;
      }
    }
    
    // 6. IDIOMAS (tomar el primer idioma con certificación o el primero disponible)
    const idiomaLengua = perfil.idiomaLengua;
    if (idiomaLengua && Array.isArray(idiomaLengua.idiomas) && idiomaLengua.idiomas.length > 0) {
      const idioma = idiomaLengua.idiomas.find((i: any) => i.esCertificado) || idiomaLengua.idiomas[0];
      
      if (idioma) {
        if (idioma.nombre) {
          const nombreIdioma = typeof idioma.nombre === 'object' ? idioma.nombre.nombre : idioma.nombre;
          if (nombreIdioma) datosMapeados['idioma_nombre'] = nombreIdioma;
        }
        if (idioma.dominio) {
          const dominio = typeof idioma.dominio === 'object' ? idioma.dominio.nombre : idioma.dominio;
          if (dominio) {
            // Mapear dominio a formato del formulario
            const dominioMap: { [key: string]: string } = {
              'Nivel universitario': 'Excelente',
              'Avanzado': 'Avanzado',
              'Intermedio': 'Bueno',
              'Básico': 'Básico'
            };
            datosMapeados['idioma_dominio_nombre'] = dominioMap[dominio] || dominio;
          }
        }
        if (idioma.lectura) {
          const lectura = typeof idioma.lectura === 'object' ? idioma.lectura.nombre : idioma.lectura;
          if (lectura) datosMapeados['idioma_lectura'] = lectura;
        }
        if (idioma.escritura) {
          const escritura = typeof idioma.escritura === 'object' ? idioma.escritura.nombre : idioma.escritura;
          if (escritura) datosMapeados['idioma_escritura'] = escritura;
        }
        if (idioma.conversacion) {
          const conversacion = typeof idioma.conversacion === 'object' ? idioma.conversacion.nombre : idioma.conversacion;
          if (conversacion) datosMapeados['idioma_conversacion'] = conversacion;
        }
        if (idioma.esCertificado !== undefined) datosMapeados['idioma_es_certificado'] = idioma.esCertificado;
        if (idioma.nombreInstitucion) datosMapeados['idioma_cert_institucion'] = idioma.nombreInstitucion;
        if (idioma.puntuacion) datosMapeados['idioma_cert_puntuacion'] = idioma.puntuacion;
        if (idioma.finVigencia) datosMapeados['idioma_vigencia_fin'] = idioma.finVigencia;
      }
    }
    
    // 7. ESTANCIAS (tomar la más reciente)
    const estancias = perfil.estancias;
    if (Array.isArray(estancias) && estancias.length > 0) {
      const estancia = estancias[estancias.length - 1]; // La más reciente
      
      if (estancia) {
        if (estancia.nombre) datosMapeados['estancia_nombre_proyecto'] = estancia.nombre;
        if (estancia.tipo) {
          const tipo = typeof estancia.tipo === 'object' ? estancia.tipo.nombre : estancia.tipo;
          if (tipo) datosMapeados['estancia_tipo_nombre'] = tipo;
        }
        if (estancia.fechaInicio) datosMapeados['estancia_fecha_inicio'] = estancia.fechaInicio;
        if (estancia.fechaFin) datosMapeados['estancia_fecha_fin'] = estancia.fechaFin;
        if (estancia.institucion) {
          const instNombre = typeof estancia.institucion === 'object' ? estancia.institucion.nombre : estancia.institucion;
          if (instNombre) datosMapeados['estancia_institucion_receptora'] = instNombre;
        }
        if (estancia.logros) datosMapeados['estancia_logros'] = estancia.logros;
      }
    }
    
    // 8. CURSOS (tomar el curso marcado como producto principal o el más reciente)
    const cursosImpartidos = perfil.cursosImpartidos;
    if (Array.isArray(cursosImpartidos) && cursosImpartidos.length > 0) {
      const curso = cursosImpartidos.find((c: any) => c.productoPrincipal) || cursosImpartidos[cursosImpartidos.length - 1];
      
      if (curso) {
        if (curso.nombreCurso) datosMapeados['curso_nombre'] = curso.nombreCurso;
        if (curso.nombrePrograma) datosMapeados['curso_programa'] = curso.nombrePrograma;
        if (curso.horasTotales) datosMapeados['curso_horas_totales'] = curso.horasTotales;
        if (curso.fechaInicio) datosMapeados['curso_fecha_inicio'] = curso.fechaInicio;
        if (curso.fechaFin) datosMapeados['curso_fecha_fin'] = curso.fechaFin;
        if (curso.institucion) {
          const instNombre = typeof curso.institucion === 'object' ? curso.institucion.nombre : curso.institucion;
          if (instNombre) datosMapeados['curso_institucion'] = instNombre;
        }
        if (curso.nivelEscolaridad) {
          const nivel = typeof curso.nivelEscolaridad === 'object' ? curso.nivelEscolaridad.nombre : curso.nivelEscolaridad;
          if (nivel) datosMapeados['curso_nivel_escolaridad'] = nivel;
        }
        if (curso.productoPrincipal !== undefined) datosMapeados['art_producto_principal'] = curso.productoPrincipal;
      }
    }
    
    // 9. APORTACIONES (ARTÍCULOS) - desde aportaciones.articulosCientifica
    const aportaciones = jsonData.aportaciones;
    if (aportaciones && Array.isArray(aportaciones.articulosCientifica) && aportaciones.articulosCientifica.length > 0) {
      // Tomar el artículo marcado como producto principal o el más reciente
      const articulo = aportaciones.articulosCientifica.find((a: any) => a.productoPrincipal) || aportaciones.articulosCientifica[0];
      
      if (articulo) {
        if (articulo.titulo) datosMapeados['art_titulo'] = articulo.titulo;
        if (articulo.nombreRevista) datosMapeados['art_nombre_revista'] = articulo.nombreRevista;
        if (articulo.anio) datosMapeados['art_anio'] = parseInt(articulo.anio) || articulo.anio;
        if (articulo.rolParticipacion) {
          const rol = typeof articulo.rolParticipacion === 'object' ? articulo.rolParticipacion.nombre : articulo.rolParticipacion;
          if (rol) {
            // Mapear rol
            const rolMap: { [key: string]: string } = {
              'Autor': 'Autor Principal',
              'Coautor': 'Coautor'
            };
            datosMapeados['art_rol_part_nombre'] = rolMap[rol] || rol;
          }
        }
        if (articulo.estado) {
          const estado = typeof articulo.estado === 'object' ? articulo.estado.nombre : articulo.estado;
          if (estado) datosMapeados['art_estado_nombre'] = estado;
        }
        if (articulo.doi) datosMapeados['art_doi'] = articulo.doi;
        if (articulo.issn) datosMapeados['art_issn'] = articulo.issn;
        if (articulo.issnElectronico) datosMapeados['art_issn_electronico'] = articulo.issnElectronico;
        if (articulo.cita && articulo.cita.totalCitas !== undefined) {
          datosMapeados['art_total_citas'] = articulo.cita.totalCitas;
        }
        if (articulo.productoPrincipal !== undefined) datosMapeados['art_producto_principal'] = articulo.productoPrincipal;
        
        // Mapear apoyo SECIHTI
        if (articulo.apoyo) {
          if (articulo.apoyo.recibioApoyoConacyt !== undefined) {
            datosMapeados['art_recibio_apoyo_SECIHTI'] = articulo.apoyo.recibioApoyoConacyt;
          }
          if (articulo.apoyo.fondoPrograma) {
            const fondo = typeof articulo.apoyo.fondoPrograma === 'object' ? articulo.apoyo.fondoPrograma.nombre : articulo.apoyo.fondoPrograma;
            if (fondo) datosMapeados['art_fondo_prog_nombre'] = fondo;
          }
        }
        
        // Mapear autor principal (primer autor con orden 1)
        if (Array.isArray(articulo.autores) && articulo.autores.length > 0) {
          const autorPrincipal = articulo.autores.find((a: any) => a.orden === 1) || articulo.autores[0];
          if (autorPrincipal) {
            const nombreCompleto = `${autorPrincipal.nombre || ''} ${autorPrincipal.primerApellido || ''} ${autorPrincipal.segundoApellido || ''}`.trim();
            if (nombreCompleto) datosMapeados['art_autor_nombre_completo'] = nombreCompleto;
            if (autorPrincipal.orcId) datosMapeados['art_autor_orcid'] = autorPrincipal.orcId;
            if (autorPrincipal.orden) datosMapeados['art_autor_orden'] = autorPrincipal.orden;
          }
        }
      }
    }
    
    // 10. CONGRESOS (tomar el congreso marcado como producto principal o el más reciente)
    const congresos = perfil.congresos;
    if (Array.isArray(congresos) && congresos.length > 0) {
      const congreso = congresos.find((c: any) => c.productoPrincipal) || congresos[congresos.length - 1];
      
      if (congreso) {
        if (congreso.nombre) datosMapeados['congreso_nombre_evento'] = congreso.nombre;
        if (congreso.tituloTrabajo) datosMapeados['congreso_titulo_trabajo'] = congreso.tituloTrabajo;
        if (congreso.tipoParticipacion) {
          const tipo = typeof congreso.tipoParticipacion === 'object' ? congreso.tipoParticipacion.nombre : congreso.tipoParticipacion;
          if (tipo) {
            // Mapear tipo de participación
            const tipoMap: { [key: string]: string } = {
              'Ponencia': 'Ponente',
              'Póster': 'Presentación de Póster',
              'Participante en mesa redonda': 'Ponente',
              'Presentación de artículo en extenso': 'Ponente'
            };
            datosMapeados['congreso_tipo_part_nombre'] = tipoMap[tipo] || tipo;
          }
        }
        if (congreso.fecha) datosMapeados['congreso_fecha'] = congreso.fecha;
        if (congreso.pais) {
          const pais = typeof congreso.pais === 'object' ? congreso.pais.nombre : congreso.pais;
          if (pais) {
            // Mapear países comunes
            const paisMap: { [key: string]: string } = {
              'United States of America': 'Estados Unidos',
              'Italy': 'Otro',
              'Spain': 'España',
              'Costa Rica': 'Otro',
              'Czech Republic': 'Otro'
            };
            datosMapeados['congreso_pais_sede'] = paisMap[pais] || 'Otro';
          }
        }
        if (congreso.productoPrincipal !== undefined) datosMapeados['art_producto_principal'] = congreso.productoPrincipal;
      }
    }
    
    // 11. DIVULGACIÓN (tomar la más reciente)
    const divulgacion = perfil.divulgacion;
    if (Array.isArray(divulgacion) && divulgacion.length > 0) {
      const divulg = divulgacion[divulgacion.length - 1];
      
      if (divulg) {
        if (divulg.tituloTrabajo) datosMapeados['divulg_titulo'] = divulg.tituloTrabajo;
        if (divulg.tipoDivulgacion) {
          const tipo = typeof divulg.tipoDivulgacion === 'object' ? divulg.tipoDivulgacion.nombre : divulg.tipoDivulgacion;
          if (tipo) {
            const tipoMap: { [key: string]: string } = {
              'Nacional': 'Científica'
            };
            datosMapeados['divulg_tipo_div_nombre'] = tipoMap[tipo] || tipo;
          }
        }
        if (divulg.tipoMedio) {
          const medio = typeof divulg.tipoMedio === 'object' ? divulg.tipoMedio.nombre : divulg.tipoMedio;
          if (medio) {
            const medioMap: { [key: string]: string } = {
              'Internet': 'Redes Sociales',
              'Medio impreso': 'Prensa Escrita'
            };
            datosMapeados['divulg_medio_nombre'] = medioMap[medio] || medio;
          }
        }
        if (divulg.dirigidoA) {
          const dirigido = typeof divulg.dirigidoA === 'object' ? divulg.dirigidoA.nombre : divulg.dirigidoA;
          if (dirigido) {
            const dirigidoMap: { [key: string]: string } = {
              'Sector estudiantil': 'Estudiantes',
              'Público en general': 'Público General'
            };
            datosMapeados['divulg_dirigido_a'] = dirigidoMap[dirigido] || dirigido;
          }
        }
        if (divulg.fecha) datosMapeados['divulg_fecha'] = divulg.fecha;
        if (divulg.nombreInstitucion) datosMapeados['divulg_institucion_organizadora'] = divulg.nombreInstitucion;
        if (Array.isArray(divulg.productoObtenido) && divulg.productoObtenido.length > 0) {
          const producto = typeof divulg.productoObtenido[0] === 'object' ? divulg.productoObtenido[0].nombre : divulg.productoObtenido[0];
          if (producto) {
            const productoMap: { [key: string]: string } = {
              'Póster': 'Material Didáctico',
              'Ponencia': 'Constancia de Participación'
            };
            datosMapeados['divulg_prod_obtenido_nombre'] = productoMap[producto] || producto;
          }
        }
      }
    }
    
    // 12. LOGROS (tomar el más reciente)
    const logros = perfil.logros;
    if (Array.isArray(logros) && logros.length > 0) {
      const logro = logros[logros.length - 1];
      
      if (logro) {
        if (logro.nombre) {
          const nombreLogro = typeof logro.nombre === 'object' ? logro.nombre.nombre : logro.nombre;
          if (nombreLogro) datosMapeados['logro_nombre'] = nombreLogro;
        }
        if (logro.anio) datosMapeados['logro_anio'] = parseInt(logro.anio) || logro.anio;
        if (logro.tipo) datosMapeados['logro_tipo'] = logro.tipo;
      }
    }
    
    return datosMapeados;
  }

  private saveDraft(): void {
    const rawData = this.form.getRawValue();
    const dataToStore = { ...rawData };
    ['cvFile', 'fiscalPdf', 'domicilio', 'cert1', 'cert2', 'divulg_archivo'].forEach(f => delete dataToStore[f]);
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
  }

  private loadDraft(): void {
    const saved = sessionStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        // Aplicar los datos guardados
        this.form.patchValue(savedData);
        // Asegurar que los campos de fecha estén correctamente inicializados
        // después de cargar el borrador
        const camposFecha = [
          'curso_fecha_inicio', 'curso_fecha_fin',
          'estancia_fecha_inicio', 'estancia_fecha_fin',
          'tray_prof_fecha_inicio', 'tray_prof_fecha_fin',
          'congreso_fecha', 'divulg_fecha'
        ];
        camposFecha.forEach(campo => {
          const control = this.form.get(campo);
          if (control) {
            const valor = control.value;
            // Validar formato de fecha (YYYY-MM-DD)
            if (valor && typeof valor === 'string' && valor.length > 0) {
              const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (!fechaRegex.test(valor)) {
                // Si no es un formato válido, limpiar el campo
                control.setValue('', { emitEvent: false });
              }
            }
          }
        });
      } catch (e) {
        // Si hay error al parsear, limpiar el sessionStorage
        sessionStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  onFileChange(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > MAX_BYTES) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo muy grande',
          text: `El archivo excede el tamaño máximo permitido de ${MAX_MB}MB`,
          confirmButtonColor: '#800020'
        });
        return;
      }
      this.form.patchValue({ [controlName]: file });
      Swal.fire({
        icon: 'success',
        title: 'Archivo cargado',
        text: `${file.name} se cargó correctamente`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  }

  /**
   * 🚀 ENVÍO FINAL (INYECCIÓN)
   */
  submitFinal(ev?: Event): void {
    ev?.preventDefault();
    this.errorMsg = '';
    this.okMsg = '';

    // Verificar autenticación antes de continuar
    if (!this.authService.isLoggedIn()) {
      Swal.fire({
        icon: 'warning',
        title: 'Sesión expirada',
        text: 'Por favor, inicia sesión nuevamente para completar tu registro',
        confirmButtonColor: '#800020',
        confirmButtonText: 'Ir al login'
      }).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    // Actualizar validaciones condicionales antes de validar
    this.actualizarValidacionesCondicionales();
    
    // Marcar todos los campos como touched para activar las validaciones
      this.form.markAllAsTouched();
    
    if (this.form.invalid) {
      this.resaltarYEnfocarCamposFaltantes();
      return;
    }

    this.submitting.set(true);

    // Asegurar que tenemos el usuarioId antes de continuar
    if (this.currentUsuarioId) {
      this.enviarFormulario();
    } else {
      // Obtener el usuarioId del usuario autenticado
      this.authService.me().subscribe({
        next: (userData: Usuario) => {
          if (userData.id) {
            this.currentUsuarioId = userData.id;
            this.enviarFormulario();
          } else {
            this.submitting.set(false);
            Swal.fire({
              icon: 'error',
              title: 'Error de autenticación',
              text: 'No se pudo obtener la información de la usuaria o del usuario. Por favor, inicia sesión nuevamente.',
              confirmButtonColor: '#800020',
              confirmButtonText: 'Ir al login'
            }).then(() => {
              this.router.navigate(['/login']);
            });
          }
        },
        error: (err) => {
          this.submitting.set(false);
          console.error('Error al obtener usuario:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error de autenticación',
            text: 'No se pudo verificar tu sesión. Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#800020',
            confirmButtonText: 'Ir al login'
          }).then(() => {
            this.router.navigate(['/login']);
          });
        }
      });
    }
  }

  private enviarFormulario(): void {
    const fd = new FormData();
    const values = this.form.getRawValue();

    // Agregar usuarioId del usuario autenticado
    if (this.currentUsuarioId) {
      fd.append('usuarioId', this.currentUsuarioId.toString());
    } else {
      this.submitting.set(false);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo identificar a la usuaria o al usuario. Por favor, recarga la página.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.construirYEnviarFormData(fd, values);
  }

  private construirYEnviarFormData(fd: FormData, values: any): void {
    // Campos que NO deben enviarse al backend
    const camposExcluidos = [
      'migracion_json', 
      'jsonFileName', 
      'fecha_migracion', 
      'estatus_migracion',
      'perfil_cvu',
      'perfil_login',
      'perfil_correo_alterno',
      'perfil_nivel_academico',
      'perfil_titulo_tratamiento',
      'perfil_filtro',
      'perfil_institucion_receptora',
      'perfil_created_date',
      'perfil_last_modified_date',
      'foto_uri',
      'habilidad_descripcion',
      'habilidad_nivel',
      'doc_nombre_archivo'
    ];
    
    Object.keys(values).forEach(key => {
      // Ignorar campos excluidos
      if (camposExcluidos.includes(key)) {
        return;
      }
      
      const val = values[key];
      if (val !== null && val !== undefined && !(val instanceof File)) {
        // Si uuid_interno está vacío, generar ID interno SIIMEX-XXX-INV/IND antes de enviar
        if (key === 'uuid_interno' && (val === '' || val.toString().trim() === '')) {
          const idGenerado = this.generarIdInterno(this.currentTipoPerfil, this.currentUsuarioId);
          const javaKey = 'migracionId'; // El backend espera migracionId
          fd.append(javaKey, idGenerado);
          return;
        }
        // Convertir uuid_interno a migracionId para el backend
        if (key === 'uuid_interno') {
          const javaKey = 'migracionId';
          fd.append(javaKey, val.toString());
          return;
        }
        
        // Convertir campos booleanos correctamente
        if (typeof val === 'boolean') {
          const javaKey = key.replace(/_([a-z])/g, (match) => match[1].toUpperCase());
          fd.append(javaKey, val ? 'true' : 'false');
          return;
        }
        
        // Convertir campos numéricos: asegurar que art_anio se envíe como número válido
        if (key === 'art_anio') {
          if (val === null || val === '' || val === undefined) {
            // Si art_anio está vacío, no enviarlo
            return;
          }
          // Asegurar que sea un número válido
          const numVal = Number(val);
          if (!isNaN(numVal) && numVal >= 1800) {
            const javaKey = 'artAnio';
            fd.append(javaKey, numVal.toString());
          } else if (!isNaN(numVal)) {
            // Si es menor a 1800, enviar 1800 como mínimo
            const javaKey = 'artAnio';
            fd.append(javaKey, '1800');
          }
          return;
        }
        
        // Mapeo especial: pers_semblanza -> interesDescripcion
        if (key === 'pers_semblanza') {
          fd.append('interesDescripcion', val.toString());
          return;
        }
        
        // Mapeo especial: pers_sexo_nombre -> genero (convertir a formato enum del backend)
        if (key === 'pers_sexo_nombre' && val) {
          const generoMap: { [key: string]: string } = {
            'Mujer': 'FEMENINO',
            'Hombre': 'MASCULINO',
            'Otro': 'OTRO'
          };
          const generoEnum = generoMap[val.toString()] || val.toString().toUpperCase();
          fd.append('genero', generoEnum);
          return;
        }
        
        // Mapeo especial: pers_estado_civil_nombre -> estadoCivil (convertir a formato enum del backend)
        if (key === 'pers_estado_civil_nombre' && val) {
          const estadoCivilMap: { [key: string]: string } = {
            'Soltero(a)': 'SOLTERO',
            'Casado(a)': 'CASADO',
            'Divorciado(a)': 'DIVORCIADO',
            'Viudo(a)': 'VIUDO',
            'Unión Libre': 'UNION_LIBRE'
          };
          const estadoCivilEnum = estadoCivilMap[val.toString()] || val.toString().replace(/\(a\)/g, '').toUpperCase().replace(/\s+/g, '_');
          fd.append('estadoCivil', estadoCivilEnum);
          return;
        }
        
        // Convertir snake_case a camelCase para el backend
        const javaKey = key.replace(/_([a-z])/g, (match) => match[1].toUpperCase());
        fd.append(javaKey, val.toString());
      }
    });

    const fileFields = ['cvFile', 'fiscalPdf', 'domicilio', 'cert1', 'cert2', 'divulg_archivo'];
    fileFields.forEach(f => {
      if (values[f] instanceof File) {
        fd.append(f, values[f]);
      }
    });

    Swal.fire({
      title: 'Procesando registro...',
      text: 'Por favor espere, esto puede tardar unos momentos',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.http.post(`${environment.apiBaseUrl}/migracion`, fd).subscribe({
      next: (res) => {
        this.submitting.set(false);
        Swal.close(); // Cerrar el loading
        sessionStorage.removeItem(this.STORAGE_KEY);
        // Actualizar datos del usuario para que el menú oculte "Completar registro"
        this.authService.me().subscribe();
        Swal.fire({
          icon: 'success',
          title: '¡Registro completado!',
          text: 'Su información ha sido guardada exitosamente.',
          confirmButtonColor: '#800020',
          confirmButtonText: 'Ir a mi perfil'
        }).then(() => {
          // Redirigir a perfil después de guardar
          this.router.navigate(['/app/perfil']);
        });
      },
      error: (err) => {
        this.submitting.set(false);
        Swal.close(); // Cerrar el loading
        
        // Manejar errores específicos
        if (err.status === 401) {
          // Token expirado o inválido
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#800020',
            confirmButtonText: 'Ir al login'
          }).then(() => {
            this.router.navigate(['/login']);
          });
        } else {
          // Otros errores
          const errorMessage = err?.error?.message || err?.error?.error || 'Error al completar el registro. Por favor, intente nuevamente.';
        Swal.fire({
          icon: 'error',
          title: 'Error al registrar',
          text: errorMessage,
            confirmButtonColor: '#800020',
            confirmButtonText: 'Entendido'
        });
        }
      }
    });
  }

  private getFormValidationErrors() {
    const errors: any = {};
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (control?.invalid) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  get f() { return this.form.controls; }

  /**
   * Muestra ayuda contextual según el tipo solicitado
   */
  mostrarAyuda(tipo: string): void {
    const ayudas: { [key: string]: { title: string; html: string } } = {
      'area': {
        title: 'Área Principal *',
        html: `
          <p><strong>¿Qué es el Área Principal?</strong></p>
          <p>El Área Principal es el nivel más amplio de clasificación según el catálogo CONACYT. Es un campo <strong>obligatorio</strong>.</p>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>📝 Nombre del Área de Conocimiento:</strong></p>
          <p>Ingresa el nombre completo del área principal según el catálogo CONACYT.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Ciencias Físico-Matemáticas y de las Ingenierías</li>
            <li>Ciencias Sociales</li>
            <li>Humanidades y Ciencias de la Conducta</li>
            <li>Ciencias Biológicas y de la Salud</li>
          </ul>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>🔑 Código del Área:</strong></p>
          <p>Ingresa el código numérico asignado al área según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1, 2, 3, etc.</p>
          <p>Este código identifica de manera única el área principal.</p>
        `
      },
      'area-nombre': {
        title: 'Nombre del Área de Conocimiento',
        html: `
          <p>Ingresa el nombre completo del área principal según el catálogo CONACYT.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Ciencias Físico-Matemáticas y de las Ingenierías</li>
            <li>Ciencias Sociales</li>
            <li>Humanidades y Ciencias de la Conducta</li>
          </ul>
        `
      },
      'area-codigo': {
        title: 'Código del Área',
        html: `
          <p>Ingresa el código numérico asignado al área según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1, 2, 3, etc.</p>
          <p>Este código identifica de manera única el área principal.</p>
        `
      },
      'campo': {
        title: 'Campo (Opcional)',
        html: `
          <p><strong>¿Qué es el Campo?</strong></p>
          <p>El Campo es un nivel específico dentro del Área Principal. Es un campo <strong>opcional</strong> que te permite especificar tu área de estudio.</p>
          <p><strong>Ejemplo:</strong></p>
          <p>Si tu Área Principal es "Ciencias Físico-Matemáticas y de las Ingenierías", tu Campo podría ser "Informática" o "Ciencias de la Computación".</p>
        `
      },
      'campo-nombre': {
        title: 'Nombre del Campo de Estudio',
        html: `
          <p>Ingresa el nombre del campo específico dentro del área principal.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Ciencias de la Computación</li>
            <li>Informática</li>
            <li>Matemáticas Aplicadas</li>
          </ul>
        `
      },
      'campo-codigo': {
        title: 'Código del Campo',
        html: `
          <p>Ingresa el código identificador del campo según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1.1, 1.2, 2.1, etc.</p>
          <p>El código generalmente sigue el formato: [Código del Área].[Número del Campo]</p>
        `
      },
      'disciplina': {
        title: 'Disciplina (Opcional)',
        html: `
          <p><strong>¿Qué es la Disciplina?</strong></p>
          <p>La Disciplina es un nivel más específico dentro del Campo. Es un campo <strong>opcional</strong>.</p>
          <p><strong>Ejemplo:</strong></p>
          <p>Si tu Campo es "Informática", tu Disciplina podría ser "Inteligencia Artificial" o "Sistemas Distribuidos".</p>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>📝 Nombre de la Disciplina:</strong></p>
          <p>Ingresa el nombre de la disciplina específica dentro del campo.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Inteligencia Artificial</li>
            <li>Sistemas Distribuidos</li>
            <li>Bases de Datos</li>
            <li>Redes de Computadoras</li>
          </ul>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>🔑 Código de la Disciplina:</strong></p>
          <p>Ingresa el código identificador de la disciplina según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1.1.1, 1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina]</p>
        `
      },
      'disciplina-nombre': {
        title: 'Nombre de la Disciplina',
        html: `
          <p>Ingresa el nombre de la disciplina específica dentro del campo.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Inteligencia Artificial</li>
            <li>Sistemas Distribuidos</li>
            <li>Bases de Datos</li>
            <li>Redes de Computadoras</li>
          </ul>
        `
      },
      'disciplina-codigo': {
        title: 'Código de la Disciplina',
        html: `
          <p>Ingresa el código identificador de la disciplina según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1.1.1, 1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina]</p>
        `
      },
      'subdisciplina': {
        title: 'Subdisciplina (Opcional)',
        html: `
          <p><strong>¿Qué es la Subdisciplina?</strong></p>
          <p>La Subdisciplina es el nivel más específico de clasificación. Es un campo <strong>opcional</strong>.</p>
          <p><strong>Ejemplo:</strong></p>
          <p>Si tu Disciplina es "Inteligencia Artificial", tu Subdisciplina podría ser "Procesamiento de Lenguaje Natural" o "Aprendizaje Automático".</p>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>📝 Nombre de la Subdisciplina:</strong></p>
          <p>Ingresa el nombre de la subdisciplina más específica dentro de la disciplina.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Procesamiento de Lenguaje Natural</li>
            <li>Aprendizaje Automático</li>
            <li>Visión por Computadora</li>
            <li>Robótica</li>
          </ul>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>🔑 Código de la Subdisciplina:</strong></p>
          <p>Ingresa el código identificador de la subdisciplina según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1.1.1.1, 1.1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina].[Subdisciplina]</p>
        `
      },
      'subdisciplina-nombre': {
        title: 'Nombre de la Subdisciplina',
        html: `
          <p>Ingresa el nombre de la subdisciplina más específica dentro de la disciplina.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Procesamiento de Lenguaje Natural</li>
            <li>Aprendizaje Automático</li>
            <li>Visión por Computadora</li>
            <li>Robótica</li>
          </ul>
        `
      },
      'subdisciplina-codigo': {
        title: 'Código de la Subdisciplina',
        html: `
          <p>Ingresa el código identificador de la subdisciplina según el catálogo CONACYT.</p>
          <p><strong>Ejemplo:</strong> 1.1.1.1, 1.1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina].[Subdisciplina]</p>
        `
      }
    };

    const ayuda = ayudas[tipo];
    if (ayuda) {
      Swal.fire({
        title: ayuda.title,
        html: ayuda.html,
        icon: 'info',
        confirmButtonColor: '#800020',
        confirmButtonText: 'Entendido',
        width: '600px'
      });
    }
  }

  // Métodos para mejorar UX
  getSectionProgress(section: View): number {
    // Calcular porcentaje de completado para cada sección
    const sectionFields: { [key: string]: string[] } = {
      'personaPrincipal': ['pers_nombre', 'pers_primer_apellido', 'pers_curp', 'pers_rfc', 'pers_fecha_nacimiento', 'pers_semblanza'],
      'institucion': ['inst_clave_oficial', 'inst_nombre', 'inst_tipo_id', 'inst_pais_nombre'],
      'area-conocimiento': ['area_nombre', 'area_clave'],
      'trayectoria-academica': ['acad_nivel_nombre', 'acad_titulo', 'acad_estatus_nombre', 'acad_cedula_profesional'],
      'trayectoria-profesional': ['tray_prof_nombramiento', 'tray_prof_fecha_inicio', 'inst_nombre'],
      'cursos': ['curso_nombre', 'curso_programa', 'curso_horas_totales', 'curso_fecha_inicio', 'curso_institucion', 'curso_nivel_escolaridad'],
      'idiomas': ['idioma_nombre', 'idioma_dominio_nombre'],
      'estancias': ['estancia_nombre_proyecto', 'estancia_tipo_nombre', 'estancia_fecha_inicio', 'estancia_institucion_receptora'],
      'aportaciones': ['art_titulo', 'art_nombre_revista', 'art_anio', 'art_rol_part_nombre', 'art_autor_nombre_completo'],
      'congresos': ['congreso_nombre_evento', 'congreso_tipo_part_nombre', 'congreso_fecha', 'congreso_pais_sede'],
      'divulgacion': ['divulg_titulo', 'divulg_tipo_div_nombre', 'divulg_medio_nombre', 'divulg_fecha'],
      'logros': ['logro_nombre', 'logro_anio']
    };

    const fields = sectionFields[section] || [];
    if (fields.length === 0) return 0;

    let completed = 0;
    fields.forEach(field => {
      const control = this.form.get(field);
      if (control && control.value && control.value !== '' && control.value !== null) {
        completed++;
      }
    });

    return Math.round((completed / fields.length) * 100);
  }

  isSectionComplete(section: View): boolean {
    return this.getSectionProgress(section) === 100;
  }

  getOverallProgress(): number {
    const sections: View[] = [
      'personaPrincipal', 'institucion', 'area-conocimiento', 
      'trayectoria-academica', 'trayectoria-profesional', 'cursos',
      'idiomas', 'estancias', 'aportaciones', 'congresos', 
      'divulgacion', 'logros'
    ];
    
    let totalProgress = 0;
    sections.forEach(section => {
      totalProgress += this.getSectionProgress(section);
    });
    
    return Math.round(totalProgress / sections.length);
  }

  getSectionSteps(): Array<{id: View, title: string, icon: string, iconImage: string, group: string, order: number, description: string}> {
    return [
      { id: 'personaPrincipal', title: 'Datos Personales', icon: 'fa-user', iconImage: 'assets/img/user.png', group: 'General', order: 1, description: 'Información personal básica' },
      { id: 'institucion', title: 'Institución', icon: 'fa-university', iconImage: 'assets/img/teacher_icon_243839.png', group: 'General', order: 2, description: 'Datos de tu institución' },
      { id: 'area-conocimiento', title: 'Área de Conocimiento', icon: 'fa-book', iconImage: 'assets/img/id-insignia.png', group: 'Perfil Académico', order: 3, description: 'Especialidad y disciplina' },
      { id: 'trayectoria-academica', title: 'Perfil Académico', icon: 'fa-graduation-cap', iconImage: 'assets/img/creative-education.png', group: 'Perfil Académico', order: 4, description: 'Grados y estudios' },
      { id: 'trayectoria-profesional', title: 'Trayectoria Profesional', icon: 'fa-briefcase', iconImage: 'assets/img/empresario.png', group: 'Perfil Académico', order: 5, description: 'Experiencia laboral' },
      { id: 'cursos', title: 'Cursos Impartidos', icon: 'fa-chalkboard-teacher', iconImage: 'assets/img/teacher_icon_243839.png', group: 'Desarrollo y Formación', order: 6, description: 'Docencia y enseñanza' },
      { id: 'idiomas', title: 'Idiomas', icon: 'fa-language', iconImage: 'assets/img/language_translator_icon_150921.png', group: 'Desarrollo y Formación', order: 7, description: 'Dominio de idiomas' },
      { id: 'estancias', title: 'Estancias de Investigación', icon: 'fa-map-marker-alt', iconImage: 'assets/img/calendario.png', group: 'Desarrollo y Formación', order: 8, description: 'Estancias académicas' },
      { id: 'aportaciones', title: 'Aportaciones Científicas', icon: 'fa-file-alt', iconImage: 'assets/img/archivo.png', group: 'Producción y Participación', order: 9, description: 'Artículos y publicaciones' },
      { id: 'congresos', title: 'Congresos y Eventos', icon: 'fa-users', iconImage: 'assets/img/communicate_connection_propaganda_announce_news_icon_143344.png', group: 'Producción y Participación', order: 10, description: 'Participación en eventos' },
      { id: 'divulgacion', title: 'Divulgación Científica', icon: 'fa-bullhorn', iconImage: 'assets/img/communicate_connection_propaganda_announce_news_icon_143344.png', group: 'Producción y Participación', order: 11, description: 'Actividades de divulgación' },
      { id: 'logros', title: 'Logros y Reconocimientos', icon: 'fa-trophy', iconImage: 'assets/img/4230509-achievement-trophy_114984.png', group: 'Reconocimientos', order: 12, description: 'Premios y distinciones' }
    ];
  }

  /**
   * Obtiene la imagen del icono para una sección específica
   */
  getSectionIconImage(sectionId: View): string {
    const step = this.getSectionSteps().find(s => s.id === sectionId);
    return step?.iconImage || 'assets/img/user.png';
  }

  /**
   * Verifica si se debe mostrar la opción de certificación
   * Solo se muestra para niveles Avanzado o Excelente
   */
  mostrarCertificacion(): boolean {
    const nivelDominio = this.form.get('idioma_dominio_nombre')?.value || '';
    return nivelDominio === 'Avanzado' || nivelDominio === 'Excelente';
  }

  /**
   * Actualiza las validaciones condicionales antes de validar el formulario
   */
  private actualizarValidacionesCondicionales(): void {
    // Validación condicional: art_fondo_prog_nombre es obligatorio si art_recibio_apoyo_SECIHTI es true
    const recibioApoyo = this.form.get('art_recibio_apoyo_SECIHTI')?.value;
    const fondoProgControl = this.form.get('art_fondo_prog_nombre');
    if (recibioApoyo) {
      fondoProgControl?.setValidators([Validators.required]);
    } else {
      fondoProgControl?.clearValidators();
    }
    fondoProgControl?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional: idioma_cert_institucion y idioma_cert_puntuacion son obligatorios 
    // si idioma_es_certificado es true Y el dominio es Avanzado o Excelente
    const esCertificado = this.form.get('idioma_es_certificado')?.value;
    const dominioNombre = this.form.get('idioma_dominio_nombre')?.value;
    const puedeCertificarse = dominioNombre === 'Avanzado' || dominioNombre === 'Excelente';
    
    if (esCertificado && puedeCertificarse) {
      this.form.get('idioma_cert_institucion')?.setValidators([Validators.required]);
      this.form.get('idioma_cert_puntuacion')?.setValidators([Validators.required]);
    } else {
      this.form.get('idioma_cert_institucion')?.clearValidators();
      this.form.get('idioma_cert_puntuacion')?.clearValidators();
    }
    this.form.get('idioma_cert_institucion')?.updateValueAndValidity({ emitEvent: false });
    this.form.get('idioma_cert_puntuacion')?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional: divulg_archivo es obligatorio si hay producto obtenido
    const prodObtenido = this.form.get('divulg_prod_obtenido_nombre')?.value;
    const archivoControl = this.form.get('divulg_archivo');
    if (prodObtenido && prodObtenido !== '') {
      archivoControl?.setValidators([requiredFile()]);
    } else {
      archivoControl?.clearValidators();
    }
    archivoControl?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional: inst_entidad_nombre es obligatorio si inst_pais_nombre es 'México'
    // inst_estado_usa es obligatorio si inst_pais_nombre es 'Estados Unidos'
    const paisNombre = this.form.get('inst_pais_nombre')?.value;
    const entidadControl = this.form.get('inst_entidad_nombre');
    const estadoUsaControl = this.form.get('inst_estado_usa');
    
    if (paisNombre === 'México') {
      entidadControl?.setValidators([Validators.required]);
      estadoUsaControl?.clearValidators();
    } else if (paisNombre === 'Estados Unidos') {
      estadoUsaControl?.setValidators([Validators.required]);
      entidadControl?.clearValidators();
    } else {
      entidadControl?.clearValidators();
      estadoUsaControl?.clearValidators();
    }
    
    entidadControl?.updateValueAndValidity({ emitEvent: false });
    estadoUsaControl?.updateValueAndValidity({ emitEvent: false });
  }
}