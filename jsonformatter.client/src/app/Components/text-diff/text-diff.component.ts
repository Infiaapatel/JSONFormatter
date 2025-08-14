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

  // Element references for editor and container HTMLElements from the template.
  @ViewChild('inputContainer', { static: true }) inputContainer!: ElementRef<HTMLElement>;
  @ViewChild('outputContainer', { static: true }) outputContainer!: ElementRef<HTMLElement>;
  @ViewChild('diffContainer', { static: true }) diffContainer!: ElementRef<HTMLElement>;
  @ViewChild('fulldiffcontainer', { static: false }) fulldiffcontainer!: ElementRef<HTMLElement>;
  @ViewChild('leftBox', { static: true }) leftBox!: ElementRef<HTMLElement>;
  @ViewChild('rightBox', { static: true }) rightBox!: ElementRef<HTMLElement>;

  // Component state flags and data.
  isComparing = false;
  isFormatting = false;
  formatStatus = '';
  diffStats: DiffStats = { changeCount: 0, currentChangeIndex: -1, removalCount: 0, additionCount: 0, removalLines: 0, additionLines: 0 };

  // Handler for window resize events to relayout editors.
  private resizeHandler = () => this.textDiffService.layoutEditors();

  constructor(
    public textDiffService: TextDiffService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  // #region Getters for Template Binding
  // These getters simplify accessing nested properties from the template.
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
    // Subscribe to diff stat changes from the service to keep the UI in sync.
    this.textDiffService.setOnDiffStatsChange((stats: DiffStats) => {
      this.zone.run(() => {
        this.diffStats = stats;
        this.isComparing = this.textDiffService.isComparing();
        this.cdr.detectChanges(); // Manually trigger change detection for immediate UI update.
      });
    });
  }

  ngAfterViewInit(): void {
    // Initialize editors after the view and its elements are ready.
    this.textDiffService.initializeEditors(
      this.inputContainer.nativeElement,
      this.outputContainer.nativeElement,
      {
        theme: 'vs-light',
        fontSize: 14,
        wordWrap: 'on',
        folding: true
      }
    );
    // Perform initial layout and listen for window resize.
    this.textDiffService.layoutEditors();
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * HostListener for global keyboard shortcuts.
   * @param event - The keyboard event.
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Navigate changes with arrow keys when comparing.
    if (this.isComparing && this.diffStats.changeCount > 0) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.navigateToPreviousChange();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.navigateToNextChange();
      }
    }

    // Format shortcut (Ctrl+Shift+F).
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      this.formatBothEditors();
    }
  }

  // #region UI Action Methods
  // Methods called directly from the component's template (HTML).

  /**
   * Starts the text comparison process.
   */
  async startComparison(): Promise<void> {
    this.isComparing = true; // Set immediately for responsive UI
    await this.textDiffService.startComparison(this.diffContainer.nativeElement);
    // State will be fully updated via the service subscription.
  }

  /**
   * Stops the text comparison and returns to the standard editor view.
   */
  stopComparison(): void {
    this.textDiffService.stopComparison();
    this.isComparing = false;
  }

  /**
   * Navigates to the next difference in the diff view.
   */
  navigateToNextChange(): void {
    this.textDiffService.navigateToNextChange();
  }

  /**
   * Navigates to the previous difference in the diff view.
   */
  navigateToPreviousChange(): void {
    this.textDiffService.navigateToPreviousChange();
  }

  /**
   * Copies content from the specified editor to the clipboard.
   * @param target - Which editor's content to copy.
   */
  copyClipboard(target: 'input' | 'output' | 'diff-modified'): void {
    const content = this.textDiffService.getEditorContent(target);
    if (!content) {
      console.warn('No content to copy.');
      return;
    }
    navigator.clipboard.writeText(content)
      .then(() => console.log('Content copied to clipboard.'))
      .catch(err => console.error('Failed to copy content:', err));
  }

  /**
   * Formats the code in a specific editor.
   * @param editorType - The editor to format ('input' or 'output').
   */
  async formatEditor(editorType: 'input' | 'output'): Promise<void> {
    try {
      this.isFormatting = true;
      this.formatStatus = `Formatting ${editorType === 'input' ? 'original' : 'modified'} text...`;
      this.cdr.detectChanges();

      await this.textDiffService.formatEditor(editorType);

      this.formatStatus = 'Formatting complete!';
      setTimeout(() => { this.formatStatus = ''; this.cdr.detectChanges(); }, 2000);
    } catch (error) {
      console.error(`Failed to format ${editorType}:`, error);
      this.formatStatus = 'Formatting failed!';
      setTimeout(() => { this.formatStatus = ''; this.cdr.detectChanges(); }, 3000);
    } finally {
      this.isFormatting = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Formats the code in both editors simultaneously.
   */
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
      setTimeout(() => { this.formatStatus = ''; this.cdr.detectChanges(); }, 2000);
    } catch (error) {
      console.error('Failed to format editors:', error);
      this.formatStatus = 'Formatting failed!';
      setTimeout(() => { this.formatStatus = ''; this.cdr.detectChanges(); }, 3000);
    } finally {
      this.isFormatting = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Clears all text from the specified editor.
   * @param editorType - The editor to clear.
   */
  clearEditor(editorType: 'input' | 'output'): void {
    this.textDiffService.clearEditor(editorType);
  }

  /**
   * Toggles fullscreen mode for a specific editor container.
   * @param side - The container to make fullscreen.
   */
  toggleFullScreen(side: 'left' | 'right' | 'diff'): void {
    let element: HTMLElement | undefined;
    switch (side) {
      case 'left':
        element = this.leftBox.nativeElement;
        break;
      case 'right':
        element = this.rightBox.nativeElement;
        break;
      case 'diff':
        element = this.fulldiffcontainer?.nativeElement;
        break;
    }

    if (!element) {
      console.error('Fullscreen element not found for side:', side);
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(err => console.error(`Error entering fullscreen:`, err));
    } else {
      document.exitFullscreen().catch(err => console.error(`Error exiting fullscreen:`, err));
    }
  }

  /**
   * Downloads the content of the modified text editor as a .txt file.
   */
  downloadContent(): void {
    const content = this.textDiffService.getEditorContent('output');
    if (!content) {
      console.warn('No content to download.');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified_text.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * Handles file selection, reads the file content, and places it in the input editor.
   * @param event - The file input change event.
   */
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

    // Reset the input to allow selecting the same file again.
    input.value = '';
  }
  // #endregion

  ngOnDestroy(): void {
    // Clean up resources to prevent memory leaks.
    this.textDiffService.dispose();
    window.removeEventListener('resize', this.resizeHandler);
  }
}
