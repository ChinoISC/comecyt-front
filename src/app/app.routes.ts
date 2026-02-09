import { Routes } from '@angular/router';

import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';

import { authGuard, guestGuard, adminGuard } from './core/auth.guard';
import { meResolver } from './core/resolvers/me.resolver';

import { LandingComponent } from './pages/landing/landing.component';
import { HomeComponent } from './pages/home/home.component';
import { PerfilComponent } from './pages/acerca/perfil.component';
import { CambiarContrasenaComponent } from './pages/seguridad/cambiar-contrasena.component';
import { ConvocatoriasComponent } from './pages/convocatorias/convocatorias';
import { PostulacionComponent } from './pages/postulacion/postulacion';
import { ContactoComponent } from './pages/contacto/contacto';
import { InvestigadoresComponent } from './pages/investigadores/investigadores';
import { RegistroStep2Component } from './pages/registro-step2/registro-step2';
import { TrayectoriaComponent } from './pages/trayectoria/trayectoria';
import { PersonaComponent } from './pages/personal-principal/persona.component';


export const routes: Routes = [
  // Default -> landing (redirige al landing cuando se accede a localhost)
  { path: '', pathMatch: 'full', redirectTo: 'landing' },

  // Público
  { path: 'landing', component: LandingComponent },
  { path: 'home', component: HomeComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'investigadores', component: InvestigadoresComponent },

  // Invitados
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: 'login/admin',
    loadComponent: () =>
      import('./pages/admin/admin-login.component').then(m => m.AdminLoginComponent),
  },
  { path: 'registro', component: RegisterComponent, canActivate: [guestGuard] },

  // Administrador (requiere ROLE_ADMIN)
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'registros',
        loadComponent: () =>
          import('./pages/admin/admin-registros.component').then(m => m.AdminRegistrosComponent),
      },
    ],
  },

  // ✅ Opción A: ruta raíz (no dentro de /app)
  {
    path: 'completarRegistro',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/completar-registro/completar-registro.component')
        .then(m => m.CompletarRegistroComponent),
  },

  // Privado
  {
    path: 'app',
    canActivate: [authGuard],
    resolve: { me: meResolver },
    children: [
       {
      path: 'perfil',
      component: PerfilComponent
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'cambiar-contrasena',
        component: CambiarContrasenaComponent
      },
      {
        path: 'convocatorias',
        component: ConvocatoriasComponent
      },
      {
        path: 'postulacion',
        component: PostulacionComponent
      },
      {
        path: 'registro2',
        component: RegistroStep2Component
      },
      {
        path: 'trayectoria',
        component: TrayectoriaComponent
      },


      {
        path: 'acerca-de',
        children: [
          
          {
            path: 'variables-socioeconomicas',
            loadComponent: () =>
              import('./pages/acerca/variables-socioeconomicas.component')
                .then(m => m.VariablesSocioeconomicasComponent),
          },
          {
            path: 'educacion',
            children: [
              {
                path: 'trayectoria-academica',
                loadComponent: () =>
                  import('./pages/acerca/educacion/trayectoria-academica.component')
                    .then(m => m.TrayectoriaAcademicaComponent),
              },
            ],
          },
        ],
      },

      // /app -> /landing
      { path: '', pathMatch: 'full', redirectTo: '/landing' },
    ],
  },

  // Catch-all
  { path: '**', redirectTo: 'login' },
];
