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
import { debounceTime, distinctUntilChanged, switchMap, finalize, tap } from 'rxjs/operators';
import { AttentionVisualizerComponent } from '../attention-visualizer/attention-visualizer.component';

// Material Design modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSliderModule } from '@angular/material/slider';
import { MatCardModule } from '@angular/material/card';

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
    MatSliderModule,
    MatCardModule,
    AttentionVisualizerComponent,
  ],
  templateUrl: './text-analyzer.component.html',
  styleUrl: './text-analyzer.component.scss',
})
export class TextAnalyzerComponent implements OnInit, OnDestroy {
  // Text input form control
  inputControl: FormControl<string> = new FormControl('Hello world how are you', {
    nonNullable: true,
  });
  public hoveredTokenIndex: number | null = null; // Property to pass to visualizer
  public lockedTokenIndex: number | null = null; // Property to track locked token

  // Token prediction state
  isAddingTokens: boolean = false;
  isAutocompleting: boolean = false;
  private autocompleteInterval: ReturnType<typeof setInterval> | null = null;
  private readonly AUTOCOMPLETE_DELAY_MS: number = 1000; // 1 second delay

  // Subject to emit input changes
  private inputChanged: Subject<string> = new Subject<string>();

  // Subscription to handle cleanup
  private inputSubscription!: Subscription;

  // Attention data
  attentionTokens: string[] = [];
  attentionLayers: number[][][] = [];
  currentLayer: number = 0;
  numLayers: number = 0;

  // Current layer's attention matrix for the visualizer
  get currentAttentionMatrix(): number[][] {
    if (this.attentionLayers.length === 0 || this.currentLayer >= this.attentionLayers.length) {
      return [];
    }
    return this.attentionLayers[this.currentLayer];
  }

  // Visualizer configuration
  maxTokensPerLine: number = 10;
  wrapLongTexts: boolean = true;

  // Prediction output
  predictedWord: string = '';

  // UI state flags
  isLoadingAttention: boolean = false;
  isLoadingPrediction: boolean = false;
  errorMessage: string | null = null;

  // Matrix display configuration
  matrixColumnsPerPage: number = 10;
  currentMatrixPage: number = 0;

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.inputSubscription = this.inputChanged
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        tap((text: string) => {
          if (text.trim()) {
            // Save autocomplete state before resetting
            const wasAutocompleting = this.isAutocompleting;

            this.resetPredictionState();

            // Restore autocomplete state if it was active
            this.isAutocompleting = wasAutocompleting;
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
        })
      )
      .subscribe({
        next: (response: PredictionResponse | never[]) => {
          if ('predicted_next_word' in response) {
            this.predictedWord = response.predicted_next_word;

            // If we're autocompleting but got an empty prediction, we should stop
            if (this.isAutocompleting && !this.predictedWord) {
              this.stopAutocomplete();
            }
          }
        },
        error: (err: unknown) => {
          const errorObj = err as { message?: string };
          this.errorMessage = errorObj?.message ?? 'Failed to fetch prediction.';
          console.error(err);
          this.isLoadingPrediction = false;

          // Stop autocomplete on error
          if (this.isAutocompleting) {
            this.stopAutocomplete();
          }
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
          this.attentionLayers = response.attention_layers;
          this.numLayers = response.num_layers;
          this.currentLayer = Math.max(0, this.numLayers - 1); // Default to last layer
          this.errorMessage = null;
        },
        error: (err: unknown) => {
          const errorObj = err as { message?: string };
          this.errorMessage = errorObj?.message ?? 'Failed to fetch attention data.';
          console.error(err);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.inputSubscription) {
      this.inputSubscription.unsubscribe();
    }

    // Clean up any running autocomplete
    this.stopAutocomplete();
  }

  private resetAttentionState(): void {
    this.isLoadingAttention = true;
    this.errorMessage = null;
    this.attentionTokens = [];
    this.attentionLayers = [];
    this.numLayers = 0;
    this.currentLayer = 0;
    this.currentMatrixPage = 0; // Reset to first page

    // Stop autocomplete when analyzing new text
    this.stopAutocomplete();
  }

  private resetPredictionState(): void {
    this.isLoadingPrediction = true;
    this.errorMessage = null;
    this.predictedWord = '';
    this.isAddingTokens = false;

    // Note: We're not stopping autocomplete here anymore
    // because we want to preserve the autocomplete state between predictions
  }

  /**
   * Handle hovering over a token in the matrix
   */
  onTokenHover(index: number | null): void {
    // If we have a locked token, don't change hover state
    if (this.lockedTokenIndex !== null) return;

    this.hoveredTokenIndex = index;
  }

  /**
   * Handle clicking on a token to lock/unlock it
   */
  onTokenClick(index: number): void {
    if (this.lockedTokenIndex === index) {
      // If clicking the already locked token, unlock it
      this.lockedTokenIndex = null;
      this.hoveredTokenIndex = null;
    } else {
      // Lock to the clicked token
      this.lockedTokenIndex = index;
      this.hoveredTokenIndex = index;
    }
  }

  /**
   * Handle click events from the attention visualizer
   */
  onTokenLockChange(index: number | null): void {
    this.lockedTokenIndex = index;
    this.hoveredTokenIndex = index;
  }

  /**
   * Handle changing the tokens per line in the visualizer
   */
  onTokensPerLineChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.maxTokensPerLine = parseInt(select.value, 10);
  }

