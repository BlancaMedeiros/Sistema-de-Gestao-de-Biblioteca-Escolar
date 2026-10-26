import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { LoginService } from './login.service';

describe('LoginService', () => {
  let service: LoginService;
  let http: HttpTestingController;

  // id é a conta de funcionário; usuarioId é o leitor vinculado. Números
  // diferentes deixam claro se o serviço confundir um com o outro.
  const perfilDaApi = {
    id: 7,
    nome: 'Funcionária QAT',
    login: 'funcionaria.qat',
    email: null,
    telefone: null,
    usuarioId: 81,
    matricula: 'BIB-0081',
    cargo: 'Funcionário autorizado',
    emprestimosAtivos: 2,
    historicoTotal: 5,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LoginService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function lerPerfil() {
    return service.getPerfilLogado().then((perfil$) => firstValueFrom(perfil$));
  }

  it('devolve o perfil do /me com os contadores da API, sem recalcular pelos empréstimos', async () => {
    const perfil = lerPerfil();
    http.expectOne('/api/v1/me').flush({ data: perfilDaApi });
    await new Promise((resolve) => setTimeout(resolve));

    expect(http.match((req) => req.url.includes('/emprestimos'))).toEqual([]);
    await expect(perfil).resolves.toEqual(perfilDaApi);
  });

  it('depois do login, consulta o /me de novo para trazer contadores atualizados', async () => {
    service.EfetuarLogin('funcionaria.qat', 'Senha@123').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ data: perfilDaApi });

    const perfil = lerPerfil();
    const atualizado = { ...perfilDaApi, emprestimosAtivos: 3, historicoTotal: 6 };
    http.expectOne('/api/v1/me').flush({ data: atualizado });

    await expect(perfil).resolves.toEqual(atualizado);
  });

  function entrar() {
    service.EfetuarLogin('funcionaria.qat', 'Senha@123').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ data: perfilDaApi });
  }

  it('EfetuarLogout encerra a sessão na API e esquece o funcionário', () => {
    entrar();
    expect(service.usuarioLogado()?.nome).toBe('Funcionária QAT');

    service.EfetuarLogout().subscribe();
    const requisicao = http.expectOne('/api/v1/auth/logout');
    expect(requisicao.request.method).toBe('POST');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.usuarioLogado()).toBeNull();
  });

  it('EfetuarLogout esquece o funcionário mesmo se a sessão já tiver expirado', () => {
    entrar();
    let concluiu = false;
    service.EfetuarLogout().subscribe({ complete: () => (concluiu = true) });
    http
      .expectOne('/api/v1/auth/logout')
      .flush({ error: { code: 'NAO_AUTENTICADO' } }, { status: 401, statusText: 'Unauthorized' });

    expect(concluiu).toBe(true);
    expect(service.usuarioLogado()).toBeNull();
  });

  it('VerificarSessao consulta o /me quando não há funcionário em memória, como após o F5', async () => {
    const valida = firstValueFrom(service.VerificarSessao());
    http.expectOne('/api/v1/me').flush({ data: perfilDaApi });

    await expect(valida).resolves.toBe(true);
    expect(service.usuarioLogado()?.nome).toBe('Funcionária QAT');
  });

  it('VerificarSessao responde false quando a API recusa a sessão', async () => {
    const valida = firstValueFrom(service.VerificarSessao());
    http
      .expectOne('/api/v1/me')
      .flush({ error: { code: 'NAO_AUTENTICADO' } }, { status: 401, statusText: 'Unauthorized' });

    await expect(valida).resolves.toBe(false);
  });

  it('VerificarSessao não consulta a API depois do login', async () => {
    entrar();
    // http.verify() no afterEach falha se houver um GET /me pendente.
    await expect(firstValueFrom(service.VerificarSessao())).resolves.toBe(true);
  });
});
