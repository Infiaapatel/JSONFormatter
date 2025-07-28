import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { TextDiffService, DiffStats } from '../../Services/textdiff.service';

@Component({
  selector: 'app-text-diff',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './text-diff.component.html',
  styleUrls: ['./text-diff.component.css']
})
export class TextDiffComponent implements OnInit, AfterViewInit, OnDestroy {

  // Element references for editor containers
  @ViewChild('inputContainer', { static: true }) inputContainer!: ElementRef<HTMLElement>;
  @ViewChild('outputContainer', { static: true }) outputContainer!: ElementRef<HTMLElement>;
  @ViewChild('diffContainer', { static: true }) diffContainer!: ElementRef<HTMLElement>;
  // @ViewChild('fulldiffcontainer ', { static: false }) fulldiffcontainer !: ElementRef<HTMLElement>;
  @ViewChild('fulldiffcontainer ', { static: false }) fulldiffcontainer !: ElementRef<HTMLElement>;
  @ViewChild('leftBox', { static: true }) leftBox!: ElementRef<HTMLElement>;
  @ViewChild('rightBox', { static: true }) rightBox!: ElementRef<HTMLElement>;

  // Component state, mostly derived from the service
  isComparing = false;
  diffStats: DiffStats = { changeCount: 0, currentChangeIndex: 0, removalCount: 0, additionCount: 0, removalLines: 0, additionLines: 0 };
  isFormatting = false;
  formatStatus = '';

  private resizeHandler = () => this.textDiffService.layoutEditors();

  // Injecting TextDiffService and ChangeDetectorRef for managing state and UI updates
  constructor(
    public textDiffService: TextDiffService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  // #region Getters for Template Binding
  // These getters expose nested properties from diffStats directly to the template.
  get changeCount(): number {
    return this.diffStats.changeCount;
  }

  get removalCount(): number {
    return this.diffStats.removalCount;
  }

  get additionCount(): number {
    return this.diffStats.additionCount;
  }
  // #endregion

  ngOnInit(): void {
    // Subscribe to diff stat changes from the service
    this.textDiffService.setOnDiffStatsChange((stats: DiffStats) => {
      this.zone.run(() => {
        this.diffStats = stats;
        this.isComparing = this.textDiffService.isComparing();
        this.cdr.detectChanges(); // Manually trigger change detection
      });
    });
  }

  ngAfterViewInit(): void {
    // Initialize editors after the view is ready
    this.textDiffService.initializeEditors(
      this.inputContainer.nativeElement,
      this.outputContainer.nativeElement,
      {
        theme: 'vs-light',
        fontSize: 14,
        wordWrap: 'on',
        folding: true // Ensure folding is enabled
      }
    );
    this.textDiffService.layoutEditors();
    window.addEventListener('resize', this.resizeHandler);
  }

  // Listen for keyboard shortcuts to navigate changes
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.isComparing || this.diffStats.changeCount === 0) {
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.navigateToPreviousChange();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigateToNextChange();
    }