  /**
   * Handle changing the number of columns displayed in the matrix
   */
  onMatrixColumnsChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.matrixColumnsPerPage = parseInt(select.value, 10);
    this.currentMatrixPage = 0; // Reset to first page
  }

  /**
   * Handle changing the attention layer to visualize
   */
  onLayerChange(value: number): void {
    this.currentLayer = value;
  }

  /**
   * Change the current page of the matrix display
   */
  changeMatrixPage(increment: number): void {
    this.currentMatrixPage = Math.max(
      0,
      Math.min(this.matrixPageCount - 1, this.currentMatrixPage + increment)
    );
  }

  /**
   * Get the total number of pages in the matrix display
   */
  get matrixPageCount(): number {
    if (!this.attentionTokens || this.attentionTokens.length === 0) return 1;
    return Math.ceil(this.attentionTokens.length / this.matrixColumnsPerPage);
  }

  /**
   * Get the list of indices for columns to display on the current page
   */
  getVisibleColumnIndices(): number[] {
    if (!this.attentionTokens || this.attentionTokens.length === 0) return [];

    const startIndex = this.currentMatrixPage * this.matrixColumnsPerPage;
    const endIndex = Math.min(startIndex + this.matrixColumnsPerPage, this.attentionTokens.length);

    return Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i);
  }

  /**
   * Get the tokens for columns to display on the current page
   */
  getVisibleColumnTokens(): string[] {
    return this.getVisibleColumnIndices().map((index) => this.attentionTokens[index]);
  }

  /**
   * Convert a relative column index to an absolute index
   */
  getAbsoluteColumnIndex(relativeIndex: number): number {
    return this.currentMatrixPage * this.matrixColumnsPerPage + relativeIndex;
  }

  /**
   * Get the attention level for styling
   */
  getAttentionLevel(score: number): string {
    return score > 0.1 ? 'high' : score > 0.05 ? 'medium' : 'low';
  }

  /**
   * Add the predicted token to the current text input
   */
  addPredictedToken(): void {
    if (!this.predictedWord || this.isAddingTokens) return;

    this.isAddingTokens = true;

    // Add the predicted token to the current text
    const currentText = this.inputControl.value;
    const newText = currentText + (currentText.endsWith(' ') ? '' : ' ') + this.predictedWord;

    // Store autocomplete state
    const wasAutocompleting = this.isAutocompleting;

    // Update the input control
    this.inputControl.setValue(newText);

    // Use setTimeout to give the UI a chance to show the loading state
    setTimeout(() => {
      // Trigger prediction for the next word
      this.inputChanged.next(newText);

      // Reset adding state after a short delay to allow spinner to be visible
      setTimeout(() => {
        this.isAddingTokens = false;

        // Restore autocomplete state
        this.isAutocompleting = wasAutocompleting;
      }, 300);
    }, 100);
  }

  /**
   * Toggle the autocomplete mode on/off
   */
  toggleAutocomplete(): void {
    if (this.isAutocompleting) {
      // Stop autocomplete
      this.stopAutocomplete();
    } else {
      // Start autocomplete
      this.startAutocomplete();
    }
  }

  /**
   * Start the autocomplete process
   */
  private startAutocomplete(): void {
    if (this.isAutocompleting || !this.predictedWord) return;

    // Clear any existing interval just in case
    if (this.autocompleteInterval) {
      clearInterval(this.autocompleteInterval);
    }

    this.isAutocompleting = true;

    // Add the first token immediately
    this.addPredictedToken();

    // Set up interval to add tokens periodically
    this.autocompleteInterval = setInterval(() => {
      // Only continue if we have a prediction and we're still in autocomplete mode
      if (this.predictedWord && this.isAutocompleting && !this.isAddingTokens) {
        this.addPredictedToken();
      } else if (!this.predictedWord) {
        // If there's no more prediction, wait for one to appear
        console.log('Waiting for next prediction...');
      }
    }, this.AUTOCOMPLETE_DELAY_MS);
  }

  /**
   * Stop the autocomplete process
   */
  private stopAutocomplete(): void {
    if (this.autocompleteInterval) {
      clearInterval(this.autocompleteInterval);
      this.autocompleteInterval = null;
    }
    this.isAutocompleting = false;
  }
}
