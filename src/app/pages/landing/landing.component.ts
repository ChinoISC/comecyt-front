import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent {
  private auth = inject(AuthService);

  // Si ya hay sesión, cambia CTA a "Ir al dashboard"
  isLoggedIn = computed(() => this.auth.isLoggedIn());
}
