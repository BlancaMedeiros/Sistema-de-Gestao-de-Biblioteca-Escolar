import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Livro } from '../../models/livro.model';
import { AcervoService } from '../../services/acervo.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-acervo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acervo.component.html',
  styleUrl: './acervo.component.css'
})
export class AcervoComponent implements OnInit {
  livros: Livro[] = [];
  livrosFiltrados: Livro[] = [];
  termoBusca: string = '';
  categoriaFiltro: string = '';
  exibirModal: boolean = false;
  modoEdicao: boolean = false;
  livroEdicaoId?: number | null = null;

  livroForm: Partial<Livro> = {
    titulo: '',
    autor: '',
    isbn: '',
    categoria: '',
    anoPublicacao: new Date().getFullYear(),
    quantidadeTotal: 1,
    quantidadeDisponivel: 1,
    status: 'Disponível',
    estante: '',
    prateleira: ''
  };

  constructor(private acervoService: AcervoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.carregarAcervo();
  }

  carregarAcervo(): void {
    this.acervoService.getAcervo().subscribe((dados) => {
      console.log('dados: ',dados)
      this.livros = dados;
      this.aplicarFiltros();
    });
  }

  aplicarFiltros(): void {
    this.livrosFiltrados = this.livros.filter(livro => {
      const atendeBusca = livro.titulo.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
                          livro.autor.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
                          livro.isbn?.toLowerCase().includes(this.termoBusca.toLocaleLowerCase()) ||
                          (livro.estante && livro.estante.toLowerCase().includes(this.termoBusca.toLowerCase())) ||
                          (livro.prateleira && livro.prateleira.toLowerCase().includes(this.termoBusca.toLowerCase()));

      const atendeCategoria = this.categoriaFiltro ? livro.categoria?.toLowerCase() === this.categoriaFiltro.toLowerCase() : true;

      return atendeBusca && atendeCategoria;
    });
    this.cdr.detectChanges()
    console.log('aplica Filtros')
  }

  abrirModalNovo(): void {
    this.modoEdicao = false;
    this.livroEdicaoId = null;
    this.resetarFormulario();
    this.exibirModal = true;
  }

  abrirModalEditar(livro: Livro): void {
    this.modoEdicao = true;
    this.livroEdicaoId = livro.id;
    this.livroForm = { ...livro };
    this.exibirModal = true;
  }

  fecharModal(): void {
    this.exibirModal = false;
    this.resetarFormulario();
    this.cdr.detectChanges();
  }

  async salvarLivro(): Promise<void> {
    if (!this.livroForm.titulo || !this.livroForm.autor) return;

    if (this.modoEdicao && this.livroEdicaoId !== null) {
      const index = this.livros.findIndex(l => l.id === this.livroEdicaoId);
      if (index !== -1) {
        this.livros[index] = {
          ...this.livros[index],
          ...this.livroForm
        } as Livro;
        await firstValueFrom(this.acervoService.atualizarLivro(this.livros[index]));
      }
    } else {
      if(!this.livroForm.isbn){
        alert("ISBN não foi preenchido")
        return;
      }
        
      const novo: Livro = {
        titulo: this.livroForm.titulo!,
        autor: this.livroForm.autor!,
        isbn: this.livroForm.isbn,
        categoria: this.livroForm.categoria || 'Geral',
        anoPublicacao: Number(this.livroForm.anoPublicacao),
        quantidadeTotal: Number(this.livroForm.quantidadeTotal),
        quantidadeDisponivel: Number(this.livroForm.quantidadeTotal),
        status: 'Disponível',
        estante: this.livroForm.estante || 'Não informada',
        prateleira: this.livroForm.prateleira || 'Não informada'
      };
      const resultado = await firstValueFrom(this.acervoService.adicionarLivro(novo))
      if(resultado){
        this.fecharModal();
        return this.carregarAcervo();
      }
      //this.livros.unshift(novo);
      
    }

    this.aplicarFiltros();
    this.fecharModal();
  }

  async excluirLivro(livro: Livro): Promise<void> {
    const confirmacao = confirm(`Tem certeza que deseja excluir o livro "${livro.titulo}"?`);
    if (confirmacao) {
      const resultado = await firstValueFrom(this.acervoService.deletarLivro(livro));
      if(resultado){
        this.carregarAcervo();
      }
    }
  }

  private resetarFormulario(): void {
    this.livroForm = {
      titulo: '',
      autor: '',
      isbn: '',
      categoria: '',
      anoPublicacao: new Date().getFullYear(),
      quantidadeTotal: 1,
      quantidadeDisponivel: 1,
      status: 'Disponível',
      estante: '',
      prateleira: ''
    };
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Disponível': return 'status-disponivel';
      case 'Esgotado': return 'status-esgotado';
      case 'Em Manutenção': return 'status-manutencao';
      default: return '';
    }
  }
}