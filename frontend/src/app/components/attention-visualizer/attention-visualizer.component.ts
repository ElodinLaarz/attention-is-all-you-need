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

  // Layout and positioning constants
  private readonly MIN_TOKEN_WIDTH: number = 60;
  private readonly TOKEN_PADDING: number = 20;
  private readonly TOKEN_Y_BASE: number = 80; // Base Y position for first row
  private readonly ROW_HEIGHT: number = 120; // Height between rows
  private readonly CURVE_HEIGHT_BASE: number = 80; // Base height for attention curves
  private readonly START_PADDING: number = 40; // Starting X padding for tokens
  private readonly TOKEN_GAP: number = 10; // Gap between tokens
  private readonly TOKEN_HEIGHT_OFFSET: number = 25; // Offset from token center for path start/end
  private readonly SVG_PADDING: number = 40; // Padding around SVG content
  private readonly MIN_SVG_WIDTH: number = 400; // Minimum SVG width
  private readonly MIN_SVG_HEIGHT: number = 200; // Minimum SVG height
  private readonly SVG_HEIGHT_PADDING: number = 50; // Extra padding for SVG height calculation

  // Attention thresholds and limits
  private readonly ALL_ATTENTION_THRESHOLD: number = 0.02; // Threshold for showing attention in overview mode
  private readonly FOCUSED_ATTENTION_THRESHOLD: number = 0.01; // Threshold for focused token attention
  private readonly TOP_ATTENTION_LIMIT: number = 5; // Maximum number of attention connections to show
  private readonly INCOMING_ATTENTION_DIMMING: number = 0.6; // Factor to dim incoming attention paths

  // Curve and path styling constants
  private readonly CURVE_DISTANCE_FACTOR: number = 0.15; // Factor for curve height based on distance
  private readonly MAX_CURVE_HEIGHT: number = 100; // Maximum height for same-row curves
  private readonly INTER_ROW_CONTROL_OFFSET: number = 60; // Control point offset for inter-row paths
  private readonly INTER_ROW_HEIGHT_OFFSET: number = 50; // Height offset for inter-row control points
  private readonly DISTANT_ROW_HEIGHT_FACTOR: number = 50; // Height factor for distant row paths

  // Tooltip configuration constants
  public readonly tooltipWidth: number = 200; // Width of the tooltip <foreignObject>
  public readonly tooltipHeight: number = 60; // Height of the tooltip <foreignObject>
  public readonly tooltipOffsetX: number = 10; // X offset for tooltip from mouseX
  public readonly tooltipOffsetY: number = 20; // Y offset for tooltip from mouseY

  // Timing constants
  private readonly HOVER_END_TIMEOUT: number = 50; // Timeout for hover end to prevent flickering

  // Font and text constants
  private readonly CANVAS_FONT: string = '14px monospace'; // Font for text measurement

  // HTML template constants
  public readonly STROKE_WIDTH_MULTIPLIER: number = 15; // Multiplier for path stroke width
  public readonly MIN_STROKE_WIDTH: number = 3; // Minimum stroke width for paths
  public readonly HOVER_STROKE_MULTIPLIER: number = 1.5; // Multiplier for hovered stroke width
  public readonly OPACITY_MULTIPLIER: number = 0.8; // Multiplier for path opacity
  public readonly OPACITY_OFFSET: number = 0.2; // Base opacity offset
  public readonly MIN_OPACITY: number = 0.5; // Minimum opacity for paths
  public readonly TOKEN_RECT_HEIGHT: number = 30; // Height of token background rectangles
  public readonly TOKEN_RECT_Y_OFFSET: number = 20; // Y offset for token rectangles
  public readonly TOKEN_TEXT_Y_OFFSET: number = 5; // Y offset for token text
  public readonly TOKEN_BORDER_RADIUS: number = 4; // Border radius for token rectangles
  public readonly ROW_DIVIDER_PADDING: number = 20; // Padding for row divider lines
  public readonly ROW_LABEL_Y_OFFSET: number = 45; // Y offset for row labels

  // SCSS-related constants (exposed for potential future dynamic styling)
  public readonly VISUALIZER_PADDING: number = 20; // Container padding
  public readonly VISUALIZER_BORDER_RADIUS: number = 8; // Container border radius
  public readonly SVG_BORDER_RADIUS: number = 6; // SVG border radius
  public readonly SVG_MARGIN_TOP: number = 10; // SVG top margin
  public readonly CONTROLS_GAP: number = 20; // Gap between control elements
  public readonly CONTROLS_MARGIN_BOTTOM: number = 10; // Controls bottom margin
  public readonly LEGEND_MARGIN_TOP: number = 15; // Legend top margin
  public readonly LEGEND_PADDING: number = 10; // Legend padding
  public readonly LEGEND_MIN_HEIGHT: number = 100; // Legend minimum height
  public readonly LEGEND_ITEM_GAP: number = 8; // Gap between legend items

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
    context.font = this.CANVAS_FONT; // Use constant instead of hardcoded font

    let currentX = this.START_PADDING; // Use constant instead of hardcoded 40
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
        currentX = this.START_PADDING; // Use constant instead of hardcoded 40
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

      currentX += tokenWidth + this.TOKEN_GAP; // Use constant instead of hardcoded 10
    });

    // Update number of rows
    this.numRows = currentRow + 1;

    // Update SVG dimensions based on content
    maxRowWidth = Math.max(maxRowWidth, currentX);
    this.svgWidth = Math.max(maxRowWidth + this.SVG_PADDING, this.MIN_SVG_WIDTH); // Use constants
    this.svgHeight = Math.max(
      this.TOKEN_Y_BASE + this.numRows * this.ROW_HEIGHT + this.SVG_HEIGHT_PADDING,
      this.MIN_SVG_HEIGHT
    ); // Use constants
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
        if (score > this.ALL_ATTENTION_THRESHOLD && fromIndex !== toIndex) {
          // Use constant instead of hardcoded 0.02
          allAttentionPairs.push({
            fromIndex,
            toIndex,
            score,
          });
        }
      });
    });

    // Sort by score in descending order and take top connections
    const topAttentionPairs = allAttentionPairs
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_ATTENTION_LIMIT); // Use constant instead of hardcoded 5

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
      if (score > this.FOCUSED_ATTENTION_THRESHOLD && activeTokenIndex !== toIndex) {
        // Use constant instead of hardcoded 0.01
        outgoingAttention.push({ toIndex, score });
      }
    });

    // Sort and take top outgoing connections
    outgoingAttention
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_ATTENTION_LIMIT) // Use constant instead of hardcoded 5
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
      if (score > this.FOCUSED_ATTENTION_THRESHOLD && fromIndex !== activeTokenIndex) {
        // Use constant instead of hardcoded 0.01
        incomingAttention.push({ fromIndex, score });
      }
    });

    // Sort and take top incoming connections
    incomingAttention
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_ATTENTION_LIMIT) // Use constant instead of hardcoded 5
      .forEach((pair) => {
        const path = this.createCurvedPath(pair.fromIndex, activeTokenIndex);
        this.attentionPaths.push({
          path,
          score: pair.score * this.INCOMING_ATTENTION_DIMMING, // Use constant instead of hardcoded 0.6
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
    const startY = fromPos.y - this.TOKEN_HEIGHT_OFFSET; // Use constant instead of hardcoded 25
    const endX = toPos.x;
    const endY = toPos.y - this.TOKEN_HEIGHT_OFFSET; // Use constant instead of hardcoded 25

    // Check if tokens are on different rows
    const sameLine = fromPos.row === toPos.row;

    if (sameLine) {
      // For tokens on the same row, use a simple arc
      // Calculate curve parameters
      const distance = Math.abs(endX - startX);
      // Use constants for curve height calculation
      const curveHeight = Math.min(
        this.CURVE_HEIGHT_BASE + distance * this.CURVE_DISTANCE_FACTOR,
        this.MAX_CURVE_HEIGHT
      );

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

      // Use constants for control point calculations
      const controlOffset = this.INTER_ROW_CONTROL_OFFSET;

      // Calculate control points for cubic Bézier
      const cp1x = startX + (isFromAbove ? controlOffset : -controlOffset);
      const cp1y = startY - this.INTER_ROW_HEIGHT_OFFSET;
      const cp2x = endX + (isFromAbove ? -controlOffset : controlOffset);
      const cp2y = endY - this.INTER_ROW_HEIGHT_OFFSET;

      // For distant rows, create control points that go higher
      if (rowDiff > 1) {
        // Adjust control points for better path visualization
        const heightFactor = rowDiff * this.DISTANT_ROW_HEIGHT_FACTOR;
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
    }, this.HOVER_END_TIMEOUT); // Use constant instead of hardcoded 50
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
