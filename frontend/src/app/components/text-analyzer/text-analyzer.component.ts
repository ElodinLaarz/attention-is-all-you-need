import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  TextInput,
  AttentionResponse,
  PredictionResponse,
} from '../../services/api.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-text-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-analyzer.component.html',
  styleUrl: './text-analyzer.component.scss',
})
export class TextAnalyzerComponent {
  // Text input
  inputText = 'Hello world how are you';

  // Attention data
  attentionTokens: string[] = [];
  attentionMatrix: number[][] = [];

  // Prediction output
  predictedWord = '';

  // UI state
  isLoadingAttention = false;
  isLoadingPrediction = false;
  errorMessage: string | null = null;

  constructor(private readonly apiService: ApiService) {}

  analyzeTextAttention(): void {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Please enter some text.';
      return;
    }

    this.resetAttentionState();

    const payload: TextInput = { text: this.inputText };

    this.apiService
      .getAttention(payload)
      .pipe(finalize(() => (this.isLoadingAttention = false)))
      .subscribe({
        next: (response: AttentionResponse) => {
          this.attentionTokens = response.tokens;
          this.attentionMatrix = response.attention_matrix;
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Failed to fetch attention data.';
          console.error(err);
        },
      });
  }

  predictNextWord(): void {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Please enter some text.';
      return;
    }

    this.resetPredictionState();

    const payload: TextInput = { text: this.inputText };

    this.apiService
      .getPrediction(payload)
      .pipe(finalize(() => (this.isLoadingPrediction = false)))
      .subscribe({
        next: (response: PredictionResponse) => {
          this.predictedWord = response.predicted_next_word;
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Failed to fetch prediction.';
          console.error(err);
        },
      });
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
