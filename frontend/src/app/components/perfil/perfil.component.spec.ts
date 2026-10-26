import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PerfilComponent } from './perfil.component';

describe('PerfilComponent', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mostra "—" na matrícula quando a conta não tem leitor vinculado', async () => {
    http.expectOne('/api/v1/me').flush({
      data: {
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
      },
    });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    const tela: HTMLElement = fixture.nativeElement;
    expect(tela.querySelector('.badge-cargo')?.textContent?.trim()).toBe('Funcionário autorizado');
    expect(tela.querySelector('.matricula')?.textContent?.trim()).toBe('Matrícula: —');
    const campoMatricula = tela.querySelectorAll<HTMLInputElement>('input.input-disabled')[1];
    expect(campoMatricula.value).toBe('—');
  });
});
