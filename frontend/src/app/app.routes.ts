import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AcervoComponent } from './components/acervo/acervo.component';
import { EmprestimosComponent } from './components/emprestimos/emprestimos.component';
import { UsuariosComponent } from './components/usuarios/usuarios.component';
import { PaginaLoginComponent } from './components/pagina-login/pagina-login.component';
import { PerfilComponent } from './components/perfil/perfil.component';
import { autenticacaoGuard } from './guards/autenticacao.guard';

export const routes: Routes = [
  // Ao abrir a aplicação, vai direto para a página de login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Rotas dos componentes; as telas internas exigem sessão
  { path: 'login', component: PaginaLoginComponent },
  { path: 'perfil', component: PerfilComponent, canActivate: [autenticacaoGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [autenticacaoGuard] },
  { path: 'acervo', component: AcervoComponent, canActivate: [autenticacaoGuard] },
  { path: 'emprestimo', component: EmprestimosComponent, canActivate: [autenticacaoGuard] },
  { path: 'usuario', component: UsuariosComponent, canActivate: [autenticacaoGuard] }
];