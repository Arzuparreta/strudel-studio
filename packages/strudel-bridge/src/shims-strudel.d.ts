declare module "@strudel/core" {
  // Minimal shim for Pattern type used in strudel-bridge.
  export type Pattern = any;
}

declare module "@strudel/web" {
  const mod: any;
  export = mod;
}

declare module "@strudel/webaudio" {
  export function samples(sampleMapOrUrl: string | Record<string, unknown>, baseUrl?: string, options?: unknown): Promise<void>;
  export function aliasBank(...args: unknown[]): Promise<void>;
  export function registerSynthSounds(): Promise<void>;
  export function registerZZFXSounds(): Promise<void>;
  export const soundMap: { get?: () => Record<string, unknown> | Map<string, unknown> };
}

declare module "@strudel/soundfonts" {
  export function registerSoundfonts(): Promise<void>;
}

declare module "superdough" {
  export function samples(sampleMapOrUrl: string | Record<string, unknown>, baseUrl?: string, options?: unknown): Promise<void>;
}

