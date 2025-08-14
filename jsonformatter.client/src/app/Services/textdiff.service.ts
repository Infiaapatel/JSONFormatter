import { Injectable, NgZone } from '@angular/core';
import { MonacoService } from './monaco.service';

// Interfaces defining the structure for various options and stats.
export interface DiffStats {
  changeCount: number;
  currentChangeIndex: number;
  removalCount: number;
  additionCount: number;
  removalLines: number;
  additionLines: number;
}

export interface EditorOptions {
  theme?: string;
  fontSize?: number;
  wordWrap?: 'on' | 'off';
  minimap?: { enabled: boolean };
  lineNumbers?: 'on' | 'off';
  folding?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TextDiffService {
  // Monaco editor instance, loaded dynamically.
  private monaco: any;

  // Editor instances for original, modified, and diff views.
  private inputEditor: any = null;
  private outputEditor: any = null;
  private diffEditor: any = null;
  private diffChanges: any[] = [];

  // State management for diff statistics.
  private diffStats: DiffStats = this.getInitialDiffStats();
  private diffUpdateTimeout: any = null;
  private onDiffStatsChange?: (stats: DiffStats) => void;

  // Injecting MonacoService for dynamic loading and NgZone for running tasks inside Angular's zone.
  constructor(private zone: NgZone, private monacoService: MonacoService) { }

  /**
   * Ensures the Monaco editor library is loaded before any editor operations.
   */
  private async ensureMonacoLoaded(): Promise<void> {
    if (!this.monaco) {
      this.monaco = await this.monacoService.loadMonaco();
    }
  }

  /**
   * Returns the initial state for diff statistics.
   */
  private getInitialDiffStats(): DiffStats {
    return {
      changeCount: 0,
      currentChangeIndex: 0,
      removalCount: 0,
      additionCount: 0,
      removalLines: 0,
      additionLines: 0
    };
  }

  /**
   * Initializes the input and output Monaco editors with common options.
   * @param inputContainer - The HTMLElement for the original text editor.
   * @param outputContainer - The HTMLElement for the modified text editor.
   * @param options - Optional configuration for the editors.
   */
  public async initializeEditors(
    inputContainer: HTMLElement,
    outputContainer: HTMLElement,
    options?: EditorOptions
  ): Promise<void> {
    await this.ensureMonacoLoaded();

    const commonEditorOptions: any = {
      theme: options?.theme || 'vs-light',
      automaticLayout: true,
      wordWrap: options?.wordWrap || 'on',
      minimap: { enabled: options?.minimap?.enabled ?? false },
      fontSize: options?.fontSize || 14,
      folding: options?.folding ?? true,
      foldingStrategy: 'auto',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 7,
        horizontalScrollbarSize: 7
      },
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      formatOnPaste: true,
      formatOnType: true,
      insertSpaces: true,
      tabSize: 2,
      detectIndentation: true,
      language: 'plaintext' // Default language is set to plaintext
    };

    this.inputEditor = this.monaco.editor.create(inputContainer, {
      ...commonEditorOptions,
      placeholder: 'Enter your original text here...',
    });

    this.outputEditor = this.monaco.editor.create(outputContainer, {
      ...commonEditorOptions,
      placeholder: 'Enter your modified text here...',
    });

    this.setupEditorListeners();
  }

  /**
   * Sets up listeners for content changes in the editors to update the diff view in real-time.
   */
  private setupEditorListeners(): void {
    const setupListener = (editor: any, isOriginal: boolean) => {
      editor.onDidChangeModelContent(() => {
        if (this.isComparing()) {
          const diffModel = this.diffEditor?.getModel();
          if (diffModel) {
            const text = editor.getValue();
            const modelToUpdate = isOriginal ? diffModel.original : diffModel.modified;
            modelToUpdate.setValue(text);
            this.scheduleDiffCalculation();
          }
        }
      });
    };

    if (this.inputEditor) setupListener(this.inputEditor, true);
    if (this.outputEditor) setupListener(this.outputEditor, false);
  }

