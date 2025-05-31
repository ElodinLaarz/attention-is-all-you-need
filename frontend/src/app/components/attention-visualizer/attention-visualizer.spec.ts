import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttentionVisualizerComponent } from './attention-visualizer.component';

describe('AttentionVisualizerComponent', () => {
  let component: AttentionVisualizerComponent;
  let fixture: ComponentFixture<AttentionVisualizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttentionVisualizerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AttentionVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
