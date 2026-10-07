import { Injectable } from '@angular/core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { MetricasDashboard } from '../models/metricas-dashboard.model';
import { UsuariosService } from './usuarios.service';
import { AcervoService } from './acervo.service';
import { EmprestimoService } from './emprestimo.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  constructor(private usuariosService: UsuariosService, private acervoService: AcervoService, private emprestimoService: EmprestimoService) { }

  async getMetricas(): Promise<Observable<MetricasDashboard>> {
    const usuarios = await firstValueFrom(this.usuariosService.getUsuarios());
    const acervo = await firstValueFrom(this.acervoService.getAcervo());
    const emprestimos = await firstValueFrom(this.emprestimoService.getEmprestimos())

    const totalAcervo = acervo.reduce((acc, livro) => acc + livro.quantidadeTotal, 0);
    const emprestimosAtivos = emprestimos.filter(e => e.status === 'Em Andamento').length;
    const devolucoesPendentes = emprestimos.filter(e => e.status === 'Atrasado').length;
    const usuariosAtivos = usuarios.filter(u => u.status === 'Ativo').length;
    return of({
      totalAcervo,
      emprestimosAtivos,
      devolucoesPendentes,
      usuariosAtivos
    });
  }
}