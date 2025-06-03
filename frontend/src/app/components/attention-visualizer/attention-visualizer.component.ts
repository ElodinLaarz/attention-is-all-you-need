import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-attention-visualizer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attention-visualizer.component.html',
  styleUrls: ['./attention-visualizer.component.scss'],
})
export class AttentionVisualizerComponent implements OnChanges {
  @Input() tokens: string[] = [];
  @Input() attentionMatrix: number[][] = [];
  @Input() hoveredTokenIndex: number | null = null;
  @Input() lockedTokenIndex: number | null = null;
  @Input() maxTokensPerLine: number = 10;
  @Input() wrapLines: boolean = true;

  @Output() tokenLockChange = new EventEmitter<number | null>();

  @ViewChild('attentionSvg', { static: false })
  svgElementRef!: ElementRef<SVGElement>;

  public tokenPositions: {
    x: number;
    y: number;
    text: string;
    displayText: string;
    width: number;
    row: number;
  }[] = [];

  public attentionPaths: {
    path: string;
    score: number;
    isHighlighted: boolean;
    fromIndex: number;
    toIndex: number;
    isHovered: boolean;
    isOutgoing?: boolean;
  }[] = [];

  public hoveredPathIndex: number | null = null;
  public hoveredPathScore: number | null = null;
  public hoveredPathFromToken: string | null = null;
  public hoveredPathToToken: string | null = null;
  public mouseX: number = 0;
  public mouseY: number = 0;

  public svgWidth: number = 800;
  public svgHeight: number = 200;
  public numRows: number = 1;

  private readonly MIN_TOKEN_WIDTH: number = 60;
  private readonly TOKEN_PADDING: number = 20;
  private readonly TOKEN_Y_BASE: number = 80;
  private readonly ROW_HEIGHT: number = 120;
  private readonly CURVE_HEIGHT_BASE: number = 80;
  private readonly START_PADDING: number = 40;
  private readonly TOKEN_GAP: number = 10;
  private readonly TOKEN_HEIGHT_OFFSET: number = 25;
  private readonly SVG_PADDING: number = 40;
  private readonly MIN_SVG_WIDTH: number = 400;
  private readonly MIN_SVG_HEIGHT: number = 200;
  private readonly SVG_HEIGHT_PADDING: number = 50;

  private readonly ALL_ATTENTION_THRESHOLD: number = 0.02;
  private readonly FOCUSED_ATTENTION_THRESHOLD: number = 0.01;
  private readonly TOP_ATTENTION_LIMIT: number = 5;
  private readonly INCOMING_ATTENTION_DIMMING: number = 0.6;

  private readonly CURVE_DISTANCE_FACTOR: number = 0.15;
  private readonly MAX_CURVE_HEIGHT: number = 100;
  private readonly INTER_ROW_CONTROL_OFFSET: number = 60;
  private readonly INTER_ROW_HEIGHT_OFFSET: number = 50;
  private readonly DISTANT_ROW_HEIGHT_FACTOR: number = 50;

  public readonly tooltipWidth: number = 200;
  public readonly tooltipHeight: number = 60;
  public readonly tooltipOffsetX: number = 10;
  public readonly tooltipOffsetY: number = 20;

  private readonly HOVER_END_TIMEOUT: number = 50;

  private readonly CANVAS_FONT: string = '14px monospace';

  public readonly STROKE_WIDTH_MULTIPLIER: number = 15;
  public readonly MIN_STROKE_WIDTH: number = 3;
  public readonly HOVER_STROKE_MULTIPLIER: number = 1.5;
  public readonly OPACITY_MULTIPLIER: number = 0.8;
  public readonly OPACITY_OFFSET: number = 0.2;
  public readonly MIN_OPACITY: number = 0.5;
  public readonly TOKEN_RECT_HEIGHT: number = 30;
  public readonly TOKEN_RECT_Y_OFFSET: number = 20;
  public readonly TOKEN_TEXT_Y_OFFSET: number = 5;
  public readonly TOKEN_BORDER_RADIUS: number = 4;
  public readonly ROW_DIVIDER_PADDING: number = 20;
  public readonly ROW_LABEL_Y_OFFSET: number = 45;

