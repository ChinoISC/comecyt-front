import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth.service'; // 👈 ajusta ruta si tu header no está a 2 niveles

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  
})
export class HeaderComponent {
  mostrarNavbar = true;

  /** Submenús desplegables (estilo SIIMEX) */
  perfilOpen = false;
  acercaOpen = false;
  investigadoresOpen = false;
  innovadoresOpen = false;
  perfilesOpen = false;

  private auth = inject(AuthService);
  private router = inject(Router);

  loggedIn$ = this.auth.loggedIn$;
  /** Usuario actual (para ocultar "Completar registro" si ya lo completó) */
  user$ = this.auth.user$;

  logoutAndGoLanding(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
