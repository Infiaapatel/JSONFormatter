import { Injectable, NgZone } from '@angular/core';
import { MonacoService } from './monaco.service';


@Injectable({
  providedIn: 'root'
})


export class TextDiffService {
  // 3. Add a property to hold the dynamically loaded monaco object
  private monaco: any;

  // 4. Change the editor and diff types from the monaco namespace to 'any'
  private inputEditor: any = null;
  private outputEditor: any = null;
  private diffEditor: any = null;
  private diffChanges: any[] = [];

  private diffStats: DiffStats = this.getInitialDiffStats();
  private diffUpdateTimeout: any = null;
  private onDiffStatsChange?: (stats: DiffStats) => void;

  private readonly monacoSupportedLanguages = new Set([
    'typescript', 'javascript', 'json', 'html', 'css', 'scss', 'less',
    'xml', 'yaml', 'sql', 'markdown', 'php'
  ]);

  // 5. Inject MonacoService into the constructor
  constructor(private zone: NgZone, private monacoService: MonacoService) { }

  private async ensureMonacoLoaded(): Promise<void> {
    if (!this.monaco) {
      this.monaco = await this.monacoService.loadMonaco();
    }
  }

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
        verticalScrollbarSize: 5,
        horizontalScrollbarSize: 5
      },
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      formatOnPaste: true,
      formatOnType: true,
      insertSpaces: true,
      tabSize: 2,
      detectIndentation: true
    };

    this.inputEditor = this.monaco.editor.create(inputContainer, {
      ...commonEditorOptions,
      language: 'plaintext',
      placeholder: 'Enter your original text here...',
    });

    this.outputEditor = this.monaco.editor.create(outputContainer, {
      ...commonEditorOptions,
      language: 'plaintext',
      placeholder: 'Enter your modified text here...',
    });

    this.setupEditorListeners();
  }

  private setupEditorListeners(): void {
    const setupListener = (editor: any, isOriginal: boolean) => {
      editor.onDidChangeModelContent(() => {
        const text = editor.getValue();
        const language = this.detectLanguage(text);
        this.monaco.editor.setModelLanguage(editor.getModel()!, language);

        if (this.isComparing()) {
          const diffModel = this.diffEditor?.getModel();
          if (diffModel) {
            const modelToUpdate = isOriginal ? diffModel.original : diffModel.modified;
            modelToUpdate.setValue(text);
            this.monaco.editor.setModelLanguage(modelToUpdate, language);
            this.scheduleDiffCalculation();
          }
        }
      });
    };

    if (this.inputEditor) setupListener(this.inputEditor, true);
    if (this.outputEditor) setupListener(this.outputEditor, false);
  }

  public async startComparison(diffContainer: HTMLElement): Promise<void> {
    await this.ensureMonacoLoaded();

    if (!this.inputEditor || !this.outputEditor) {
      throw new Error('Editors not initialized');
    }

    await this.formatEditorContent(this.inputEditor);
    await this.formatEditorContent(this.outputEditor);

    const originalText = this.inputEditor.getValue();
    const modifiedText = this.outputEditor.getValue();
    const originalLanguage = this.detectLanguage(originalText);
    const modifiedLanguage = this.detectLanguage(modifiedText);

    this.initializeDiffEditor(diffContainer);

    const originalModel = this.monaco.editor.createModel(originalText, originalLanguage);
    const modifiedModel = this.monaco.editor.createModel(modifiedText, modifiedLanguage);

    this.diffEditor!.setModel({ original: originalModel, modified: modifiedModel });
    this.scheduleDiffCalculation();
  }

  private initializeDiffEditor(diffContainer: HTMLElement): void {
    if (this.diffEditor) {
      this.diffEditor.layout();
      return;
    }

    this.diffEditor = this.monaco.editor.createDiffEditor(diffContainer, {
      theme: 'vs-light',
      automaticLayout: true,
      wordWrap: 'on',
      diffWordWrap: 'on',
      minimap: { enabled: true },
      fontSize: 14,
      folding: true,
      renderSideBySide: true,
      ignoreTrimWhitespace: false,
      originalEditable: false,
      enableSplitViewResizing: true,
      renderIndicators: true,
      diffCodeLens: true,
    });

    this.diffEditor.onDidUpdateDiff(() => {
      this.zone.run(() => this.scheduleDiffCalculation());
    });
  }

  private navigateToSpecificChange(index: number): void {
    if (!this.diffEditor || index >= this.diffChanges.length) return;

    const change = this.diffChanges[index];
    const editor = this.diffEditor.getModifiedEditor();
    const lineNumber = change.modifiedStartLineNumber || change.originalStartLineNumber;

    if (lineNumber > 0) {
      editor.revealLineInCenter(lineNumber, this.monaco.editor.ScrollType.Smooth);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    }
  }

  public clearEditor(editorType: 'input' | 'output'): void {
    const editor = editorType === 'input' ? this.inputEditor : this.outputEditor;
    if (editor) {
      editor.setValue('');
      this.monaco.editor.setModelLanguage(editor.getModel()!, 'plaintext');
    }
  }

  private detectLanguage(text: string): string {
    const trimmedText = text.trim();
    const sample = trimmedText.substring(0, 5000).toLowerCase();
    if (sample.startsWith('<?xml')) return 'xml';
    if (sample.startsWith('<!doctype html') || sample.startsWith('<html')) return 'html';
    if (sample.startsWith('<?php')) return 'php';
    if (sample.startsWith('#!/usr/bin/env python') || sample.startsWith('#!/usr/bin/python')) return 'python';
    if ((trimmedText.startsWith('{') && trimmedText.endsWith('}')) || (trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
      try { JSON.parse(trimmedText); return 'json'; } catch (e) { }
    }
    if (/^---\s*$/m.test(trimmedText) || /^\s*[\w-]+:\s*.+/m.test(trimmedText)) return 'yaml';
    if (/\b(select\s+[\w*,\s]+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+(table|view|database))\b/i.test(sample)) return 'sql';
    if (/\b(def\s+\w+\s*\(|class\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import)\b/.test(trimmedText)) return 'python';
    if (/#include\s*[<"]/.test(sample) || /using\s+namespace\s+std;/.test(sample) || /\b(cout|cin|endl)\b/.test(sample)) return 'cpp';
    if (/using\s+System;/.test(trimmedText) || /\b(namespace|public\s+class|private\s+|protected\s+)\b/.test(sample)) return 'csharp';
    if (/public\s+static\s+void\s+main/.test(sample) || /import\s+java\./.test(sample) || /\b(System\.out\.println|public\s+class\s+\w+)\b/.test(sample)) return 'java';
    if (/\b(interface|type|enum|declare|namespace)\s+\w+/.test(sample) || /:\s*(string|number|boolean|any|void|Array<|Promise<)/.test(sample) || /\w+\?\s*:/.test(sample)) return 'typescript';
    if (/\b(function|const|let|var|import|export|async|await)\b/.test(sample) || /=>\s*[{(]/.test(sample) || /document\.(getElementById|querySelector)/.test(sample)) return 'javascript';
    if (/[@$][\w-]+\s*:/.test(sample)) return 'scss';
    if (/@[\w-]+\s*:/.test(sample)) return 'less';
    if (/[#.]?[\w-]+(\s*[,>+~]\s*[#.]?[\w-]+)*\s*\{/.test(trimmedText)) return 'css';
    if (/\b(def|end|class|module|puts|require|yield)\b/.test(sample) && !/\b(function|var|const|let)\b/.test(sample)) return 'ruby';
    if (/package\s+main/.test(sample) || /\b(func|import|fmt\.Print)\b/.test(sample)) return 'go';
    if (/^#{1,6}\s+/.test(trimmedText) || /```[\w]*/.test(trimmedText) || /^\s*[-*+]\s+/.test(trimmedText) || /\[.*\]\(.*\)/.test(sample)) return 'markdown';
    if (/^#!/.test(trimmedText) || /\b(echo|cd|ls|mkdir|grep|awk|sed)\b/.test(sample)) return 'shell';
    return 'plaintext';
  }

  private async formatEditorContent(editor: any): Promise<void> {
    const model = editor.getModel();
    if (!model) return;
    const language = model.getLanguageId();
    const content = model.getValue();

    try {
      if (this.monacoSupportedLanguages.has(language)) {
        await this.useMonacoFormatter(editor);
      } else {
        const formattedContent = await this.customFormat(content, language);
        if (formattedContent !== content) model.setValue(formattedContent);
      }
    } catch (error) {
      console.warn(`Failed to format ${language} content:`, error);
      const basicFormatted = this.basicFormat(content);
      if (basicFormatted !== content) model.setValue(basicFormatted);
    }
  }

  private async useMonacoFormatter(editor: any): Promise<void> {
    const formatAction = editor.getAction('editor.action.formatDocument');
    if (formatAction) await formatAction.run();
  }

  private async customFormat(content: string, language: string): Promise<string> {
    const options: CustomFormatOptions = {
      indentSize: 2,
      insertSpaces: true,
      trimTrailingWhitespace: true,
      insertFinalNewline: true
    };
    switch (language) {
      case 'python': return this.formatPython(content, options);
      case 'ruby': return this.formatRuby(content, options);
      case 'go': return this.formatGo(content, options);
      case 'shell': return this.formatShell(content, options);
      case 'cpp':
      case 'csharp':
      case 'java': return this.formatCStyleLanguage(content, options);
      default: return this.basicFormat(content, options);
    }
  }

  private formatPython(content: string, options: CustomFormatOptions): string { return content; }
  private formatRuby(content: string, options: CustomFormatOptions): string { return content; }
  private formatGo(content: string, options: CustomFormatOptions): string { return content; }
  private formatShell(content: string, options: CustomFormatOptions): string { return content; }
  private formatCStyleLanguage(content: string, options: CustomFormatOptions): string { return content; }
  private basicFormat(content: string, options?: CustomFormatOptions): string { return content; }
  private generateIndent(level: number, options: CustomFormatOptions): string {
    const indentChar = options.insertSpaces ? ' '.repeat(options.indentSize) : '\t';
    return indentChar.repeat(level);
  }

  private scheduleDiffCalculation(): void {
    if (this.diffUpdateTimeout) clearTimeout(this.diffUpdateTimeout);
    this.diffUpdateTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.calculateDiffChanges();
        if (this.onDiffStatsChange) {
          this.onDiffStatsChange(this.diffStats);
        }
      });
    }, 150);
  }

  private calculateDiffChanges(): void {
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

  public navigateToNextChange(): void {
    if (this.diffStats.changeCount === 0) return;
    this.diffStats.currentChangeIndex = (this.diffStats.currentChangeIndex + 1) % this.diffStats.changeCount;
    this.navigateToSpecificChange(this.diffStats.currentChangeIndex);
  }

  public navigateToPreviousChange(): void {
    if (this.diffStats.changeCount === 0) return;
    this.diffStats.currentChangeIndex = (this.diffStats.currentChangeIndex - 1 + this.diffStats.changeCount) % this.diffStats.changeCount;
    this.navigateToSpecificChange(this.diffStats.currentChangeIndex);
  }

  public getEditorContent(editorType: 'input' | 'output' | 'diff-modified'): string {
    switch (editorType) {
      case 'input': return this.inputEditor?.getValue() || '';
      case 'output': return this.outputEditor?.getValue() || '';
      case 'diff-modified': return this.diffEditor?.getModel()?.modified.getValue() || '';
      default: return '';
    }
  }

  public setEditorContent(editorType: 'input' | 'output', content: string): void {
    const editor = editorType === 'input' ? this.inputEditor : this.outputEditor;
    editor?.setValue(content);
  }

  public layoutEditors(): void {
    setTimeout(() => {
      this.inputEditor?.layout();
      this.outputEditor?.layout();
      this.diffEditor?.layout();
    }, 50);
  }

  public isComparing(): boolean {
    return !!this.diffEditor?.getModel();
  }

  public getDiffStats(): DiffStats {
    return { ...this.diffStats };
  }

  public setOnDiffStatsChange(callback: (stats: DiffStats) => void): void {
    this.onDiffStatsChange = callback;
  }

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

  public dispose(): void {
    if (this.diffUpdateTimeout) clearTimeout(this.diffUpdateTimeout);
    this.inputEditor?.dispose();
    this.outputEditor?.dispose();
    this.diffEditor?.dispose();
    this.inputEditor = null;
    this.outputEditor = null;
    this.diffEditor = null;
  }

  public async formatEditor(editorType: 'input' | 'output'): Promise<void> {
    const editor = editorType === 'input' ? this.inputEditor : this.outputEditor;
    if (editor) {
      await this.formatEditorContent(editor);
    }
  }
}

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

interface CustomFormatOptions {
  indentSize: number;
  insertSpaces: boolean;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
}
