import { Injectable } from "@angular/core";
import { Livro } from "../models/livro.model";
import { Observable, of } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AcervoService {
    private mockAcervo: Livro[] = [
        { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', isbn: '9788535902778', categoria: 'Literatura Brasileira', anoPublicacao: 1899, quantidadeTotal: 5, quantidadeDisponivel: 3, status: 'Disponível', estante: 'Estante 01', prateleira: 'Prateleira A' },
        { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', isbn: '9788508041534', categoria: 'Naturalismo', anoPublicacao: 1890, quantidadeTotal: 4, quantidadeDisponivel: 1, status: 'Disponível', estante: 'Estante 01', prateleira: 'Prateleira B' },
        { id: 3, titulo: 'Memórias Póstumas de Brás Cubas', autor: 'Machado de Assis', isbn: '9788520932223', categoria: 'Literatura Brasileira', anoPublicacao: 1881, quantidadeTotal: 3, quantidadeDisponivel: 0, status: 'Esgotado', estante: 'Estante 01', prateleira: 'Prateleira A' },
        { id: 4, titulo: 'A Hora da Estrela', autor: 'Clarice Lispector', isbn: '9788535905090', categoria: 'Romance', anoPublicacao: 1977, quantidadeTotal: 6, quantidadeDisponivel: 4, status: 'Disponível', estante: 'Estante 02', prateleira: 'Prateleira C' },
        { id: 5, titulo: 'Vidas Secas', autor: 'Graciliano Ramos', isbn: '9788501008788', categoria: 'Regionalismo', anoPublicacao: 1938, quantidadeTotal: 5, quantidadeDisponivel: 2, status: 'Disponível', estante: 'Estante 02', prateleira: 'Prateleira A' },
        { id: 6, titulo: 'Capitães da Areia', autor: 'Jorge Amado', isbn: '9788535914061', categoria: 'Romance', anoPublicacao: 1937, quantidadeTotal: 4, quantidadeDisponivel: 0, status: 'Esgotado', estante: 'Estante 02', prateleira: 'Prateleira B' },
        { id: 7, titulo: 'Grande Sertão: Veredas', autor: 'João Guimarães Rosa', isbn: '9788520938348', categoria: 'Literatura Brasileira', anoPublicacao: 1956, quantidadeTotal: 2, quantidadeDisponivel: 1, status: 'Disponível', estante: 'Estante 03', prateleira: 'Prateleira A' },
        { id: 8, titulo: 'Iracema', autor: 'José de Alencar', isbn: '9788508040773', categoria: 'Romanticismo', anoPublicacao: 1865, quantidadeTotal: 3, quantidadeDisponivel: 3, status: 'Disponível', estante: 'Estante 03', prateleira: 'Prateleira B' },
        { id: 9, titulo: 'O Alquimista', autor: 'Paulo Coelho', isbn: '9788575427583', categoria: 'Ficção', anoPublicacao: 1988, quantidadeTotal: 4, quantidadeDisponivel: 0, status: 'Em Manutenção', estante: 'Estante 04', prateleira: 'Prateleira A' },
        { id: 10, titulo: 'Triste Fim de Policarpo Quaresma', autor: 'Lima Barreto', isbn: '9788520931561', categoria: 'Pré-Modernismo', anoPublicacao: 1915, quantidadeTotal: 3, quantidadeDisponivel: 2, status: 'Disponível', estante: 'Estante 04', prateleira: 'Prateleira B' }
    ];

    getAcervo(): Observable<Livro[]> {
        return of(this.mockAcervo);
    }
    
    adicionarLivro(novoLivro: Livro): void {
        this.mockAcervo.unshift(novoLivro);
    }

    
    atualizarLivro(livroAtualizado: Livro): void {
        const index = this.mockAcervo.findIndex(l => l.id === livroAtualizado.id);
        if (index !== -1) {
        this.mockAcervo[index] = livroAtualizado;
        }
    }

    decrementarEstoque(livroId: number): void {
        const livro = this.mockAcervo.find(l => l.id === livroId);
        if (livro && livro.quantidadeDisponivel > 0) {
            livro.quantidadeDisponivel--;
            if (livro.quantidadeDisponivel === 0) {
                livro.status = 'Esgotado';
            }
        }
    }

    incrementarEstoque(livroId: number): void {
        const livro = this.mockAcervo.find(l => l.id === livroId);
        if (livro && livro.quantidadeDisponivel < livro.quantidadeTotal) {
            livro.quantidadeDisponivel++;
            if (livro.status === 'Esgotado' && livro.quantidadeDisponivel > 0) {
                livro.status = 'Disponível';
            }
        }
    }
}