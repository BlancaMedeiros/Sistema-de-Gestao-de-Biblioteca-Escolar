import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';

import { autenticacaoGuard } from './autenticacao.guard';
import { routes } from '../app.routes';

describe('autenticacaoGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function executar() {
    const resultado = TestBed.runInInjectionContext(() =>
      autenticacaoGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(isObservable(resultado) ? resultado : of(resultado));
  }

  it('libera a tela quando o /me confirma a sessão', async () => {
    const resultado = executar();
    http.expectOne('/api/v1/me').flush({ data: { id: 7, nome: 'Funcionária QAT' } });

    await expect(resultado).resolves.toBe(true);
  });

  it('manda para o login quando a API recusa a sessão', async () => {
    const resultado = executar();
    http
      .expectOne('/api/v1/me')
      .flush({ error: { code: 'NAO_AUTENTICADO' } }, { status: 401, statusText: 'Unauthorized' });

    const destino = await resultado;
    expect(destino).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/login');
  });

  it('protege todas as telas internas, mas não o login', () => {
    const protegidas = routes
      .filter((rota) => rota.canActivate?.includes(autenticacaoGuard))
      .map((rota) => rota.path)
      .sort();

    expect(protegidas).toEqual(['acervo', 'dashboard', 'emprestimo', 'perfil', 'usuario']);
  });
});
