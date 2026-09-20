import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginaLoginComponent } from './pagina-login.component';

describe('PaginaLoginComponent', () => {
  let component: PaginaLoginComponent;
  let fixture: ComponentFixture<PaginaLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginaLoginComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginaLoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
