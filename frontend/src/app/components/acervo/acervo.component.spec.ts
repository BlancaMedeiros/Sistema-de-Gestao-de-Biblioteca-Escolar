import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcervoComponent } from './acervo.component';

describe('AcervoComponent', () => {
  let component: AcervoComponent;
  let fixture: ComponentFixture<AcervoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcervoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AcervoComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
