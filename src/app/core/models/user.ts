// src/app/core/models/user.ts
export interface Usuario {
    id: number;
    nombre: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    email: string;
    curp?: string;
    rfc?: string;
    genero?: string;
    fechaNacimiento?: string;
    nacionalidad?: string;
    paisNacimiento?: string;
    entidadFederativa?: string;
    estadoCivil?: string;
    /** INVESTIGADOR o INNOVADOR */
    tipoPerfil?: string;
    /** true si ya completó el formulario de completar registro (tiene PerfilMigracion) */
    tienePerfilMigracion?: boolean;
    /** Visibilidad en módulo investigadoras e investigadores: MINIMA | ESTANDAR | COMPLETA */
    visibilidadPerfil?: string;
    gradoAcademico?: string;
    fotoDocumentoId?: number;
    curriculumDocumentoId?: number;
  }
  