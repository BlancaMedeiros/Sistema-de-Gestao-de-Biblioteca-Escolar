import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService} from '../../services/dashboard.service';
import { EmprestimoService } from '../../services/emprestimo.service';
import { firstValueFrom } from 'rxjs';
import { Emprestimo } from '../../models/emprestimo.model';
import { MetricasDashboard } from '../../models/metricas-dashboard.model';

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
  public ultimosEmprestimos: Emprestimo[] = [];
  public carregando: boolean = true;

  constructor(private dashboardService: DashboardService, private emprestimosService: EmprestimoService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    await this.carregarDadosDashboard();
  }

  private async carregarDadosDashboard() {
    this.carregando = true;
    const data = await firstValueFrom(this.dashboardService.getMetricas());
    this.metricas = data.metricas;
    this.ultimosEmprestimos = data.ultimosEmprestimos;
    this.carregando = false;
    this.cdr.detectChanges();
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
