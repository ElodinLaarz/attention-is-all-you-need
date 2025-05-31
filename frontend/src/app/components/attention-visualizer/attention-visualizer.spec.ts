import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttentionVisualizer } from './attention-visualizer';

describe('AttentionVisualizer', () => {
  let component: AttentionVisualizer;
  let fixture: ComponentFixture<AttentionVisualizer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttentionVisualizer],
    }).compileComponents();

    fixture = TestBed.createComponent(AttentionVisualizer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
