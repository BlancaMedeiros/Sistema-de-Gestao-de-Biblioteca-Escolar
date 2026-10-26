import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PerfilComponent } from './perfil.component';

describe('PerfilComponent', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let http: HttpTestingController;
  let tela: HTMLElement;

  const perfilSemVinculo = {
    id: 7,
    nome: 'Funcionária QAT',
    login: 'funcionaria.qat',
    email: null,
    telefone: null,
    usuarioId: null,
    matricula: null,
    cargo: 'Funcionário autorizado',
    emprestimosAtivos: 0,
    historicoTotal: 0,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    tela = fixture.nativeElement;
    await fixture.whenStable();
  });

  // A aplicação é zoneless: só o que notifica o Angular redesenha a tela.
  async function renderizar() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function carregarPerfil() {
    http.expectOne('/api/v1/me').flush({ data: perfilSemVinculo });
    await renderizar();
  }

  function digitar(seletor: string, valor: string) {
    const campo = tela.querySelector<HTMLInputElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  const pedidoDePerfil = () => http.expectOne((req) => req.method === 'PATCH' && req.url === '/api/v1/me');
  const pedidoDeSenha = () => http.expectOne((req) => req.method === 'PUT' && req.url === '/api/v1/me/senha');
  const alerta = () => tela.querySelector('[role=alert]')?.textContent?.trim();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mostra "—" na matrícula quando a conta não tem leitor vinculado', async () => {
    await carregarPerfil();

    expect(tela.querySelector('.badge-cargo')?.textContent?.trim()).toBe('Funcionário autorizado');
    expect(tela.querySelector('.matricula')?.textContent?.trim()).toBe('Matrícula: —');
    const campoMatricula = tela.querySelectorAll<HTMLInputElement>('input.input-disabled')[1];
    expect(campoMatricula.value).toBe('—');
  });

  it('salva no PATCH /me só os campos editáveis', async () => {
    await carregarPerfil();
    digitar('input[name=telefone]', '(11) 91234-5678');

    component.salvarPerfil();

    expect(pedidoDePerfil().request.body).toEqual({ email: null, telefone: '(11) 91234-5678' });
  });

  it('troca a senha pelo PUT /me/senha, com a senha atual', async () => {
    await carregarPerfil();
    digitar('input[name=senhaAtual]', 'SenhaAtual#1');
    digitar('input[name=novaSenha]', 'SenhaNova#12');

    const salvando = component.salvarPerfil();
    pedidoDePerfil().flush({ data: perfilSemVinculo });
    await renderizar();
    const senha = pedidoDeSenha();
    expect(senha.request.body).toEqual({ senhaAtual: 'SenhaAtual#1', novaSenha: 'SenhaNova#12' });
    senha.flush(null, { status: 204, statusText: 'No Content' });
    await salvando;
    await renderizar();

    expect(tela.querySelector('.alerta-sucesso')?.textContent).toContain('sucesso');
    expect(tela.querySelector<HTMLInputElement>('input[name=novaSenha]')!.value).toBe('');
  });

  it('mostra a mensagem da API quando a senha atual está errada', async () => {
    await carregarPerfil();
    digitar('input[name=senhaAtual]', 'Errada#123');
    digitar('input[name=novaSenha]', 'SenhaNova#12');

    const salvando = component.salvarPerfil();
    pedidoDePerfil().flush({ data: perfilSemVinculo });
    await renderizar();
    pedidoDeSenha().flush(
      { error: { code: 'SENHA_ATUAL_INVALIDA', message: 'Senha atual incorreta.' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    await salvando;
    await renderizar();

    expect(alerta()).toBe('Senha atual incorreta.');
    expect(tela.querySelector('.alerta-sucesso')).toBeNull();
  });

  it('pede a senha atual antes de tentar trocar a senha', async () => {
    await carregarPerfil();
    digitar('input[name=novaSenha]', 'SenhaNova#12');

    await component.salvarPerfil();
    await renderizar();

    http.expectNone((req) => req.url.startsWith('/api/v1/me') && req.method !== 'GET');
    expect(alerta()).toBe('Informe a senha atual para trocar a senha.');
  });
});
