import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TextAnalyzerComponent } from './components/text-analyzer/text-analyzer.component';

@Component({
  selector: 'app-root',
  imports: [TextAnalyzerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
})
export class App {
  protected title: string = 'frontend';
}
