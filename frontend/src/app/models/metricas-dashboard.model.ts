import { Emprestimo } from "./emprestimo.model";

export interface Dashboard {
  metricas: MetricasDashboard;
  ultimosEmprestimos: Emprestimo[];
  devolucoesHoje: Emprestimo[];
}
export interface MetricasDashboard {
  totalAcervo: number;
  emprestimosAtivos: number;
  devolucoesPendentes: number;
  usuariosAtivos: number;
  devolucoesHoje: number;
}