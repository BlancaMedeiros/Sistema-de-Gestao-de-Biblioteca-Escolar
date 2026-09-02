import { Routes } from '@angular/router';
//import { DashboardComponent } from './pages/dashboard/dashboard.component';
//import { AcervoComponent } from './pages/acervo/acervo.component';
//import { EmprestimosComponent } from './pages/emprestimos/emprestimos.component';
//import { UsuariosComponent } from './pages/usuarios/usuarios.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, // Se entrar sem caminho, vai pro dashboard
 // { path: 'dashboard', component: DashboardComponent },
 // { path: 'acervo', component: AcervoComponent },
 // { path: 'emprestimos', component: EmprestimosComponent },
 // { path: 'usuarios', component: UsuariosComponent }
];