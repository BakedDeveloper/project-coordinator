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
        loadComponent: () => import('./board/board.page').then((m) => m.BoardPage),
      },
      {
        // The priority list (former view F) until the Oggi view replaces it (#31).
        path: 'priorita',
        title: 'Priorità · Coordinatore',
        loadComponent: () =>
          import('./all-projects/all-projects.page').then((m) => m.AllProjectsPage),
      },
      {
        path: 'progetti/:id',
        // The page replaces it with the project name once loaded.
        title: 'Progetto · Coordinatore',
        loadComponent: () => import('./project/project.page').then((m) => m.ProjectPage),
      },
    ],
  },
  // Unknown pages go through the guard of the home page: login first if needed.
  { path: '**', redirectTo: '' },
];
