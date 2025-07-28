import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../header/header.component';
import { JsonFormatterService } from '../../Services/json-formatter.service';
import { AuthService } from '../../Services/auth.service';
import { EncDecService } from '../../Services/EncDec.service';
import { MonacoService } from '../../Services/monaco.service'; // Add this import
import { Request } from '../../Model/Request.model';
import { SharedStateService } from '../../Shared/shared-state.service';

// Remove the monaco import and add these declarations
declare const require: any;
declare global {
  interface Window {
    monaco: any;
  }
}

@Component({
  selector: 'app-json-formatter',
  standalone: true,
  templateUrl: './json-formatter.component.html',
  styleUrls: ['./json-formatter.component.css'],
  imports: [CommonModule, FormsModule, HeaderComponent]
})
export class JsonFormatterComponent implements AfterViewInit, OnDestroy, OnInit {

  @ViewChild(JsonFormatterComponent) JsonFormatter!: JsonFormatterComponent;

  private _inputValue: string = '';
  private _outputValue: string = '';
  private inputEditor: any = null; // Changed from monaco.editor.IStandaloneCodeEditor
  private outputEditor: any = null; // Changed from monaco.editor.IStandaloneCodeEditor
  private monaco: any = null; // Store monaco instance
  public isLoggedIn: boolean = false;

  searchQuery: string = '';
  searchResults: any[] = []; // Changed from monaco.editor.FindMatch[]
  currentSearchIndex: number = -1;
  selectedLowerOperation: string = '';
  activeButton: string = '';

  public inputLine: number = 1;
  public inputCol: number = 1;
  public outputLine: number = 1;
  public outputCol: number = 1;
  private inputDecorations: string[] = [];

  @ViewChild('editorContainer') editorContainer!: ElementRef;
  @ViewChild('outputEditorContainer') outputEditorContainer!: ElementRef;

  constructor(
    private jsonService: JsonFormatterService,
    private authService: AuthService,
    private EncDecService: EncDecService,
    private monacoService: MonacoService,
    private sharedService: SharedStateService
  ) { }

  get inputValue(): string {
    return this._inputValue;
  }

  set inputValue(value: string) {
    this._inputValue = value;
    if (this.inputEditor) {
      this.inputEditor.setValue(value);
    }
  }

  get outputValue(): string {
    return this._outputValue;
  }

  set outputValue(value: string) {
    this._outputValue = value;
    if (this.outputEditor) {
      this.outputEditor.setValue(value);
    }
    this.onSearch();
  }

  ngOnInit() {
    this.sharedService.clearText$.subscribe(() => {
      this.outputValue = '';
    });
    this.authService.isLoggedIn$.subscribe((status) => {
      this.isLoggedIn = status;
    });
  }

  async ngAfterViewInit() {
    try {
      // Load Monaco from CDN
      this.monaco = await this.monacoService.loadMonaco();
      this.initializeEditors();
    } catch (error) {
      console.error('Failed to load Monaco Editor:', error);
    }
  }

  private initializeEditors() {
    if (!this.monaco) return;

    // Initialize input editor
    this.inputEditor = this.monaco.editor.create(this.editorContainer.nativeElement, {
      value: this.inputValue,
      language: 'json',
      theme: 'vs',
      wordWrap: 'on',
      minimap: { enabled: false },
      folding: true,
      fontSize: 14,
      automaticLayout: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 5,
        horizontalScrollbarSize: 5
      },
      lineNumbers: 'on',
    });

    this.inputEditor.onDidChangeModelContent(() => {
      this._inputValue = this.inputEditor!.getValue();
      this.clearErrorHighlighting();
    });

    this.inputEditor.onDidChangeCursorPosition((e: any) => {
      this.inputLine = e.position.lineNumber;
      this.inputCol = e.position.column;
    });

