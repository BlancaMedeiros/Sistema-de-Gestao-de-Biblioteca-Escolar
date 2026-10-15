import { Injectable } from '@angular/core';
import { firstValueFrom, map, Observable, of, tap } from 'rxjs';
import { EmprestimoService } from './emprestimo.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
    private UsuarioLogado: any;

    constructor(private http: HttpClient, private emprestimosService: EmprestimoService){}

    // 1. Método para buscar o usuário logado (ex: pegando o ID 8 ou ID 1)
    async getPerfilLogado(): Promise<Observable<any>> {
        if(!this.UsuarioLogado) return of();

        const historicoUsuario = await firstValueFrom(this.emprestimosService.getEmprestimosDoUsuario(this.UsuarioLogado.id))
        // Calcula estatísticas reais com base nos mocks do próprio serviço
        const emprestimosAtivos = historicoUsuario.filter(
            e => e.status === 'Em Andamento'
        ).length;

        const historicoTotal = historicoUsuario.length;

        return of({
            ...this.UsuarioLogado,
            emprestimosAtivos,
            historicoTotal
        });
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
}


