// sql-formatter.component.ts

import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

import { HeaderComponent } from "../header/header.component";
import { MonacoService } from '../../Services/monaco.service'; // 1. Import MonacoService

import { format } from 'sql-formatter';

// 2. Remove the direct import: import * as monaco from 'monaco-editor';

@Component({
  selector: 'app-sql-formatter',
  standalone: true,
  templateUrl: './sql-formatter.component.html',
  styleUrl: './sql-formatter.component.css',
  imports: [CommonModule, FormsModule, HeaderComponent],
})
export class SqlFormatterComponent implements AfterViewInit, OnDestroy {
  // 3. Change editor types to `any`
  private inputEditor: any = null;
  private outputEditor: any = null;
  private monaco: any; // 4. Add a property to hold the monaco instance

  private inputChanges = new Subject<void>();

  inputValue: string = '';
  outputValue: string = '';

  searchQuery: string = '';
  searchResults: any[] = []; // Changed from monaco.editor.FindMatch[]
  currentSearchIndex: number = -1;
  isLeftFullscreen: boolean = false;
  isRightFullscreen: boolean = false;
  uppercaseKeywords: boolean = true;

  public inputLine: number = 1;
  public inputCol: number = 1;
  public outputLine: number = 1;
  public outputCol: number = 1;

  @ViewChild('leftBox') leftBox!: ElementRef;
  @ViewChild('rightBox') rightBox!: ElementRef;
  @ViewChild('editor') private editor!: ElementRef<HTMLElement>;
  @ViewChild('outputEditor') private outputEditorContainer!: ElementRef<HTMLElement>;

  // 5. Inject MonacoService
  constructor(private monacoService: MonacoService) { }

  // 6. Make ngAfterViewInit async to load the editor
  async ngAfterViewInit() {
    try {
      this.monaco = await this.monacoService.loadMonaco();
      this.initializeEditors();
    } catch (error) {
      console.error('Failed to load Monaco Editor:', error);
    }
  }

  // 7. Move editor creation to its own function
  private initializeEditors() {
    if (!this.monaco) return;

    this.inputEditor = this.monaco.editor.create(this.editor.nativeElement, {
      value: this.inputValue,
      language: 'sql',
      theme: 'vs',
      wordWrap: 'on',
      minimap: { enabled: false },
      automaticLayout: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 5,
        horizontalScrollbarSize: 5
      },
      folding: true,
      lineNumbers: 'on',
    });

    this.inputEditor.onDidChangeCursorPosition((e: any) => {
      this.inputLine = e.position.lineNumber;
      this.inputCol = e.position.column;
    });

