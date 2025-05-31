// src/app/services/api.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface TextInput {
  text: string;
}

export interface AttentionResponse {
  tokens: string[];
  attention_matrix: number[][];
  error?: string;
}

export interface PredictionResponse {
  predicted_next_word: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly backendUrl = 'http://127.0.0.1:5000';

  constructor(private readonly http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('API Error:', error);

    const clientSideError = error.error instanceof ErrorEvent;
    const serverErrorBody = error.error;
    const statusCode = error.status;

    let errorMessage = 'Something bad happened; please try again later.';

    switch (true) {
      case clientSideError:
        errorMessage = `An error occurred: ${serverErrorBody.message}`;
        break;

      case !!serverErrorBody &&
        typeof serverErrorBody === 'object' &&
        'error' in serverErrorBody:
        errorMessage = `Error from server: ${serverErrorBody.error}`;
        break;

      case !!statusCode:
        errorMessage = `Server returned code ${statusCode}, error message: ${error.message}`;
        break;

      default:
        break;
    }

    return throwError(() => new Error(errorMessage));
  }

  getAttention(data: TextInput): Observable<AttentionResponse> {
    return this.http
      .post<AttentionResponse>(`${this.backendUrl}/attention/transformer`, data)
      .pipe(catchError((err) => this.handleError(err)));
  }

  getPrediction(data: TextInput): Observable<PredictionResponse> {
    return this.http
      .post<PredictionResponse>(`${this.backendUrl}/predict/transformer`, data)
      .pipe(catchError((err) => this.handleError(err)));
  }
}
