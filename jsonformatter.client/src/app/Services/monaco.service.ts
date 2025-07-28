
import { Injectable } from '@angular/core';

// This will be defined globally by the loader script.
declare const require: any;

@Injectable({
  providedIn: 'root'
})
export class MonacoService {
  private loadingPromise: Promise<void> | null = null;
  private monaco: any = null;

  constructor() {
    // The constructor is now empty. All logic is moved to loadMonaco().
  }

  public loadMonaco(): Promise<any> {
    // If we are already loading or have loaded, return the existing promise
    if (this.loadingPromise) {
      return this.loadingPromise.then(() => this.monaco);
    }

    // Create a new promise to load the editor
    this.loadingPromise = new Promise<void>((resolve, reject) => {
      // If monaco is already available, resolve immediately
      if ((window as any).monaco) {
        this.monaco = (window as any).monaco;
        resolve();
        return;
      }

      const onAmdLoaderLoad = () => {
        // Now that the loader is loaded, the global 'require' is available.
        // We can now configure it.
        require.config({
          paths: {
            vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
          }
        });

        // Load the main editor module
        require(
          ['vs/editor/editor.main'],
          (monaco: any) => {
            this.monaco = monaco;
            resolve();
          },
          (error: any) => {
            console.error('Error loading Monaco editor:', error);
            reject(error);
          }
        );
      };

      // Create a script tag to load the Monaco AMD loader (loader.js)
      const loaderScript: HTMLScriptElement = document.createElement('script');
      loaderScript.type = 'text/javascript';
      loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
      loaderScript.addEventListener('load', onAmdLoaderLoad);
      loaderScript.addEventListener('error', (err) => {
          console.error('Error loading Monaco loader script:', err);
          reject(err);
      });
      document.body.appendChild(loaderScript);
    });

    return this.loadingPromise.then(() => this.monaco);
  }
}