  public readonly VISUALIZER_PADDING: number = 20;
  public readonly VISUALIZER_BORDER_RADIUS: number = 8;
  public readonly SVG_BORDER_RADIUS: number = 6;
  public readonly SVG_MARGIN_TOP: number = 10;
  public readonly CONTROLS_GAP: number = 20;
  public readonly CONTROLS_MARGIN_BOTTOM: number = 10;
  public readonly LEGEND_MARGIN_TOP: number = 15;
  public readonly LEGEND_PADDING: number = 10;
  public readonly LEGEND_MIN_HEIGHT: number = 100;
  public readonly LEGEND_ITEM_GAP: number = 8;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['tokens'] ||
      changes['attentionMatrix'] ||
      changes['maxTokensPerLine'] ||
      changes['wrapLines']
    ) {
      this.prepareVisualizationData();
    }
    if (changes['hoveredTokenIndex'] || changes['lockedTokenIndex']) {
      this.updateAttentionLines();
    }
  }

  private prepareVisualizationData(): void {
    if (!this.tokens || this.tokens.length === 0) {
      this.tokenPositions = [];
      this.attentionPaths = [];
      return;
    }

    this.calculateTokenPositions();
    this.updateAttentionLines();
  }

  getRowNumbers(): number[] {
    return Array.from({ length: this.numRows }, (_, i) => i);
  }

  getRowDividers(): number[] {
    return Array.from({ length: this.numRows - 1 }, (_, i) => i + 1);
  }

  get tokenYBase(): number {
    return this.TOKEN_Y_BASE;
  }

  get rowHeight(): number {
    return this.ROW_HEIGHT;
  }

  onTokensPerLineChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.maxTokensPerLine = parseInt(select.value, 10);
    this.prepareVisualizationData();
  }

  private calculateTokenPositions(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = this.CANVAS_FONT;

    let currentX = this.START_PADDING;
    let currentRow = 0;
    let maxRowWidth = 0;
    this.tokenPositions = [];

    this.tokens.forEach((token, index) => {
      const displayText = this.formatTokenForDisplay(token);
      const textWidth = context.measureText(displayText).width;
      const tokenWidth = Math.max(textWidth + this.TOKEN_PADDING, this.MIN_TOKEN_WIDTH);

      if (this.wrapLines && index > 0 && index % this.maxTokensPerLine === 0) {
        maxRowWidth = Math.max(maxRowWidth, currentX);
        currentX = this.START_PADDING;
        currentRow++;
      }

      const yPosition = this.TOKEN_Y_BASE + currentRow * this.ROW_HEIGHT;

      this.tokenPositions.push({
        x: currentX + tokenWidth / 2,
        y: yPosition,
        text: token,
        displayText: displayText,
        width: tokenWidth,
        row: currentRow,
      });

      currentX += tokenWidth + this.TOKEN_GAP;
    });

    this.numRows = currentRow + 1;

    maxRowWidth = Math.max(maxRowWidth, currentX);
    this.svgWidth = Math.max(maxRowWidth + this.SVG_PADDING, this.MIN_SVG_WIDTH);
    this.svgHeight = Math.max(
      this.TOKEN_Y_BASE + this.numRows * this.ROW_HEIGHT + this.SVG_HEIGHT_PADDING,
      this.MIN_SVG_HEIGHT
    );
  }

  private updateAttentionLines(): void {
    this.attentionPaths = [];
    this.resetPathHoverState();

    if (!this.attentionMatrix || this.tokenPositions.length === 0) {
      return;
    }

    if (this.hoveredTokenIndex === null && this.lockedTokenIndex === null) {
      this.drawAllAttentionLines();
    } else {
      const activeTokenIndex =
        this.lockedTokenIndex !== null ? this.lockedTokenIndex : this.hoveredTokenIndex;
      this.drawHoveredAttentionLines(activeTokenIndex!);
    }
  }

  private drawAllAttentionLines(): void {
    const allAttentionPairs: {
      fromIndex: number;
      toIndex: number;
      score: number;
    }[] = [];

    this.attentionMatrix.forEach((row, fromIndex) => {
      row.forEach((score, toIndex) => {
        if (score > this.ALL_ATTENTION_THRESHOLD && fromIndex !== toIndex) {
          allAttentionPairs.push({
            fromIndex,
            toIndex,
            score,
          });
        }
      });
    });

    const topAttentionPairs = allAttentionPairs
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_ATTENTION_LIMIT);

    topAttentionPairs.forEach((pair) => {
      const path = this.createCurvedPath(pair.fromIndex, pair.toIndex);
      this.attentionPaths.push({
        path,
        score: pair.score,
        isHighlighted: false,
        fromIndex: pair.fromIndex,
        toIndex: pair.toIndex,
        isHovered: false,
      });
    });
  }

  private drawHoveredAttentionLines(activeTokenIndex: number): void {
    if (!this.attentionMatrix[activeTokenIndex]) return;

    const outgoingAttention: { toIndex: number; score: number }[] = [];
    this.attentionMatrix[activeTokenIndex].forEach((score, toIndex) => {
      if (score > this.FOCUSED_ATTENTION_THRESHOLD && activeTokenIndex !== toIndex) {
        outgoingAttention.push({ toIndex, score });
      }
    });

    outgoingAttention
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_ATTENTION_LIMIT)
      .forEach((pair) => {
        const path = this.createCurvedPath(activeTokenIndex, pair.toIndex);
        this.attentionPaths.push({
          path,
          score: pair.score,
          isHighlighted: true,
          fromIndex: activeTokenIndex,
          toIndex: pair.toIndex,
          isHovered: false,
          isOutgoing: true,
        });
      });

    const incomingAttention: { fromIndex: number; score: number }[] = [];
    this.attentionMatrix.forEach((row, fromIndex) => {
      const score = row[activeTokenIndex];
      if (score > this.FOCUSED_ATTENTION_THRESHOLD && fromIndex !== activeTokenIndex) {
        incomingAttention.push({ fromIndex, score });
      }
    });

    incomingAttention
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_ATTENTION_LIMIT)
      .forEach((pair) => {
        const path = this.createCurvedPath(pair.fromIndex, activeTokenIndex);
        this.attentionPaths.push({
          path,
          score: pair.score * this.INCOMING_ATTENTION_DIMMING,
          isHighlighted: true,
          fromIndex: pair.fromIndex,
          toIndex: activeTokenIndex,
          isHovered: false,
          isOutgoing: false,
        });
      });
  }

  private createCurvedPath(fromIndex: number, toIndex: number): string {
    const fromPos = this.tokenPositions[fromIndex];
    const toPos = this.tokenPositions[toIndex];

    if (!fromPos || !toPos) return '';

    const startX = fromPos.x;
    const startY = fromPos.y - this.TOKEN_HEIGHT_OFFSET;
    const endX = toPos.x;
    const endY = toPos.y - this.TOKEN_HEIGHT_OFFSET;

    const sameLine = fromPos.row === toPos.row;

    if (sameLine) {
      const distance = Math.abs(endX - startX);
      const curveHeight = Math.min(
        this.CURVE_HEIGHT_BASE + distance * this.CURVE_DISTANCE_FACTOR,
        this.MAX_CURVE_HEIGHT
      );

      const midX = (startX + endX) / 2;
      const controlY = startY - curveHeight;

      return `M ${startX} ${startY} Q ${midX} ${controlY} ${endX} ${endY}`;
    } else {
      const rowDiff = Math.abs(fromPos.row - toPos.row);
      const isFromAbove = fromPos.row < toPos.row;

      const controlOffset = this.INTER_ROW_CONTROL_OFFSET;

      const cp1x = startX + (isFromAbove ? controlOffset : -controlOffset);
      const cp1y = startY - this.INTER_ROW_HEIGHT_OFFSET;
      const cp2x = endX + (isFromAbove ? -controlOffset : controlOffset);
      const cp2y = endY - this.INTER_ROW_HEIGHT_OFFSET;

      if (rowDiff > 1) {
        const heightFactor = rowDiff * this.DISTANT_ROW_HEIGHT_FACTOR;
        return `M ${startX} ${startY} C ${cp1x} ${startY - heightFactor} ${cp2x} ${endY - heightFactor} ${endX} ${endY}`;
      }

      return `M ${startX} ${startY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endX} ${endY}`;
    }
  }

  onTokenHover(index: number | null): void {
    if (this.lockedTokenIndex !== null) return;

    this.hoveredTokenIndex = index;
    this.updateAttentionLines();
  }

  onTokenClick(index: number): void {
    if (this.lockedTokenIndex === index) {
      this.lockedTokenIndex = null;
      this.hoveredTokenIndex = null;
      this.tokenLockChange.emit(null);
    } else {
      this.lockedTokenIndex = index;
      this.hoveredTokenIndex = index;
      this.tokenLockChange.emit(index);
    }
    this.updateAttentionLines();
  }

  onPathHover(index: number): void {
    if (this.lockedTokenIndex === null) return;

    if (this.hoverEndTimeout) {
      clearTimeout(this.hoverEndTimeout);
      this.hoverEndTimeout = null;
    }

    const path = this.attentionPaths[index];
    if (path) {
      if (this.hoveredPathIndex === index) return;

      this.hoveredPathIndex = index;
      this.hoveredPathScore = path.score;
      this.hoveredPathFromToken = this.tokens[path.fromIndex] || '';
      this.hoveredPathToToken = this.tokens[path.toIndex] || '';

      this.attentionPaths = this.attentionPaths.map((p, i) => {
        if (i === index) {
          return { ...p, isHovered: true };
        } else if (p.isHovered) {
          return { ...p, isHovered: false };
        }
        return p;
      });
    }
  }

  private hoverEndTimeout: ReturnType<typeof setTimeout> | null = null;

  onPathHoverEnd(): void {
    if (this.hoverEndTimeout) {
      clearTimeout(this.hoverEndTimeout);
    }

    this.hoverEndTimeout = setTimeout(() => {
      this.resetPathHoverState();
      this.hoverEndTimeout = null;
    }, this.HOVER_END_TIMEOUT);
  }

  private resetPathHoverState(): void {
    if (this.hoveredPathIndex === null) return;

    this.hoveredPathIndex = null;
    this.hoveredPathScore = null;
    this.hoveredPathFromToken = null;
    this.hoveredPathToToken = null;

    const hoveredPaths = this.attentionPaths.filter((p) => p.isHovered);
    if (hoveredPaths.length > 0) {
      this.attentionPaths = this.attentionPaths.map((p) => {
        if (p.isHovered) {
          return { ...p, isHovered: false };
        }
        return p;
      });
    }
  }

  formatScore(score: number): string {
    return (score * 100).toFixed(1) + '%';
  }

  formatTokenForDisplay(token: string): string {
    if (!token) return '';

    const sanitizedToken = this.sanitizeToken(token);
    let result = '';

    for (let i = 0; i < sanitizedToken.length; i++) {
      const char = sanitizedToken[i];
      const code = char.charCodeAt(0);

      if (code === 0xfffd) {
        result += '[?]';
        continue;
      }

      switch (char) {
        case '\n':
          result += '\\n';
          break;
        case '\r':
          result += '\\r';
          break;
        case '\t':
          result += '\\t';
          break;
        case '\0':
          result += '\\0';
          break;
        default:
          if (code === 0x00a0) {
            result += '[NBSP]';
          } else if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
            result += '\\u' + code.toString(16).padStart(4, '0').toUpperCase();
          } else if (code >= 127 && code <= 159) {
            result += '\\u' + code.toString(16).padStart(4, '0').toUpperCase();
          } else {
            result += char;
          }
          break;
      }
    }

    return result;
  }

  private sanitizeToken(token: string): string {
    if (!token) return '';

    return token.replace(/\uFFFD/g, '[?]');
  }

  refreshVisualization(): void {
    this.prepareVisualizationData();
  }

  getStrokeColor(isHighlighted: boolean, isHovered: boolean, isOutgoing?: boolean): string {
    if (isHovered) {
      if (isOutgoing === true) {
        return '#EF4444';
      }
      return '#2563eb';
    }
    if (isHighlighted) {
      if (isOutgoing === true) {
        return '#F08080';
      } else if (isOutgoing === false) {
        return '#3b82f6';
      }
      return '#3b82f6';
    }
    return '#6b7280';
  }

  getPathClasses(isHighlighted: boolean, isHovered: boolean): string {
    const classes = ['attention-path'];
    if (isHighlighted) classes.push('highlighted');
    if (isHovered) classes.push('hovered');
    return classes.join(' ');
  }

  getMaxValue(value: number, minValue: number): number {
    return Math.max(value, minValue);
  }

  trackMousePosition(event: MouseEvent): void {
    const currentSvgWidth = this.svgWidth;
    const currentSvgHeight = this.svgHeight;

    const rawMouseX = event.offsetX;
    const rawMouseY = event.offsetY;

    const minClampedX = -this.tooltipOffsetX;
    const maxClampedX = currentSvgWidth - this.tooltipWidth - this.tooltipOffsetX;

    this.mouseX = Math.max(minClampedX, Math.min(rawMouseX, maxClampedX));

    const minClampedY = -this.tooltipOffsetY;
    const maxClampedY = currentSvgHeight - this.tooltipHeight - this.tooltipOffsetY;

    this.mouseY = Math.max(minClampedY, Math.min(rawMouseY, maxClampedY));
  }
}
