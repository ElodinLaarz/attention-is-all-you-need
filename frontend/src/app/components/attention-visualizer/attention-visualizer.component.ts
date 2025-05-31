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
  // Configuration for multi-line token display
  @Input() maxTokensPerLine: number = 10; // Maximum tokens per line
  @Input() wrapLines: boolean = true; // Enable/disable line wrapping

  @Output() tokenLockChange = new EventEmitter<number | null>();

  @ViewChild('attentionSvg', { static: false })
  svgElementRef!: ElementRef<SVGElement>;

  public tokenPositions: {
    x: number;
    y: number;
    text: string;
    width: number;
    row: number;
  }[] = [];

  public attentionPaths: {
    path: string;
    score: number;
    isHighlighted: boolean;
    fromIndex: number; // Add fromIndex for displaying the source token
    toIndex: number; // Add toIndex for displaying the target token
    isHovered: boolean; // Add hover state for each path
    isOutgoing?: boolean; // True if path originates from the active token
  }[] = [];

  public hoveredPathIndex: number | null = null; // Track which path is currently being hovered
  public hoveredPathScore: number | null = null; // Track the score of hovered path
  public hoveredPathFromToken: string | null = null; // Source token of hovered path
  public hoveredPathToToken: string | null = null; // Target token of hovered path
  public mouseX: number = 0; // Track mouse X position for tooltip
  public mouseY: number = 0; // Track mouse Y position for tooltip

  public svgWidth: number = 800;
  public svgHeight: number = 200;
  public numRows: number = 1; // Track number of rows for dynamic height

  private readonly MIN_TOKEN_WIDTH: number = 60;
  private readonly TOKEN_PADDING: number = 20;
  private readonly TOKEN_Y_BASE: number = 80; // Base Y position for first row
  private readonly ROW_HEIGHT: number = 120; // Height between rows
  private readonly CURVE_HEIGHT_BASE: number = 80; // Base height for attention curves

  // Tooltip configuration constants
  public readonly tooltipWidth: number = 200; // Width of the tooltip <foreignObject>
  public readonly tooltipHeight: number = 60; // Height of the tooltip <foreignObject>
  public readonly tooltipOffsetX: number = 10; // X offset for tooltip from mouseX
  public readonly tooltipOffsetY: number = 20; // Y offset for tooltip from mouseY

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

    // Calculate token positions with dynamic spacing based on text length
    this.calculateTokenPositions();
    this.updateAttentionLines();
  }

  // Helper methods for the template
  getRowNumbers(): number[] {
    return Array.from({ length: this.numRows }, (_, i) => i);
  }

  getRowDividers(): number[] {
    return Array.from({ length: this.numRows - 1 }, (_, i) => i + 1);
  }

  // Expose private constants for the template
  get tokenYBase(): number {
    return this.TOKEN_Y_BASE;
  }

  get rowHeight(): number {
    return this.ROW_HEIGHT;
  }

  // Handle tokens per line change from dropdown
  onTokensPerLineChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.maxTokensPerLine = parseInt(select.value, 10);
    this.prepareVisualizationData();
  }

  private calculateTokenPositions(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = '14px monospace'; // Match your CSS font

    let currentX = 40; // Start padding
    let currentRow = 0;
    let maxRowWidth = 0; // Track the widest row
    this.tokenPositions = [];

    this.tokens.forEach((token, index) => {
      const textWidth = context.measureText(token).width;
      const tokenWidth = Math.max(textWidth + this.TOKEN_PADDING, this.MIN_TOKEN_WIDTH);

      // Check if we need to wrap to a new line
      if (this.wrapLines && index > 0 && index % this.maxTokensPerLine === 0) {
        // Start a new row
        maxRowWidth = Math.max(maxRowWidth, currentX);
        currentX = 40; // Reset X position
        currentRow++; // Move to next row
      }

      const yPosition = this.TOKEN_Y_BASE + currentRow * this.ROW_HEIGHT;

      this.tokenPositions.push({
        x: currentX + tokenWidth / 2, // Center of token
        y: yPosition,
        text: token,
        width: tokenWidth,
        row: currentRow,
      });

      currentX += tokenWidth + 10; // 10px gap between tokens
    });

    // Update number of rows
    this.numRows = currentRow + 1;

    // Update SVG dimensions based on content
    maxRowWidth = Math.max(maxRowWidth, currentX);
    this.svgWidth = Math.max(maxRowWidth + 40, 400);
    this.svgHeight = Math.max(this.TOKEN_Y_BASE + this.numRows * this.ROW_HEIGHT + 50, 200);
  }

  private updateAttentionLines(): void {
    this.attentionPaths = [];
    this.resetPathHoverState(); // Reset hover state when updating lines

    if (!this.attentionMatrix || this.tokenPositions.length === 0) {
      return;
    }

    // If no token is hovered, show all significant attention weights with low opacity
    if (this.hoveredTokenIndex === null && this.lockedTokenIndex === null) {
      this.drawAllAttentionLines();
    } else {
      // If we have a locked token, prioritize showing its attention
      const activeTokenIndex =
        this.lockedTokenIndex !== null ? this.lockedTokenIndex : this.hoveredTokenIndex;
      this.drawHoveredAttentionLines(activeTokenIndex!);
    }
  }

  private drawAllAttentionLines(): void {
    // Collect all attention pairs with their scores
    const allAttentionPairs: {
      fromIndex: number;
      toIndex: number;
      score: number;
    }[] = [];

    this.attentionMatrix.forEach((row, fromIndex) => {
      row.forEach((score, toIndex) => {
        if (score > 0.02 && fromIndex !== toIndex) {
          // Lowered threshold to find more candidates
          allAttentionPairs.push({
            fromIndex,
            toIndex,
            score,
          });
        }
      });
    });

    // Sort by score in descending order and take top 5
    const topAttentionPairs = allAttentionPairs.sort((a, b) => b.score - a.score).slice(0, 5);

    // Create paths for top attention pairs
    topAttentionPairs.forEach((pair) => {
      const path = this.createCurvedPath(pair.fromIndex, pair.toIndex);
      this.attentionPaths.push({
        path,
        score: pair.score, // Use full score for line thickness
        isHighlighted: false,
        fromIndex: pair.fromIndex,
        toIndex: pair.toIndex,
        isHovered: false,
        // isOutgoing is undefined for these general paths
      });
    });
  }

  private drawHoveredAttentionLines(activeTokenIndex: number): void {
    if (!this.attentionMatrix[activeTokenIndex]) return;

    // Draw outgoing attention (from hovered token)
    const outgoingAttention: { toIndex: number; score: number }[] = [];
    this.attentionMatrix[activeTokenIndex].forEach((score, toIndex) => {
      if (score > 0.01 && activeTokenIndex !== toIndex) {
        outgoingAttention.push({ toIndex, score });
      }
    });

    // Sort and take top 5 outgoing
    outgoingAttention
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .forEach((pair) => {
        const path = this.createCurvedPath(activeTokenIndex, pair.toIndex);
        this.attentionPaths.push({
          path,
          score: pair.score,
          isHighlighted: true,
          fromIndex: activeTokenIndex,
          toIndex: pair.toIndex,
          isHovered: false,
          isOutgoing: true, // Mark as outgoing
        });
      });

    // Draw incoming attention (to hovered token) in a different style
    const incomingAttention: { fromIndex: number; score: number }[] = [];
    this.attentionMatrix.forEach((row, fromIndex) => {
      const score = row[activeTokenIndex];
      if (score > 0.01 && fromIndex !== activeTokenIndex) {
        incomingAttention.push({ fromIndex, score });
      }
    });

    // Sort and take top 5 incoming
    incomingAttention
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .forEach((pair) => {
        const path = this.createCurvedPath(pair.fromIndex, activeTokenIndex);
        this.attentionPaths.push({
          path,
          score: pair.score * 0.6, // Slightly dimmed for incoming attention
          isHighlighted: true, // Also animate incoming attention paths
          fromIndex: pair.fromIndex,
          toIndex: activeTokenIndex,
          isHovered: false,
          isOutgoing: false, // Mark as incoming
        });
        console.log(`Incoming attention path created with score: ${pair.score}`); // Explicitly use score
      });
  }

  private createCurvedPath(fromIndex: number, toIndex: number): string {
    const fromPos = this.tokenPositions[fromIndex];
    const toPos = this.tokenPositions[toIndex];

    if (!fromPos || !toPos) return '';

    const startX = fromPos.x;
    const startY = fromPos.y - 25; // Start above token
    const endX = toPos.x;
    const endY = toPos.y - 25; // End above token

    // Check if tokens are on different rows
    const sameLine = fromPos.row === toPos.row;

    if (sameLine) {
      // For tokens on the same row, use a simple arc
      // Calculate curve parameters
      const distance = Math.abs(endX - startX);
      // Increase curve height slightly for better visibility and interaction
      const curveHeight = Math.min(this.CURVE_HEIGHT_BASE + distance * 0.15, 100);

      // Control points for quadratic Bézier curve
      const midX = (startX + endX) / 2;
      const controlY = startY - curveHeight;

      // Create SVG path with quadratic Bézier curve
      return `M ${startX} ${startY} Q ${midX} ${controlY} ${endX} ${endY}`;
    } else {
      // For tokens on different rows, create a more complex path
      // Use cubic Bézier curve for smoother inter-row paths
      const rowDiff = Math.abs(fromPos.row - toPos.row);
      const isFromAbove = fromPos.row < toPos.row;

      // Increase control point offset for smoother, more pronounced curves
      const controlOffset = 60; // Increased from 40

      // Calculate control points for cubic Bézier
      const cp1x = startX + (isFromAbove ? controlOffset : -controlOffset);
      const cp1y = startY - 50; // Increased from 40
      const cp2x = endX + (isFromAbove ? -controlOffset : controlOffset);
      const cp2y = endY - 50; // Increased from 40

      // For distant rows, create control points that go higher
      if (rowDiff > 1) {
        // Adjust control points for better path visualization
        const heightFactor = rowDiff * 50; // Increased from 40
        return `M ${startX} ${startY} C ${cp1x} ${startY - heightFactor} ${cp2x} ${endY - heightFactor} ${endX} ${endY}`;
      }

      return `M ${startX} ${startY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endX} ${endY}`;
    }
  }

  onTokenHover(index: number | null): void {
    // If we have a locked token, don't change hover state
    if (this.lockedTokenIndex !== null) return;

    this.hoveredTokenIndex = index;
    this.updateAttentionLines();
  }

  onTokenClick(index: number): void {
    if (this.lockedTokenIndex === index) {
      // If clicking the already locked token, unlock it
      this.lockedTokenIndex = null;
      this.hoveredTokenIndex = null;
      this.tokenLockChange.emit(null); // Emit null to indicate unlock
    } else {
      // Lock to the clicked token
      this.lockedTokenIndex = index;
      this.hoveredTokenIndex = index;
      this.tokenLockChange.emit(index); // Emit the locked token index
    }
    this.updateAttentionLines();
  }

  // New method to handle path hover
  onPathHover(index: number): void {
    // Only show path weight details when a token is locked
    if (this.lockedTokenIndex === null) return;

    // Clear any pending hover end timeouts
    if (this.hoverEndTimeout) {
      clearTimeout(this.hoverEndTimeout);
      this.hoverEndTimeout = null;
    }

    const path = this.attentionPaths[index];
    if (path) {
      // If we're already hovering this path, no need to update
      if (this.hoveredPathIndex === index) return;

      this.hoveredPathIndex = index;
      this.hoveredPathScore = path.score;
      this.hoveredPathFromToken = this.tokens[path.fromIndex] || '';
      this.hoveredPathToToken = this.tokens[path.toIndex] || '';

      // Set the hovered state for this path - make it more efficient by only updating
      // the necessary items rather than recreating the entire array
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

  // Track timeout to prevent flickering
  private hoverEndTimeout: ReturnType<typeof setTimeout> | null = null; // Replace any with specific type

  // New method to handle path hover end
  onPathHoverEnd(): void {
    // Use a small timeout to prevent flickering when moving between nearby parts of the path
    if (this.hoverEndTimeout) {
      clearTimeout(this.hoverEndTimeout);
    }

    this.hoverEndTimeout = setTimeout(() => {
      this.resetPathHoverState();
      this.hoverEndTimeout = null;
    }, 50); // Small timeout to ensure smoother hover experience
  }

  // Helper method to reset path hover state
  private resetPathHoverState(): void {
    // Only process if there's actually a hovered path
    if (this.hoveredPathIndex === null) return;

    this.hoveredPathIndex = null;
    this.hoveredPathScore = null;
    this.hoveredPathFromToken = null;
    this.hoveredPathToToken = null;

    // Reset hover state more efficiently by only updating paths that need it
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

  // Format score as percentage for display
  formatScore(score: number): string {
    return (score * 100).toFixed(1) + '%';
  }

  // Expose the prepare method to the template for re-rendering when layout changes
  refreshVisualization(): void {
    this.prepareVisualizationData();
  }

  // Helper method to get stroke color based on attention direction
  getStrokeColor(isHighlighted: boolean, isHovered: boolean, isOutgoing?: boolean): string {
    if (isHovered) {
      if (isOutgoing === true) {
        return '#EF4444'; // Red-500 for hovered outgoing paths
      }
      return '#2563eb'; // Blue-600 for hovered incoming/general paths
    }
    if (isHighlighted) {
      if (isOutgoing === true) {
        return '#F08080'; // LightCoral for highlighted outgoing paths (passive)
      } else if (isOutgoing === false) {
        return '#3b82f6'; // Blue-500 for highlighted incoming paths (passive)
      }
      // Fallback for highlighted paths where isOutgoing is not defined (e.g. from drawAllAttentionLines)
      return '#3b82f6'; // Default blue
    }
    return '#6b7280'; // Gray for non-highlighted, non-hovered paths
  }

  // Helper method to get additional classes for styling
  getPathClasses(isHighlighted: boolean, isHovered: boolean): string {
    const classes = ['attention-path'];
    if (isHighlighted) classes.push('highlighted');
    if (isHovered) classes.push('hovered');
    return classes.join(' ');
  }

  // Helper method to get maximum value in the attention matrix for scaling
  getMaxValue(value: number, minValue: number): number {
    return Math.max(value, minValue);
  }

  // Track mouse position for tooltip placement
  trackMousePosition(event: MouseEvent): void {
    const currentSvgWidth = this.svgWidth;
    const currentSvgHeight = this.svgHeight;

    // Raw mouse position within the SVG
    const rawMouseX = event.offsetX;
    const rawMouseY = event.offsetY;

    // Calculate the clamped mouseX.
    // The goal is to set this.mouseX such that the tooltip, when positioned at
    // (this.mouseX + this.tooltipOffsetX, this.mouseY + this.tooltipOffsetY),
    // stays within the SVG boundaries.

    // Minimum value for this.mouseX: -this.tooltipOffsetX
    // This ensures (this.mouseX + this.tooltipOffsetX) >= 0
    const minClampedX = -this.tooltipOffsetX;

    // Maximum value for this.mouseX: currentSvgWidth - this.tooltipWidth - this.tooltipOffsetX
    // This ensures (this.mouseX + this.tooltipOffsetX + this.tooltipWidth) <= currentSvgWidth
    const maxClampedX = currentSvgWidth - this.tooltipWidth - this.tooltipOffsetX;

    this.mouseX = Math.max(minClampedX, Math.min(rawMouseX, maxClampedX));

    // Calculate the clamped mouseY similarly.

    // Minimum value for this.mouseY: -this.tooltipOffsetY
    // This ensures (this.mouseY + this.tooltipOffsetY) >= 0
    const minClampedY = -this.tooltipOffsetY;

    // Maximum value for this.mouseY: currentSvgHeight - this.tooltipHeight - this.tooltipOffsetY
    // This ensures (this.mouseY + this.tooltipOffsetY + this.tooltipHeight) <= currentSvgHeight
    const maxClampedY = currentSvgHeight - this.tooltipHeight - this.tooltipOffsetY;

    this.mouseY = Math.max(minClampedY, Math.min(rawMouseY, maxClampedY));
  }
}
