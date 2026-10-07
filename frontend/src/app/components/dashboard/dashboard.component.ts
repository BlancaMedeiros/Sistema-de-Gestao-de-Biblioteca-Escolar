import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService} from '../../services/dashboard.service';
import { MetricasDashboard } from '../../models/metricas-dashboard.model';
import { EmprestimoRecente } from '../../models/emprestimo-recente.model';
import { EmprestimoService } from '../../services/emprestimo.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {

  // Variáveis para armazenar os dados vindos do serviço
  public metricas!: MetricasDashboard;
  public ultimosEmprestimos: EmprestimoRecente[] = [];
  public carregando: boolean = true;

  constructor(private dashboardService: DashboardService, private emprestimosService: EmprestimoService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    await this.carregarDadosDashboard();
  }

  private async carregarDadosDashboard() {
    // Busca as métricas
    (await this.dashboardService.getMetricas()).subscribe({
      next: (dados) => {
        this.metricas = dados;
      },
      error: (err) => console.error('Erro ao carregar métricas:', err)
    });

    // Busca a lista de empréstimos
    this.emprestimosService.getUltimosEmprestimos().subscribe({
      next: (dados) => {
        this.ultimosEmprestimos = dados;
        console.log('ultimos emprestimos: ', this.ultimosEmprestimos)
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao carregar empréstimos:', err)
    });
  }

  // Função auxiliar para definir a classe CSS da tag de status
  public getStatusClass(status: string): string {
    switch (status) {
      case 'Em Andamento':
        return 'status-ativo';
      case 'Atrasado':
        return 'status-atrasado';
      case 'Devolvido':
        return 'status-concluido';
      default:
        return '';
    }
  }
}
