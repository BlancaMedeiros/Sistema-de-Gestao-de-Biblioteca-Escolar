import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginService } from '../../services/login.service';

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

  // Signal porque a aplicação é zoneless: a resposta HTTP chega fora de um
  // evento do template e, sem signal, a mensagem não apareceria na tela.
  public mensagemErro = signal<string | null>(null);

  private router = inject(Router);
  constructor(private loginService: LoginService){}

  public onLogin(): void {
    // 1. Confere se os campos foram preenchidos
    if (!this.usuario.username || !this.usuario.password) {
      alert('Por favor, preencha o usuário e a senha.');
      return;
    }

    // 2. Autentica na API; o backend devolve o cookie de sessão
    this.loginService.EfetuarLogin(this.usuario.username, this.usuario.password).subscribe({
      next: () => {
        alert('Login realizado com sucesso!');

        // Guardamos uma confirmação temporária no navegador
        localStorage.setItem('usuario_logado', 'true');

        // Manda para a rota do dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (erro: HttpErrorResponse) => {
        // A API responde { error: { message } }; sem corpo, o servidor não respondeu
        this.mensagemErro.set(
          erro.error?.error?.message ?? 'Não foi possível conectar ao servidor. Tente novamente.',
        );
      },
    });
  }

  // Se clicar no 'X', fecha o modal voltando para o dashboard
  public fechar(): void {
    this.router.navigate(['/dashboard']);
  }
}