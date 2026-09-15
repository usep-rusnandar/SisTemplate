declare module "@babel/standalone" {
  export type TransformOptions = {
    filename?: string;
    presets?: unknown[];
    sourceType?: "script" | "module" | "unambiguous";
  };

  export function transform(
    source: string,
    options?: TransformOptions,
  ): {
    code?: string;
  };
}
