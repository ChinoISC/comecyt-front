import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from './models/user';

interface LoginResponse {
  token: string;
}

export interface Registro1Request {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  rfc: string;
  fechaNacimiento: string; // yyyy-MM-dd
  genero: 'MASCULINO' | 'FEMENINO' | 'OTRO';
  nacionalidad: string;
  paisNacimiento: string;
  entidadFederativa: string;
  estadoCivil: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'UNION_LIBRE';
  /** Tipo de perfil: INVESTIGADOR o INNOVADOR */
  tipoPerfil?: 'INVESTIGADOR' | 'INNOVADOR';
}

export interface RegisterRequest {
  email: string;
  password: string;
  telefono: string;
  registro: Registro1Request;
}



interface AuthResponse {
  id: number;
  username: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';

  // Usuario en memoria (para header / app)
  readonly user$ = new BehaviorSubject<Usuario | null>(this.loadUser());

  // Estado de sesión reactivo (para header / guards)
  private readonly loggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  readonly loggedIn$ = this.loggedInSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===== Helpers =====
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  private loadUser(): Usuario | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  }

  private setSession(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.loggedInSubject.next(true);
  }

  // ===== API =====
  isLoggedIn(): boolean {
    return this.hasToken();
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password })
      .pipe(tap(res => this.setSession(res.token)));
  }

  /** Login exclusivo para administradores (debe tener ROLE_ADMIN en backend). */
  loginAdmin(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login-admin`, { email, password })
      .pipe(tap(res => this.setSession(res.token)));
  }

  /** Obtiene los roles del JWT actual (sin validar firma; solo para uso en guard). */
  getRolesFromToken(): string[] {
    const token = this.token;
    if (!token) return [];
    try {
      const payload = token.split('.')[1];
      if (!payload) return [];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(base64));
      return Array.isArray(json.roles) ? json.roles : [];
    } catch {
      return [];
    }
  }

  isAdmin(): boolean {
    return this.getRolesFromToken().includes('ROLE_ADMIN');
  }

  register(payload: RegisterRequest) {
  return this.http
    .post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, payload)
    .pipe(
      tap(res => {
        // Limpiar todos los datos del usuario anterior
        localStorage.removeItem(this.USER_KEY);
        sessionStorage.removeItem('siimex_migration_session'); // Limpiar borrador del formulario anterior
        this.user$.next(null);
        
        // Establecer nueva sesión con el token del nuevo usuario
        this.setSession(res.token);
        
        // Cargar datos del nuevo usuario inmediatamente
        this.me().subscribe({
          next: (usuario) => {
            // Los datos del nuevo usuario se guardan automáticamente en el tap de me()
          },
          error: () => {
            // Si falla cargar el usuario, no importa, el token ya está guardado
            // Se cargará cuando se necesite
          }
        });
      })
    );
}


  me() {
    return this.http
      .get<Usuario>(`${environment.apiBaseUrl}/usuarios/me`)
      .pipe(
        tap(u => {
          this.user$.next(u);
          localStorage.setItem(this.USER_KEY, JSON.stringify(u));
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.user$.next(null);
    this.loggedInSubject.next(false);
  }

  // ===== Getters =====
  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get currentUser(): Usuario | null {
    return this.user$.value;
  }
}
