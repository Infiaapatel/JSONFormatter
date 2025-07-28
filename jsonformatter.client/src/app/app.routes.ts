import { Routes } from '@angular/router';


export const routes: Routes = [
  { path: '', redirectTo: 'jsonFormatter', pathMatch: 'full' },

  {
    path: 'jsonFormatter',
    loadComponent: () => import('./Components/json-formatter/json-formatter.component').then((m) => m.JsonFormatterComponent),
    //canActivate: [protectGuard]
  },
  {
    path: 'sqlFormatter',
    loadComponent: () => import('./Components/sql-formatter/sql-formatter.component').then((m) => m.SqlFormatterComponent),
   // canActivate: [protectGuard]
  },
  {
    path: 'text-Diff',
    loadComponent: () => import('./Components/text-diff/text-diff.component').then((m) => m.TextDiffComponent),
    // canActivate: [protectGuard]
  },
  {
    path: '**', loadComponent: () => import('./Components/undefine/undefine.component').then((m) => m.UndefineComponent)
  }
];
