import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { CabecalhoComponent } from './cabecalho.component';
import { LoginService } from '../../services/login.service';

describe('CabecalhoComponent', () => {
  let component: CabecalhoComponent;
  let fixture: ComponentFixture<CabecalhoComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabecalhoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CabecalhoComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const nomeNaTela = () => fixture.nativeElement.querySelector('.usuario-nome')?.textContent?.trim();

  async function entrar() {
    TestBed.inject(LoginService).EfetuarLogin('funcionaria.qat', 'Senha@123').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ data: { id: 7, nome: 'Funcionária QAT' } });
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mostra o nome do funcionário depois do login', async () => {
    expect(nomeNaTela()).toBe('Login');
    await entrar();

    expect(nomeNaTela()).toBe('Funcionária QAT');
  });

  it('logout encerra a sessão na API e volta ao login', async () => {
    await entrar();
    fixture.nativeElement.querySelector('.perfil-container').click();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.logout-btn').click();

    http.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(nomeNaTela()).toBe('Login');
  });
});
