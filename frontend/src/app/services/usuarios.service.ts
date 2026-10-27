import { Injectable } from '@angular/core';
import { Usuario } from '../models/usuario.model';
import { map, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ResponseDTO } from '../models/response-dto.model';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
    constructor(private http: HttpClient){}

    adicionarUsuario(usuario: Usuario): Observable<Usuario> {
        return this.http.post<ResponseDTO<Usuario>>(`${environment.apiUrl}/usuarios`,usuario).pipe(
            map((data)=> data.data)
        );
    }

    getUsuarios(page: number=1, pageSize: number=20): Observable<ResponseDTO<Usuario[]>> {
        return this.http.get<ResponseDTO<Usuario[]>>(`${environment.apiUrl}/usuarios?page=${page}&pageSize=${pageSize}`)
    }
    
    // 2. Método para salvar as alterações do perfil
    atualizarPerfil(usuarioAtualizado: Partial<Usuario>): Observable<Usuario> {
        return this.http.patch<ResponseDTO<Usuario>>(`${environment.apiUrl}/me`,usuarioAtualizado)
            .pipe(
                map((retorno)=>{
                    return retorno.data;
                })
            )
    }

    // A API responde 204 sem corpo e encerra as outras sessões da conta.
    alterarSenha(senhaAtual: string, novaSenha: string): Observable<void> {
        return this.http.put<void>(`${environment.apiUrl}/me/senha`, { senhaAtual, novaSenha });
    }
}