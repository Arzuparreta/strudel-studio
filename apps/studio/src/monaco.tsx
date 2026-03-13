/**
 * Monaco Editor wrapper for Strudel source.
 * Controlled component: value + onChange; parent owns source of truth.
 * @see docs/implementation-roadmap.md Task 1.9
 */

import { Editor } from "@monaco-editor/react";

export interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
}

export function MonacoEditor({
  value,
  onChange,
  height = "20rem",
}: MonacoEditorProps) {
  return (
    <div style={{ width: "100%", maxWidth: "48rem", border: "1px solid #ccc", borderRadius: "4px", overflow: "hidden" }}>
      <Editor
        height={height}
        language="javascript"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          minimap: { enabled: false },
          lineNumbers: "on",
          readOnly: false,
          wordWrap: "on",
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
