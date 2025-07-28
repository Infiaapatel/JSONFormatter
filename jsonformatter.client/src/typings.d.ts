declare const require: any;

declare namespace monaco {
  export namespace editor {
    export function create(element: HTMLElement, options: any): any;
  }
  export class Range {
    constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number);
  }
}