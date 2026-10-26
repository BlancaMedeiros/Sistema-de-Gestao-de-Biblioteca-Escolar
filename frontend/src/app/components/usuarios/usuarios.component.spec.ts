import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UsuariosComponent } from './usuarios.component';

describe('UsuariosComponent', () => {
  let component: UsuariosComponent;
  let fixture: ComponentFixture<UsuariosComponent>;
  let http: HttpTestingController;
  let tela: HTMLElement;

  const leitor = {
    id: 81,
    nome: 'Leitor QAT',
    telefone: null,
    email: 'leitor.qat@example.test',
    matricula: 'QAT-081',
    tipo: 'Aluno',
    status: 'Ativo',
    dataCadastro: '2026-10-26',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosComponent);
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

  async function carregarLista() {
    http.expectOne((req) => req.url.startsWith('/api/v1/usuarios')).flush({ data: [leitor] });
    await renderizar();
  }

  function digitar(seletor: string, valor: string) {
    const campo = tela.querySelector<HTMLInputElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  async function cadastrar(telefone?: string) {
    await carregarLista();
    tela.querySelector<HTMLButtonElement>('button.btn-novo')!.click();
    await renderizar();
    digitar('input[placeholder="Ex: João da Silva"]', 'Leitora Nova');
    digitar('input[placeholder="exemplo@escola.com"]', 'leitora.nova@example.test');
    digitar('input[placeholder="ALU-202600"]', 'QAT-082');
    if (telefone !== undefined) digitar('input[placeholder="(11) 90000-0000"]', telefone);
    component.salvarUsuario();
    return http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/usuarios');
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('abre o histórico no primeiro clique, quando a API responde', async () => {
    await carregarLista();
    tela.querySelector<HTMLButtonElement>('button[title="Ver Histórico"]')!.click();
    // Como no navegador: a tela reage ao clique antes de a resposta chegar.
    await renderizar();
    http.expectOne((req) => req.url.startsWith('/api/v1/emprestimos')).flush({ data: [] });
    await renderizar();

    expect(tela.textContent).toContain('Histórico de Leitor QAT');
  });

  it('cadastra o leitor com o telefone digitado', async () => {
    const requisicao = await cadastrar('(11) 91234-5678');

    expect(requisicao.request.body.telefone).toBe('(11) 91234-5678');
  });

  it('não inventa telefone quando o campo fica em branco', async () => {
    const requisicao = await cadastrar();

    expect(requisicao.request.body.telefone).toBeFalsy();
  });
});
