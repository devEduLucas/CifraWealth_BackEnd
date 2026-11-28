declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(options: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
    enableXfa?: boolean;
    stopAtErrors?: boolean;
    verbosity?: number;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
        cleanup(): void;
      }>;
    }>;
    destroy(): Promise<void>;
  };
}
