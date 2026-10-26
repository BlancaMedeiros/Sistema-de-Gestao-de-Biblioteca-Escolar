import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AcervoComponent } from './acervo.component';
import { Livro } from '../../models/livro.model';

describe('AcervoComponent', () => {
  let component: AcervoComponent;
  let fixture: ComponentFixture<AcervoComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcervoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AcervoComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recarrega o acervo depois que a API exclui o livro com 204 sem corpo', async () => {
    const livro = {
      id: 1,
      titulo: 'Dom Casmurro',
      autor: 'Machado de Assis',
      isbn: '9788535902778',
      quantidadeTotal: 2,
      quantidadeDisponivel: 2,
      status: 'Disponível',
    } as Livro;
    http.expectOne('/api/v1/livros').flush({ data: [livro] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const exclusao = component.excluirLivro(livro);
    const requisicao = http.expectOne('/api/v1/livros/1');
    expect(requisicao.request.method).toBe('DELETE');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await exclusao;

    http.expectOne('/api/v1/livros').flush({ data: [] });
    expect(component.livros).toEqual([]);
  });
});
