import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { IMAGE_CONFIG } from '@angular/common';

import { routes } from './app.routes';
import { bootstrapApplication } from '@angular/platform-browser';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { jwtInterceptor } from './core/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimations(),
    { provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true } },
  ],
};
