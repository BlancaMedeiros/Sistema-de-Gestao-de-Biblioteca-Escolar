import { Injectable } from '@angular/core';
import { firstValueFrom, map, Observable, of } from 'rxjs';
import { Dashboard, MetricasDashboard } from '../models/metricas-dashboard.model';
import { UsuariosService } from './usuarios.service';
import { AcervoService } from './acervo.service';
import { EmprestimoService } from './emprestimo.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ResponseDTO } from '../models/response-dto.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  constructor(private http: HttpClient) { }

  getMetricas(): Observable<Dashboard> {
    return this.http.get<ResponseDTO<Dashboard>>(`${environment.apiUrl}/dashboard`).pipe(
      map((response)=> response.data)
    )
  }
}