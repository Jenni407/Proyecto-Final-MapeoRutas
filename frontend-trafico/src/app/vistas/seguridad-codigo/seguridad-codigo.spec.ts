import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeguridadCodigo } from './seguridad-codigo';

describe('SeguridadCodigo', () => {
  let component: SeguridadCodigo;
  let fixture: ComponentFixture<SeguridadCodigo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeguridadCodigo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeguridadCodigo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
