import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AcervoComponent } from './components/acervo/acervo.component';
import { EmprestimosComponent } from './components/emprestimos/emprestimos.component';
import { UsuariosComponent } from './components/usuarios/usuarios.component';
import { PaginaLoginComponent } from './components/pagina-login/pagina-login.component';

export const routes: Routes = [
  // Ao abrir a aplicação, vai direto para a página de login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Rotas dos componentes
  { path: 'login', component: PaginaLoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'acervo', component: AcervoComponent },
  { path: 'emprestimos', component: EmprestimosComponent },
  { path: 'usuarios', component: UsuariosComponent }
];