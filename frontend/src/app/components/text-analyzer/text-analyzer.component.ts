import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import {
  ApiService,
  TextInput,
  AttentionResponse,
  PredictionResponse,
} from '../../services/api.service';
import { Subject, Subscription, Observable, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  finalize,
  tap,
} from 'rxjs/operators';

// Material Design modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-text-analyzer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './text-analyzer.component.html',
  styleUrl: './text-analyzer.component.scss',
})
export class TextAnalyzerComponent implements OnInit, OnDestroy {
  // Text input form control
  inputControl: FormControl<string> = new FormControl(
    'Hello world how are you',
    { nonNullable: true },
  );

  // Subject to emit input changes
  private inputChanged: Subject<string> = new Subject<string>();

  // Subscription to handle cleanup
  private inputSubscription!: Subscription;

  // Attention data
  attentionTokens: string[] = [];
  attentionMatrix: number[][] = [];

  // Prediction output
  predictedWord: string = '';

  // UI state flags
  isLoadingAttention: boolean = false;
  isLoadingPrediction: boolean = false;
  errorMessage: string | null = null;

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.inputSubscription = this.inputChanged
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        tap((text: string) => {
          if (text.trim()) {
            this.resetPredictionState();
          }
        }),
        switchMap((text: string): Observable<PredictionResponse | never[]> => {
          if (!text.trim()) {
            this.isLoadingPrediction = false;
            return of([]);
          }

          const payload: TextInput = { text };
          return this.apiService
            .getPrediction(payload)
            .pipe(finalize(() => (this.isLoadingPrediction = false)));
        }),
      )
      .subscribe({
        next: (response: PredictionResponse | never[]) => {
          if ('predicted_next_word' in response) {
            this.predictedWord = response.predicted_next_word;
          }
        },
        error: (err: any) => {
          this.errorMessage = err?.message ?? 'Failed to fetch prediction.';
          console.error(err);
          this.isLoadingPrediction = false;
        },
      });

    // Initial trigger
    if (this.inputControl.value) {
      this.inputChanged.next(this.inputControl.value);
    }
  }

  onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.inputChanged.next(value);
  }

  analyzeTextAttention(): void {
    const currentInput: string = this.inputControl.value;

    if (!currentInput || !currentInput.trim()) {
      this.errorMessage = 'Please enter some text.';
      return;
    }

    this.resetAttentionState();

    const payload: TextInput = { text: currentInput };

    this.apiService
      .getAttention(payload)
      .pipe(finalize(() => (this.isLoadingAttention = false)))
      .subscribe({
        next: (response: AttentionResponse) => {
          this.attentionTokens = response.tokens;
          this.attentionMatrix = response.attention_matrix;
        },
        error: (err: any) => {
          this.errorMessage = err?.message ?? 'Failed to fetch attention data.';
          console.error(err);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.inputSubscription) {
      this.inputSubscription.unsubscribe();
    }
  }

  private resetAttentionState(): void {
    this.isLoadingAttention = true;
    this.errorMessage = null;
    this.attentionTokens = [];
    this.attentionMatrix = [];
  }

  private resetPredictionState(): void {
    this.isLoadingPrediction = true;
    this.errorMessage = null;
    this.predictedWord = '';
  }
}
