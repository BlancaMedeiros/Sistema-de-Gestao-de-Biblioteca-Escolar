import { Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
    // Funcionário da sessão atual; o cabeçalho e o guard das rotas leem daqui.
    readonly usuarioLogado = signal<any | null>(null);

    constructor(private http: HttpClient){}

    // O /me já traz cargo, matrícula e os contadores do leitor vinculado (usuarioId),
    // calculados pela API. Consulta sempre, para refletir empréstimos feitos na sessão.
    async getPerfilLogado(): Promise<Observable<any>> {
        await firstValueFrom(this.ObtemUsuarioLogado());
        return of(this.usuarioLogado());
    }


    EfetuarLogin(username: string, password: string){
        return this.http.post(`${environment.apiUrl}/auth/login`,{
            login: username,
            senha: password
        }).pipe(
            tap((response: any)=>{
                if(response && response.data!=null){
                    this.usuarioLogado.set(response.data);
                }
            })
        );
    }

    // Se a sessão já tiver expirado (401), o resultado para a tela é o mesmo: sair.
    EfetuarLogout(): Observable<unknown> {
        return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
            catchError(() => of(null)),
            tap(() => this.usuarioLogado.set(null))
        );
    }

    // Depois de um F5 a memória está vazia: o cookie de sessão é conferido pelo /me.
    VerificarSessao(): Observable<boolean> {
        if(this.usuarioLogado())
            return of(true);

        return this.ObtemUsuarioLogado().pipe(
            map(() => true),
            catchError(() => of(false))
        );
    }

    ObtemUsuarioLogado(){
        return this.http.get(`${environment.apiUrl}/me`).pipe(
            tap((response: any)=>{
                if(response && response.data!=null){
                    this.usuarioLogado.set(response.data);
                }
            })
        );
    }
}
