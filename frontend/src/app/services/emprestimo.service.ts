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
}