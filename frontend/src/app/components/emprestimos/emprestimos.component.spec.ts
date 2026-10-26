import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EmprestimosComponent } from './emprestimos.component';

describe('EmprestimosComponent', () => {
  let component: EmprestimosComponent;
  let fixture: ComponentFixture<EmprestimosComponent>;
  let http: HttpTestingController;
  let tela: HTMLElement;

  const livro = {
    id: 5,
    titulo: 'Livro QAT',
    autor: 'Autora QAT',
    isbn: null,
    quantidadeTotal: 2,
    quantidadeDisponivel: 2,
    status: 'Disponível',
    estante: 'E1',
    prateleira: 'P1',
  };
  const leitor = { id: 81, nome: 'Leitor QAT', matricula: 'QAT-081', tipo: 'Aluno', status: 'Ativo' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmprestimosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EmprestimosComponent);
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

  const pedidoDeLeitores = () => http.expectOne((req) => req.url.startsWith('/api/v1/usuarios'));

  // Na ordem em que costumam chegar: empréstimos, livros e, por último, leitores.
  async function responderCarga() {
    http.expectOne((req) => req.url.startsWith('/api/v1/emprestimos')).flush({ data: [] });
    http.expectOne((req) => req.url.startsWith('/api/v1/livros')).flush({ data: [livro] });
    pedidoDeLeitores().flush({ data: [leitor] });
    await renderizar();
  }

  async function abrirModal() {
    tela.querySelector<HTMLButtonElement>('button.btn-novo-emprestimo')!.click();
    await renderizar();
  }

  const opcoes = (nome: string) =>
    Array.from(tela.querySelectorAll(`select[name=${nome}] option`)).map((o) => o.textContent!.trim());

  function escolher(nome: string, valor: string) {
    const select = tela.querySelector<HTMLSelectElement>(`select[name=${nome}]`)!;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mostra leitores e livros no modal mesmo se ele abrir antes de as respostas chegarem', async () => {
    await abrirModal();
    await responderCarga();

    expect(opcoes('usuarioId')).toContain('Leitor QAT (QAT-081)');
    expect(opcoes('livroId')).toContain('Livro QAT - Disponíveis: 2');
  });

  it('carrega até 100 leitores para o seletor, não só a primeira página de 20', () => {
    expect(pedidoDeLeitores().request.url).toContain('pageSize=100');
  });

  it('registra o empréstimo enviando só leitor e livro; as datas ficam a cargo da API', async () => {
    await responderCarga();
    await abrirModal();
    expect(tela.querySelector('input[type=date]')).toBeNull();

    escolher('usuarioId', '81');
    escolher('livroId', '5');
    await renderizar();
    tela.querySelector<HTMLButtonElement>('button.btn-salvar')!.click();

    const requisicao = http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/emprestimos');
    expect(requisicao.request.body).toEqual({ livroId: 5, usuarioId: 81 });
    expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
  });
});
