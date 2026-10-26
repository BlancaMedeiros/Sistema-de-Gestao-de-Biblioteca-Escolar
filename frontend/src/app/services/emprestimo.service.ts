import { Injectable } from "@angular/core";
import { Emprestimo } from "../models/emprestimo.model";
import { catchError, map, Observable, of, throwError } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { ResponseDTO } from "../models/response-dto.model";

@Injectable({
  providedIn: 'root'
})
export class EmprestimoService {
    private mockEmprestimos: Emprestimo[] = [
      { id: 1, livroId: 1, livroTitulo: 'Dom Casmurro', usuarioId: 1, usuarioNome: 'Lucas Andrade', dataEmprestimo: '01/09/2026', devolucaoPrevista: '15/09/2026', status: 'Em Andamento' },
      { id: 2, livroId: 2, livroTitulo: 'O Cortiço', usuarioId: 2, usuarioNome: 'Beatriz Lima', dataEmprestimo: '25/08/2026', devolucaoPrevista: '08/09/2026', status: 'Em Andamento' },
      { id: 3, livroId: 3, livroTitulo: 'Memórias Póstumas de Brás Cubas', usuarioId: 3, usuarioNome: 'Gabriel Santos', dataEmprestimo: '10/08/2026', devolucaoPrevista: '24/08/2026', status: 'Atrasado' },
      { id: 4, livroId: 4, livroTitulo: 'A Hora da Estrela', usuarioId: 4, usuarioNome: 'Mariana Costa', dataEmprestimo: '15/08/2026', devolucaoPrevista: '29/08/2026', devolucaoReal: '28/08/2026', status: 'Devolvido' },
      { id: 5, livroId: 5, livroTitulo: 'Vidas Secas', usuarioId: 5, usuarioNome: 'Rafael Oliveira', dataEmprestimo: '02/09/2026', devolucaoPrevista: '16/09/2026', status: 'Em Andamento' },
      { id: 6, livroId: 6, livroTitulo: 'Capitães da Areia', usuarioId: 6, usuarioNome: 'Camila Fernandes', dataEmprestimo: '05/08/2026', devolucaoPrevista: '19/08/2026', status: 'Atrasado' },
      { id: 7, livroId: 7, livroTitulo: 'Grande Sertão: Veredas', usuarioId: 7, usuarioNome: 'Thiago Martins', dataEmprestimo: '20/08/2026', devolucaoPrevista: '03/09/2026', status: 'Em Andamento' },
      { id: 8, livroId: 8, livroTitulo: 'Iracema', usuarioId: 8, usuarioNome: 'Juliana Rocha', dataEmprestimo: '12/08/2026', devolucaoPrevista: '26/08/2026', devolucaoReal: '25/08/2026', status: 'Devolvido' },
      { id: 9, livroId: 9, livroTitulo: 'O Alquimista', usuarioId: 9, usuarioNome: 'Felipe Barbosa', dataEmprestimo: '03/09/2026', devolucaoPrevista: '17/09/2026', status: 'Em Andamento' },
      { id: 10,livroId: 10, livroTitulo: 'Triste Fim de Policarpo Quaresma', usuarioId: 10, usuarioNome: 'Amanda Souza', dataEmprestimo: '18/08/2026', devolucaoPrevista: '01/09/2026', status: 'Atrasado' }
    ];

    constructor(private http:HttpClient){}
  
    getEmprestimos(usuarioId?: number, page: number = 1, pageSize: number = 100): Observable<Emprestimo[]> {
      return this.http.get<ResponseDTO<Emprestimo[]>>(`${environment.apiUrl}/emprestimos?page=${page}&pageSize=${pageSize}${ usuarioId?'&usuarioId='+usuarioId:'' }`).pipe(
        map((response)=> response.data)
      )
    }
    
    adicionarEmprestismo(emprestimoNovo: { livroId: number; usuarioId: number }, Idempotency: string): Observable<Emprestimo> {
      return this.http.post<ResponseDTO<Emprestimo>>(`${environment.apiUrl}/emprestimos`, emprestimoNovo,
        {
          headers: { "Idempotency-Key": Idempotency }
        }
      ).pipe(
        map((response)=> response.data),
        catchError((error) => {
          console.error('Erro ao cadastrar empréstimo:', error);
          alert(error?.error?.error?.message)
          return throwError(() => error);
        })
      )
    }
    
    devolver(id: number, idempotencyKey: string): Observable<unknown> {
      return this.http.post<ResponseDTO<Emprestimo>>(`${environment.apiUrl}/emprestimos/${id}/devolucao`, {},
        {
          headers: { "Idempotency-Key": idempotencyKey }
        }
      ).pipe(
        map((response)=> response.data),
        catchError((error) => {
          console.error('Erro ao cadastrar empréstimo:', error);
          alert(error?.error?.error?.message)
          return throwError(() => error);
        })
      )
    }
    
    renovar(id: number, idempotencyKey: string): Observable<unknown> {
      return this.http.post<ResponseDTO<Emprestimo>>(`${environment.apiUrl}/emprestimos/${id}/renovacoes`, {},
        {
          headers: { "Idempotency-Key": idempotencyKey }
        }
      ).pipe(
        map((response)=> response.data),
        catchError((error) => {
          console.error('Erro ao cadastrar empréstimo:', error);
          alert(error?.error?.error?.message)
          return throwError(() => error);
        })
      )
    }


    getEmprestimosDoUsuario(usuarioId: number){
      return of(this.mockEmprestimos.filter(emprestimo=> emprestimo.usuarioId == usuarioId));
    }
}