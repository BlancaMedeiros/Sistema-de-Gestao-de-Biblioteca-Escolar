import { Injectable } from '@angular/core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { Usuario } from '../models/usuario.model';
import { UsuariosService } from './usuarios.service';
import { EmprestimoService } from './emprestimo.service';

@Injectable({
  providedIn: 'root'
})
export class loginService {
    
    constructor(private usuariosService: UsuariosService, private emprestimosService: EmprestimoService){}
    // 1. Método para buscar o usuário logado (ex: pegando o ID 8 ou ID 1)
    async getPerfilLogado(usuarioId: number = 8): Promise<any> {
        const usuarios = await firstValueFrom(this.usuariosService.getUsuarios());
        const usuario = usuarios.find(u => u.id === usuarioId);
  
        if (!usuario) {
            return of(null);
        }
        const historicoUsuario = await firstValueFrom(this.emprestimosService.getEmprestimosDoUsuario(usuarioId))
        // Calcula estatísticas reais com base nos mocks do próprio serviço
        const emprestimosAtivos = historicoUsuario.filter(
            e => e.status === 'Em Andamento'
        ).length;

        const historicoTotal = historicoUsuario.length;

        return of({
            ...usuario,
            emprestimosAtivos,
            historicoTotal
        });
    }
}