    this.outputEditor = this.monaco.editor.create(this.outputEditorContainer.nativeElement, {
      value: this.outputValue,
      language: 'sql',
      theme: 'vs',
      wordWrap: 'on',
      minimap: { enabled: true },
      automaticLayout: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 5,
        horizontalScrollbarSize: 5
      },
      folding: true,
      lineNumbers: 'on',
    });

    this.outputEditor.onDidChangeCursorPosition((e: any) => {
      this.outputLine = e.position.lineNumber;
      this.outputCol = e.position.column;
    });

    this.inputEditor.onDidChangeModelContent(() => {
      this.inputValue = this.inputEditor!.getValue();
      this.inputChanges.next();
    });

    if (this.inputValue) this.onSqlConvert();

    this.inputChanges.pipe(debounceTime(300)).subscribe(() => this.onSqlConvert());
  }

  ngOnDestroy() {
    this.inputEditor?.dispose();
    this.outputEditor?.dispose();
  }

  // --- The rest of your component logic remains the same ---
  // onSqlConvert(), resetOptions(), etc. do not need changes.

  tabWidth: number = 5;
  useTabs: boolean = false;
  keywordCase: 'preserve' | 'upper' | 'lower' = 'preserve';
  dataTypeCase: 'preserve' | 'upper' | 'lower' = 'preserve';
  functionCase: 'preserve' | 'upper' | 'lower' = 'preserve';
  identifierCase: 'preserve' | 'upper' | 'lower' = 'preserve';
  indentStyle: 'standard' | 'tabularLeft' | 'tabularRight' = 'standard';
  expressionWidth: number = 50;
  linesBetweenQueries: number = 1;

  onSqlConvert() {
    const sqlInput = this.inputValue.trim();
    if (!sqlInput) {
      this.outputEditor?.setValue('Input is empty');
      return;
    }

    try {
      const formatted = format(sqlInput, {
        language: 'tsql',
        tabWidth: this.tabWidth,
        useTabs: this.useTabs,
        keywordCase: this.keywordCase,
        dataTypeCase: this.dataTypeCase,
        functionCase: this.functionCase,
        identifierCase: this.identifierCase,
        indentStyle: this.indentStyle,
        logicalOperatorNewline: 'after',
        expressionWidth: this.expressionWidth,
        linesBetweenQueries: this.linesBetweenQueries
      });

      this.outputEditor?.setValue(formatted);
    } catch (error: any) {
      this.outputEditor?.setValue(`Error: ${error.message}`);
    }
  }

  resetOptions() {
    this.tabWidth = 5;
    this.useTabs = false;
    this.keywordCase = 'preserve';
    this.dataTypeCase = 'preserve';
    this.functionCase = 'preserve';
    this.identifierCase = 'preserve';
    this.indentStyle = 'standard';
    this.expressionWidth = 50;
    this.linesBetweenQueries = 1;
    this.onOptionChange();
  }

  onOptionChange() {
    this.onSqlConvert();
  }

  downloadContent() {
    const content = this.outputEditor?.getValue() || '';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted-sql.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  copyClipboard(target: 'input' | 'output') {
    const content =
      target === 'input'
        ? this.inputEditor?.getValue()
        : this.outputEditor?.getValue();

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => console.log('Copied'))
        .catch(() => console.error('Clipboard copy failed'));
    } else {
      console.warn('Clipboard API not supported in this environment');
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      Array.from(input.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.inputValue += (reader.result as string) + '\n\n';
          this.inputEditor?.setValue(this.inputValue);
        };
        reader.readAsText(file);
      });
    }
    input.value = '';
  }

  toggleFullScreen(side: string) {
    const element = side === 'left' ? this.leftBox.nativeElement : this.rightBox.nativeElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      element.requestFullscreen().catch((err: any) => {
        console.error('Error enabling fullscreen:', err);
      });
    }
  }

  clearContent(target: 'input' | 'output') {
    if (target === 'input') {
      this.inputValue = '';
      this.inputEditor?.setValue('');
    } else {
      this.outputValue = '';
      this.outputEditor?.setValue('');
    }
  }

  sampleData: string = `WITH CUSTOMERORDERS AS ( SELECT c.CustomerID, c.Name AS CustomerName, COUNT(o.OrderID) AS TotalOrders, MAX(o.OrderDate) AS LastOrderDate, SUM(o.TotalAmount) AS TotalSpent, AVG(o.TotalAmount) AS AvgOrderValue FROM Customers c LEFT JOIN Orders o ON c.CustomerID = o.CustomerID GROUP BY c.CustomerID, c.Name ), RankedCustomers AS ( SELECT CustomerID, CustomerName, TotalOrders, LastOrderDate, TotalSpent, AvgOrderValue, RANK() OVER ( ORDER BY TotalSpent DESC ) AS SpendingRank FROM CustomerOrders ) SELECT rc.CustomerID, rc.CustomerName, rc.TotalOrders, rc.LastOrderDate, rc.TotalSpent, rc.AvgOrderValue, rc.SpendingRank, CASE WHEN rc.TotalSpent > 10000 THEN 'VIP' WHEN rc.TotalSpent BETWEEN 5000 AND 10000 THEN 'Regular' ELSE 'New Customer' END AS CustomerCategory FROM RankedCustomers rc ORDER BY rc.SpendingRank;`;

  onSampleData() {
    this.inputValue = this.sampleData;
    this.inputEditor?.setValue(this.sampleData);
  }
}