declare module "@strudel/core" {
  // Minimal shim for Pattern type used in strudel-bridge.
  export type Pattern = any;
}

declare module "@strudel/web" {
  const mod: any;
  export = mod;
}

