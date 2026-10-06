import { Injectable } from '@angular/core';
import { Usuario } from '../models/usuario.model';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
    private mockUsuarios: Usuario[] = [
        { id: 1, nome: 'Lucas Andrade', telefone: '(11) 98765-4321', email: 'lucas.andrade@escola.com', matricula: 'ALU-202601', tipo: 'Aluno', status: 'Ativo', dataCadastro: '10/02/2026' },
        { id: 2, nome: 'Beatriz Lima', telefone: '(11) 98765-4321', email: 'beatriz.lima@escola.com', matricula: 'ALU-202602', tipo: 'Aluno', status: 'Ativo', dataCadastro: '12/02/2026' },
        { id: 3, nome: 'Gabriel Santos', telefone: '(11) 98765-4321', email: 'gabriel.santos@escola.com', matricula: 'ALU-202603', tipo: 'Aluno', status: 'Ativo', dataCadastro: '15/02/2026' },
        { id: 4, nome: 'Mariana Costa', telefone: '(11) 98765-4321', email: 'mariana.costa@escola.com', matricula: 'PROF-1020', tipo: 'Professor', status: 'Ativo', dataCadastro: '01/01/2026' },
        { id: 5, nome: 'Rafael Oliveira', telefone: '(11) 98765-4321', email: 'rafael.oliveira@escola.com', matricula: 'ALU-202604', tipo: 'Aluno', status: 'Ativo', dataCadastro: '18/02/2026' },
        { id: 6, nome: 'Camila Fernandes', telefone: '(11) 98765-4321', email: 'camila.fernandes@escola.com', matricula: 'ALU-202605', tipo: 'Aluno', status: 'Inativo', dataCadastro: '20/02/2026' },
        { id: 7, nome: 'Thiago Martins', telefone: '(11) 98765-4321', email: 'thiago.martins@escola.com', matricula: 'PROF-1021', tipo: 'Professor', status: 'Ativo', dataCadastro: '05/01/2026' },
        { id: 8, nome: 'Juliana Rocha', telefone: '(11) 98765-4321', email: 'juliana.rocha@escola.com', matricula: 'BIB-0001', tipo: 'Bibliotecário', status: 'Ativo', dataCadastro: '01/12/2025' },
        { id: 9, nome: 'Felipe Barbosa', telefone: '(11) 98765-4321', email: 'felipe.barbosa@escola.com', matricula: 'ALU-202606', tipo: 'Aluno', status: 'Ativo', dataCadastro: '01/03/2026' },
        { id: 10, nome: 'Amanda Souza', telefone: '(11) 98765-4321', email: 'amanda.souza@escola.com', matricula: 'ALU-202607', tipo: 'Aluno', status: 'Ativo', dataCadastro: '05/03/2026' }
    ];

    adicionarUsuario(usuario: Usuario): void {
        this.mockUsuarios.unshift(usuario);
    }

    getUsuarios(): Observable<Usuario[]> {
        return of(this.mockUsuarios);
    }
    
    // 2. Método para salvar as alterações do perfil
    atualizarPerfil(usuarioAtualizado: Usuario & { telefone?: string }): void {
        const index = this.mockUsuarios.findIndex(u => u.id === usuarioAtualizado.id);
        if (index !== -1) {
            this.mockUsuarios[index] = {
            ...this.mockUsuarios[index],
            ...usuarioAtualizado
            };
        }
    }
}