    // Format shortcuts (Ctrl+Shift+I for format, like VS Code Alt+Shift+F)
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'I') {
      event.preventDefault();
      this.formatBothEditors();
    }
  }

  // #region Methods for Template (HTML)
  // These methods are called directly by the template and were restored to fix the errors.

  async startComparison(): Promise<void> {
    try {
      this.isFormatting = true;
      this.formatStatus = 'Formatting and comparing...';
      this.cdr.detectChanges();

      await this.textDiffService.startComparison(this.diffContainer.nativeElement);
      this.isComparing = this.textDiffService.isComparing();

      this.formatStatus = 'Comparison complete!';
      setTimeout(() => {
        this.formatStatus = '';
        this.cdr.detectChanges();
      }, 2000);
    } catch (error) {
      console.error('Failed to start comparison:', error);
      this.formatStatus = 'Comparison failed!';
      setTimeout(() => {
        this.formatStatus = '';
        this.cdr.detectChanges();
      }, 3000);
    } finally {
      this.isFormatting = false;
      this.cdr.detectChanges();
    }
  }

  stopComparison(): void {
    this.textDiffService.stopComparison();
    this.isComparing = this.textDiffService.isComparing();
  }

  navigateToNextChange(): void {
    this.textDiffService.navigateToNextChange();
  }

  navigateToPreviousChange(): void {
    this.textDiffService.navigateToPreviousChange();
  }

  copyClipboard(target: 'input' | 'output' | 'diff-modified'): void {
    const content = this.textDiffService.getEditorContent(target);

    if (!content) {
      console.warn('No content to copy.');
      return;
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => console.log('Content copied to clipboard.'))
        .catch(err => console.error('Failed to copy content:', err));
    } else {
      // Fallback for unsupported environments
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed'; // Prevents scroll jump
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        const success = document.execCommand('copy');
        console.log(success ? 'Fallback: content copied!' : 'Fallback: copy failed.');
      } catch (err) {
        console.error('Fallback: error copying content', err);
      }

      document.body.removeChild(textarea);
    }
  }


  // New formatting methods
  async formatEditor(editorType: 'input' | 'output'): Promise<void> {
    try {
      this.isFormatting = true;
      this.formatStatus = `Formatting ${editorType === 'input' ? 'original' : 'modified'} text...`;
      this.cdr.detectChanges();

      await this.textDiffService.formatEditor(editorType);

      this.formatStatus = 'Formatting complete!';
      setTimeout(() => {
        this.formatStatus = '';
        this.cdr.detectChanges();
      }, 2000);
    } catch (error) {
      console.error(`Failed to format ${editorType}:`, error);
      this.formatStatus = 'Formatting failed!';
      setTimeout(() => {
        this.formatStatus = '';
        this.cdr.detectChanges();
      }, 3000);
    } finally {
      this.isFormatting = false;
      this.cdr.detectChanges();
    }
  }

  async formatBothEditors(): Promise<void> {
    try {
      this.isFormatting = true;
      this.formatStatus = 'Formatting both editors...';
      this.cdr.detectChanges();

      await Promise.all([
        this.textDiffService.formatEditor('input'),
        this.textDiffService.formatEditor('output')
      ]);

      this.formatStatus = 'Both editors formatted!';
      setTimeout(() => {
        this.formatStatus = '';
        this.cdr.detectChanges();
      }, 2000);
    } catch (error) {
      console.error('Failed to format editors:', error);
      this.formatStatus = 'Formatting failed!';
      setTimeout(() => {
        this.formatStatus = '';
        this.cdr.detectChanges();
      }, 3000);
    } finally {
      this.isFormatting = false;
      this.cdr.detectChanges();
    }
  }

  // Get detected language for display
  getDetectedLanguage(editorType: 'input' | 'output'): string {
    const content = this.textDiffService.getEditorContent(editorType);
    if (!content.trim()) return 'plaintext';

    // This is a simplified version - you might want to expose the detectLanguage method from the service
    const sample = content.toLowerCase().substring(0, 1000);

    if (sample.includes('function') || sample.includes('const') || sample.includes('let')) return 'javascript';
    if (sample.includes('def ') || sample.includes('import ')) return 'python';
    if (sample.includes('<?php')) return 'php';
    if (sample.includes('<!doctype') || sample.includes('<html')) return 'html';
    if (sample.includes('SELECT') || sample.includes('select')) return 'sql';
    if (sample.includes('#include')) return 'cpp';
    if (sample.includes('public class')) return 'java';

    return 'plaintext';
  }
  // #endregion

  // Clears the content of a specified editor
  clearEditor(editorType: 'input' | 'output'): void {
    this.textDiffService.clearEditor(editorType);
  }

  toggleFullScreen(side: 'left' | 'right' | 'diff'): void {
    let element: HTMLElement;
    switch (side) {
      case 'left':
        element = this.leftBox.nativeElement;
        break;
      case 'right':
        element = this.rightBox.nativeElement;
        break;
      case 'diff':
        if (!this.fulldiffcontainer) {
          console.error('fulldiffcontainer  is not defined. Ensure the element exists in the template.');
          return;
        }
        element = this.fulldiffcontainer.nativeElement;
        break;
      default:
        console.error('Invalid side specified:', side);
        return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(err => console.error(`Error entering fullscreen:`, err));
    } else {
      document.exitFullscreen().catch(err => console.error(`Error exiting fullscreen:`, err));
    }
  }

  // Downloads the content of the output editor
  downloadContent(): void {
    const content = this.textDiffService.getEditorContent('output');
    if (!content) {
      console.warn('No content to download.');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified_text.txt';
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  // Handles file selection and reads content into the input editor
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      this.textDiffService.setEditorContent('input', content);
    };
    reader.onerror = (err) => console.error('Error reading file:', err);
    reader.readAsText(file);

    input.value = ''; // Reset for next selection
  }

  ngOnDestroy(): void {
    // Clean up resources to prevent memory leaks
    this.textDiffService.dispose();
    window.removeEventListener('resize', this.resizeHandler);
  }
}
