import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-cabecalho',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './cabecalho.component.html',
  styleUrl: './cabecalho.component.css'
})
export class CabecalhoComponent implements OnInit {
  public usuarioLogado: string | null = null;
  public menuAberto: boolean = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Carrega o estado de login salvo no navegador
    this.verificarStatusLogin();
  }

  public verificarStatusLogin(): void {
    this.usuarioLogado = localStorage.getItem('usuario_logado');
  }

  // Abre e fecha a caixinha do menu
  public toggleMenu(): void {
    this.menuAberto = !this.menuAberto;
  }

  // Ação ao clicar em Logout
  public logout(): void {
    // 1. Limpa o login do armazenamento
    localStorage.removeItem('usuario_logado');
    this.usuarioLogado = null;
    this.menuAberto = false;

    // 2. Redireciona para abrir o modal de login na hora
    this.router.navigate(['/login']);
  }
}