  /**
   * Starts the comparison process, creating and displaying the diff editor.
   * @param diffContainer - The HTMLElement to host the diff editor.
   */
  public async startComparison(diffContainer: HTMLElement): Promise<void> {
    await this.ensureMonacoLoaded();

    if (!this.inputEditor || !this.outputEditor) {
      throw new Error('Editors not initialized');
    }

    // Format both editors before comparing.
    await this.formatEditor('input');
    await this.formatEditor('output');

    const originalText = this.inputEditor.getValue();
    const modifiedText = this.outputEditor.getValue();

    this.initializeDiffEditor(diffContainer);

    // Create models for the diff editor.
    const originalModel = this.monaco.editor.createModel(originalText, 'plaintext');
    const modifiedModel = this.monaco.editor.createModel(modifiedText, 'plaintext');

    this.diffEditor!.setModel({ original: originalModel, modified: modifiedModel });
    this.scheduleDiffCalculation();
  }

  /**
   * Initializes the diff editor instance if it doesn't exist.
   * @param diffContainer - The HTMLElement for the diff editor.
   */
  private initializeDiffEditor(diffContainer: HTMLElement): void {
    if (this.diffEditor) {
      this.diffEditor.layout();
      return;
    }

    this.diffEditor = this.monaco.editor.createDiffEditor(diffContainer, {
      theme: 'vs-light',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      folding: true,
      renderSideBySide: true,
      ignoreTrimWhitespace: false,
      originalEditable: false,
      enableSplitViewResizing: true,
      renderIndicators: true,
      diffCodeLens: true,
    });

    // Recalculate diff stats whenever the diff is updated.
    this.diffEditor.onDidUpdateDiff(() => {
      this.zone.run(() => this.scheduleDiffCalculation());
    });
  }

  /**
   * Formats the content of a specified editor using Monaco's built-in formatter.
   * @param editorType - The editor to format ('input' or 'output').
   */
  public async formatEditor(editorType: 'input' | 'output'): Promise<void> {
    const editor = editorType === 'input' ? this.inputEditor : this.outputEditor;
    if (editor) {
      const formatAction = editor.getAction('editor.action.formatDocument');
      if (formatAction) {
        await formatAction.run();
      } else {
        console.warn(`Formatting not available for the current language.`);
      }
    }
  }

