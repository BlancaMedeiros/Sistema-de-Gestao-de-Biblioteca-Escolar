import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { PaginaLoginComponent } from './pagina-login.component';

describe('PaginaLoginComponent', () => {
  let component: PaginaLoginComponent;
  let fixture: ComponentFixture<PaginaLoginComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginaLoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginaLoginComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function enviarLogin(username: string, password: string) {
    component.usuario = { username, password };
    component.onLogin();
    return http.expectOne('/api/v1/auth/login');
  }

  // A aplicação é zoneless: a tela só é atualizada quando o Angular é notificado
  // (signal, evento do template), então o teste aguarda a renderização agendada.
  async function mensagemNaTela(): Promise<string | null> {
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  }

  it('envia login e senha para a API e vai para o dashboard quando ela aceita', async () => {
    const requisicao = enviarLogin('bibliotecaria.teste', 'Teste@123');

    expect(requisicao.request.method).toBe('POST');
    expect(requisicao.request.body).toEqual({ login: 'bibliotecaria.teste', senha: 'Teste@123' });

    requisicao.flush({ data: { id: 1, nome: 'Bibliotecária Teste', login: 'bibliotecaria.teste' } });

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(await mensagemNaTela()).toBeNull();
  });

  it('mostra a mensagem da API e permanece no login quando a senha está errada', async () => {
    enviarLogin('bibliotecaria.teste', 'errada').flush(
      { error: { code: 'CREDENCIAIS_INVALIDAS', message: 'Login ou senha incorretos.' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(await mensagemNaTela()).toBe('Login ou senha incorretos.');
  });

  it('avisa que o servidor não respondeu quando a API está fora do ar', async () => {
    enviarLogin('bibliotecaria.teste', 'Teste@123').error(new ProgressEvent('error'), { status: 0 });

    expect(navigate).not.toHaveBeenCalled();
    expect(await mensagemNaTela()).toBe('Não foi possível conectar ao servidor. Tente novamente.');
  });
});
