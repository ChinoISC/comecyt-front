import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ Si no hay sesión → Landing
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/']); // o ['/landing'] si tienes esa ruta
  }
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ Si ya hay sesión, permitir acceso al login (no redirigir automáticamente)
  // El usuario puede ver el login aunque esté logueado
  return true;
};

/** Solo usuarios con ROLE_ADMIN pueden acceder al área /admin. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login/admin']);
  }
  if (!auth.isAdmin()) {
    return router.createUrlTree(['/landing']);
  }
  return true;
};
