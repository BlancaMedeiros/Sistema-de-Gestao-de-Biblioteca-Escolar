import { Injectable } from '@angular/core';
import { firstValueFrom, Observable, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
    private UsuarioLogado: any;

    constructor(private http: HttpClient){}

    // O /me já traz cargo, matrícula e os contadores do leitor vinculado (usuarioId),
    // calculados pela API. Consulta sempre, para refletir empréstimos feitos na sessão.
    async getPerfilLogado(): Promise<Observable<any>> {
        await firstValueFrom(this.ObtemUsuarioLogado());
        return of(this.UsuarioLogado);
    }


    EfetuarLogin(username: string, password: string){
        return this.http.post(`${environment.apiUrl}/auth/login`,{
            login: username,
            senha: password
        }).pipe(
            tap((response: any)=>{
                if(response && response.data!=null){
                    this.UsuarioLogado = response.data;
                }
            })
        );
    }
    ObtemUsuarioLogado(){
        return this.http.get(`${environment.apiUrl}/me`).pipe(
            tap((response: any)=>{
                if(response && response.data!=null){
                    this.UsuarioLogado = response.data;
                }
            })
        );
    }
}