    // Initialize output editor
    this.outputEditor = this.monaco.editor.create(this.outputEditorContainer.nativeElement, {
      value: this.outputValue,
      language: 'json',
      theme: 'vs',
      wordWrap: 'on',
      minimap: { enabled: true },
      folding: true,
      fontSize: 14,
      automaticLayout: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 5,
        horizontalScrollbarSize: 5
      },
      lineNumbers: 'on',
    });

    this.outputEditor.onDidChangeModelContent(() => {
      this._outputValue = this.outputEditor!.getValue();
      this.onSearch();
    });

    this.outputEditor.onDidChangeCursorPosition((e: any) => {
      this.outputLine = e.position.lineNumber;
      this.outputCol = e.position.column;
    });
  }

  ngOnDestroy() {
    this.inputEditor?.dispose();
    this.outputEditor?.dispose();
  }

  private handleInvalidJson(errorMessage: string) {
    if (!this.monaco || !this.inputEditor) return;

    const match = errorMessage.match(/position (\d+)/);
    if (match) {
      const position = parseInt(match[1], 10);
      const model = this.inputEditor.getModel();
      if (model) {
        const pos = model.getPositionAt(position);
        this.inputDecorations = this.inputEditor.deltaDecorations(
          this.inputDecorations,
          [
            {
              range: new this.monaco.Range(pos.lineNumber, 1, pos.lineNumber, model.getLineMaxColumn(pos.lineNumber)),
              options: { isWholeLine: true, className: 'error-line-highlight' }
            }
          ]
        );
        this.inputEditor.revealPositionInCenter(pos);
      }
    }
  }

  private clearErrorHighlighting() {
    if (this.inputEditor) {
      this.inputDecorations = this.inputEditor.deltaDecorations(this.inputDecorations, []);
    }
  }

  onConvertJson() {
    try {
      this.clearErrorHighlighting();
      this.outputValue = this.jsonService.formatJson(this.inputValue);
    } catch (error: any) {
      if (error.message !== 'Input is empty.') {
        this.handleInvalidJson(error.message);
      }
    }
    this.activeButton = 'format';
  }

  onDecodeAndFormat() {
    try {
      this.clearErrorHighlighting();
      this.outputValue = this.jsonService.decodeAndFormat(this.inputValue);
    } catch (error: any) {
      // All feedback handled by the service
    }
    this.activeButton = 'decodeAndFormat';
  }

  OnConvertMinify() {
    try {
      this.clearErrorHighlighting();
      this.outputValue = this.jsonService.minifyJson(this.inputValue);
    } catch (error: any) {
      if (error.message !== 'Input is empty.') {
        this.handleInvalidJson(error.message);
      }
    }
    this.activeButton = 'minify';
  }

  onEncoded() {
    try {
      this.clearErrorHighlighting();
      this.outputValue = this.jsonService.encode(this.inputValue);
    } catch (error: any) {
      // All feedback handled by the service
    }
    this.activeButton = 'encode';
  }

  encrypt(value: string, target: string) {
    const requestData: Request = { plainText: value, target: target };
    this.EncDecService.encrypt(requestData).subscribe(encryptString => { this.outputValue = encryptString; })
    this.activeButton = `encrypt-${target}`;
  }

  decrypt(value: string, target: string) {
    const requestData: Request = { plainText: value, target: target };
    this.EncDecService.decrypt(requestData).subscribe(decryptString => { this.outputValue = decryptString; });
    this.activeButton = `decrypt-${target}`;
  }

  onSampleData() {
    this.inputValue = this.jsonService.getSampleData();
    this.clearErrorHighlighting();
  }

  FormatJson(value: 'input' | 'output') { 
    if(value == 'input'){
      this.inputValue = this.jsonService.formatJson(this.inputValue);
    }else{
      this.outputValue = this.jsonService.formatJson(this.outputValue);
    }
 
  }

  CompactJson(value: 'input' | 'output') {
    if(value == 'input'){
      this.inputValue = this.jsonService.minifyJson(this.inputValue);
    }else{
      this.outputValue = this.jsonService.minifyJson(this.outputValue);
    }
  }

  moveData() { 
    const content = this.outputEditor
    if(content){
      this.inputValue = this.outputValue; 
    }
    this.clearErrorHighlighting(); 
  }

  onSearch() {
    if (!this.outputEditor || !this.searchQuery.trim()) return;
    const model = this.outputEditor.getModel();
    if (!model) return;
    this.searchResults = model.findMatches(this.searchQuery, true, false, true, null, true);
    this.currentSearchIndex = this.searchResults.length > 0 ? 0 : -1;
    this.highlightCurrentMatch();
  }

  navigateSearch(next: boolean) {
    if (this.searchResults.length === 0 || !this.outputEditor) return;
    this.currentSearchIndex = next
      ? (this.currentSearchIndex + 1) % this.searchResults.length
      : (this.currentSearchIndex - 1 + this.searchResults.length) % this.searchResults.length;
    this.highlightCurrentMatch();
  }

  private highlightCurrentMatch() {
    if (this.currentSearchIndex < 0 || !this.outputEditor) return;
    const match = this.searchResults[this.currentSearchIndex];
    this.outputEditor.revealRangeInCenter(match.range);
    this.outputEditor.setSelection(match.range);
  }

  downloadContent() {
    const textContent = this.outputValue || 'No content';
    const isJSON = this.jsonService.checkInput(textContent).isValid;
    const extension = isJSON ? 'json' : 'txt';
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `json_output.${extension}`;
    a.click();
    window.URL.revokeObjectURL(url);
  }


  copyClipboard(text: string): void {
    if (!text) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => console.log('Copied!'))
        .catch(err => console.error('Copy failed:', err));
    } else {
      console.warn('Clipboard API not supported.');
    }
  }


  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      Array.from(input.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const content = reader.result as string;
            this.inputValue = content;
            this.onConvertJson();
          } catch (e: any) {
          }
        };
        reader.readAsText(file);
      });
    }
    input.value = '';
  }

  toggleFullScreen(side: string) {
    const leftBox = document.querySelector('.left-box') as HTMLElement;
    const rightBox = document.querySelector('.right-box') as HTMLElement;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      const element = side === 'left' ? leftBox : rightBox;
      element?.requestFullscreen().catch(console.error);
    }
  }

  clearContent(target: 'input' | 'output' | 'both' = 'both') {
    if (target === 'input' || target === 'both') {
      this.inputValue = '';
      this.clearErrorHighlighting();
    }
    if (target === 'output' || target === 'both') {
      this.outputValue = '';
      this.searchQuery = '';
      this.searchResults = [];
      this.currentSearchIndex = -1;
    }
  }
}
