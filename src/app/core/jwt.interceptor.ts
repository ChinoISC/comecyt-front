import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');

  const isPublic =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register');

  // Agregar token si existe y no es una ruta pública
  if (token && !isPublic) {
    req = req.clone({ 
      setHeaders: { Authorization: `Bearer ${token}` } 
    });
  }

  return next(req).pipe(
    catchError((error) => {
      // Si recibimos un 401 (No autorizado), limpiar sesión y redirigir al login
      if (error.status === 401 && !isPublic) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        // Solo redirigir si no estamos ya en la página de login
        if (!router.url.includes('/login')) {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