  /**
   * Schedules a diff calculation to run after a short delay to batch updates.
   */
  private scheduleDiffCalculation(): void {
    if (this.diffUpdateTimeout) clearTimeout(this.diffUpdateTimeout);
    this.diffUpdateTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.calculateDiffStats();
        if (this.onDiffStatsChange) {
          this.onDiffStatsChange(this.diffStats);
        }
      });
    }, 150);
  }

  /**
   * Calculates statistics about the differences (additions, removals, etc.).
   */
  private calculateDiffStats(): void {
    if (!this.diffEditor || !this.isComparing()) {
      this.diffStats = this.getInitialDiffStats();
      return;
    }

    this.diffChanges = this.diffEditor.getLineChanges() || [];
    let removalLines = 0;
    let additionLines = 0;
    let removalCount = 0;
    let additionCount = 0;

    this.diffChanges.forEach(change => {
      // A change can be a removal, an addition, or both (a modification).
      if (change.originalEndLineNumber > 0) {
        removalCount++;
        removalLines += (change.originalEndLineNumber - change.originalStartLineNumber + 1);
      }
      if (change.modifiedEndLineNumber > 0) {
        additionCount++;
        additionLines += (change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1);
      }
    });

    this.diffStats = {
      changeCount: this.diffChanges.length,
      currentChangeIndex: Math.min(this.diffStats.currentChangeIndex, Math.max(0, this.diffChanges.length - 1)),
      removalCount,
      additionCount,
      removalLines,
      additionLines,
    };
  }

  /**
   * Navigates to a specific change in the diff editor.
   */
  private navigateToSpecificChange(index: number): void {
    if (!this.diffEditor || index < 0 || index >= this.diffChanges.length) return;

    const change = this.diffChanges[index];
    const editor = this.diffEditor.getModifiedEditor();
    const lineNumber = change.modifiedStartLineNumber || change.originalStartLineNumber;

    if (lineNumber > 0) {
      editor.revealLineInCenter(lineNumber, this.monaco.editor.ScrollType.Smooth);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    }
  }

  /**
   * Navigates to the next difference in the diff view.
   */
  public navigateToNextChange(): void {
    if (this.diffStats.changeCount === 0) return;
    this.diffStats.currentChangeIndex = (this.diffStats.currentChangeIndex + 1) % this.diffStats.changeCount;
    this.navigateToSpecificChange(this.diffStats.currentChangeIndex);
    if (this.onDiffStatsChange) this.onDiffStatsChange(this.diffStats);
  }

  /**
   * Navigates to the previous difference in the diff view.
   */
  public navigateToPreviousChange(): void {
    if (this.diffStats.changeCount === 0) return;
    this.diffStats.currentChangeIndex = (this.diffStats.currentChangeIndex - 1 + this.diffStats.changeCount) % this.diffStats.changeCount;
    this.navigateToSpecificChange(this.diffStats.currentChangeIndex);
    if (this.onDiffStatsChange) this.onDiffStatsChange(this.diffStats);
  }

  /**
   * Clears the content of the specified editor.
   */
  public clearEditor(editorType: 'input' | 'output'): void {
    const editor = editorType === 'input' ? this.inputEditor : this.outputEditor;
    editor?.setValue('');
  }

  /**
   * Retrieves the content from a specified editor.
   */
  public getEditorContent(editorType: 'input' | 'output' | 'diff-modified'): string {
    switch (editorType) {
      case 'input': return this.inputEditor?.getValue() || '';
      case 'output': return this.outputEditor?.getValue() || '';
      case 'diff-modified': return this.diffEditor?.getModel()?.modified.getValue() || '';
      default: return '';
    }
  }

  /**
   * Sets the content of a specified editor.
   */
  public setEditorContent(editorType: 'input' | 'output', content: string): void {
    const editor = editorType === 'input' ? this.inputEditor : this.outputEditor;
    editor?.setValue(content);
  }

  /**
   * Forces a layout recalculation for all editors.
   */
  public layoutEditors(): void {
    setTimeout(() => {
      this.inputEditor?.layout();
      this.outputEditor?.layout();
      this.diffEditor?.layout();
    }, 50);
  }

  /**
   * Checks if the component is currently in comparison mode.
   */
  public isComparing(): boolean {
    return !!this.diffEditor?.getModel();
  }

  /**
   * Sets the callback function to be invoked when diff stats change.
   */
  public setOnDiffStatsChange(callback: (stats: DiffStats) => void): void {
    this.onDiffStatsChange = callback;
  }

  /**
   * Stops the comparison and disposes of the diff editor model.
   */
  public stopComparison(): void {
    if (this.diffEditor) {
      const model = this.diffEditor.getModel();
      this.diffEditor.setModel(null);
      if (model) {
        model.original?.dispose();
        model.modified?.dispose();
      }
    }
    this.diffStats = this.getInitialDiffStats();
    this.diffChanges = [];
    if (this.onDiffStatsChange) {
      this.onDiffStatsChange(this.diffStats);
    }
  }

  /**
   * Cleans up all editor instances to prevent memory leaks.
   */
  public dispose(): void {
    if (this.diffUpdateTimeout) clearTimeout(this.diffUpdateTimeout);
    this.inputEditor?.dispose();
    this.outputEditor?.dispose();
    this.diffEditor?.dispose();
    this.inputEditor = null;
    this.outputEditor = null;
    this.diffEditor = null;
  }
}
