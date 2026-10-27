import { Injectable } from "@angular/core";
import { Livro } from "../models/livro.model";
import { map, Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { ResponseDTO } from "../models/response-dto.model";

@Injectable({
  providedIn: 'root'
})
export class AcervoService {
    constructor(private http: HttpClient){}


    getAcervo(): Observable<Livro[]> {
        return this.http.get<ResponseDTO<Livro[]>>(`${environment.apiUrl}/livros`)
            .pipe(
                map((retorno)=>{
                    return retorno.data
                }) 
            )
    }
    
    adicionarLivro(novoLivro: Livro): Observable<Livro> {
        return this.http.post<ResponseDTO<Livro>>(`${environment.apiUrl}/livros`, novoLivro)
            .pipe(
                map((retorno)=>{
                    return retorno.data;
                })
            )
    }
    // A API responde 204 sem corpo: não há data para ler.
    deletarLivro(livro: Livro): Observable<void> {
        return this.http.delete<void>(`${environment.apiUrl}/livros/${livro.id}`);
    }

    
    atualizarLivro(livroAtualizado: Livro): Observable<Livro> {
        return this.http.patch<ResponseDTO<Livro>>(`${environment.apiUrl}/livros/${livroAtualizado.id}`,livroAtualizado)
            .pipe(
                map((retorno)=>{
                    return retorno.data;
                })
            )
    }
}