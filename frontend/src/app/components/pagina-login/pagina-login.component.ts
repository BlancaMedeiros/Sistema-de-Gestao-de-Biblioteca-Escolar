import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pagina-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-login.component.html',
  styleUrl: './pagina-login.component.css'
})
export class PaginaLoginComponent {

  // Armazena o texto digitado nos campos
  public usuario = {
    username: '',
    password: ''
  };

  private router = inject(Router);

  public onLogin(): void {
    // 1. Confere se os campos foram preenchidos
    if (!this.usuario.username || !this.usuario.password) {
      alert('Por favor, preencha o usuário e a senha.');
      return;
    }

    // 2. Simula o login com sucesso sem precisar de serviço/API
    alert('Login realizado com sucesso!');
    
    // Guardamos uma confirmação temporária no navegador
    localStorage.setItem('usuario_logado', 'true');

    // Manda para a rota do dashboard
    this.router.navigate(['/dashboard']);
  }

  // Se clicar no 'X', fecha o modal voltando para o dashboard
  public fechar(): void {
    this.router.navigate(['/dashboard']);
  }
}