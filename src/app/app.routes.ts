import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Accesso · Coordinatore',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tutti i progetti · Coordinatore',
        loadComponent: () =>
          import('./all-projects/all-projects.page').then((m) => m.AllProjectsPage),
      },
    ],
  },
  // Unknown pages go through the guard of the home page: login first if needed.
  { path: '**', redirectTo: '' },
];
