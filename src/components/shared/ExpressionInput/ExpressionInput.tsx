/**
 * Expression Input Component
 *
 * Code editor with syntax highlighting, autocomplete, and live preview
 * for workflow expressions ({{ }} syntax)
 */

import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { defaultKeymap } from "@codemirror/commands";
import { EditorState, type Extension, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
} from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import type { ExpressionContext } from "@/server/lib/expressions";
import { evaluateTemplate, hasExpressions } from "@/server/lib/expressions";
import { cn } from "../../../lib/utils";

// ============================================================================
// SYNTAX HIGHLIGHTING FOR {{ }}
// ============================================================================

// Decoration marks for expression syntax
const expressionBraceMark = Decoration.mark({ class: "cm-expression-brace" });
const expressionContentMark = Decoration.mark({
  class: "cm-expression-content",
});

// StateField to track and decorate {{ }} expressions
const expressionHighlighter = StateField.define<DecorationSet>({
  create(state) {
    return decorateExpressions(state);
  },
  update(decorations, tr) {
    if (tr.docChanged) {
      return decorateExpressions(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function decorateExpressions(state: EditorState): DecorationSet {
  const decorations = [];
  const text = state.doc.toString();

  // Find all {{ }} expressions
  const regex = /\{\{([^}]*)\}\}/g;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Highlight opening {{
    decorations.push(expressionBraceMark.range(start, start + 2));

    // Highlight content between braces
    if (match[1]) {
      decorations.push(expressionContentMark.range(start + 2, end - 2));
    }

    // Highlight closing }}
    decorations.push(expressionBraceMark.range(end - 2, end));
  }

  return Decoration.set(decorations);
}

// ============================================================================
// AUTOCOMPLETE
// ============================================================================

interface AutocompleteSource {
  suggested: Completion[];
  earlierNodes: Completion[];
}

function createAutocompleteExtension(source: AutocompleteSource): Extension {
  return autocompletion({
    override: [
      (context: CompletionContext) => {
        const line = context.state.doc.lineAt(context.pos);
        const textBefore = line.text.slice(0, context.pos - line.from);

        // Check if we're typing inside {{ }}
        const match = textBefore.match(/\{\{\s*(\w*)$/);
        if (!match) return null;

        const prefix = match[1];
        const from = context.pos - prefix.length;

        // Combine suggestions with section headers
        const options: Completion[] = [];

        // Add SUGGESTED section
        if (source.suggested.length > 0) {
          options.push({
            label: "SUGGESTED",
            type: "text",
            apply: "", // No-op, just a header
            section: {
              name: "suggested",
              rank: 1,
            },
          });
          options.push(
            ...source.suggested.map((c) => ({
              ...c,
              section: { name: "suggested", rank: 1 },
            })),
          );
        }

        // Add EARLIER NODES section
        if (source.earlierNodes.length > 0) {
          options.push({
            label: "EARLIER NODES",
            type: "text",
            apply: "", // No-op, just a header
            section: {
              name: "earlier-nodes",
              rank: 2,
            },
          });
          options.push(
            ...source.earlierNodes.map((c) => ({
              ...c,
              section: { name: "earlier-nodes", rank: 2 },
            })),
          );
        }

        return {
          from,
          options,
          validFor: /^\w*$/,
        };
      },
    ],
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  executionContext?: ExpressionContext;
  connectedNodes?: Array<{ id: string; name: string }>;
  className?: string;
}

export function ExpressionInput({
  value,
  onChange,
  executionContext,
  connectedNodes = [],
  className = "",
}: ExpressionInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [evaluatedResult, setEvaluatedResult] = useState<string>("");
  const [evaluationError, setEvaluationError] = useState<string>("");

  // Build autocomplete suggestions (n8n-style)
  const autocompleteSource: AutocompleteSource = {
    suggested: [
      {
        label: "$json",
        type: "variable",
        detail: "Current item's JSON data",
        apply: "$json",
      },
      {
        label: "$json.field",
        type: "variable",
        detail: "Access field from current item",
        apply: "$json.",
      },
      {
        label: "$item[0]",
        type: "variable",
        detail: "Access specific item by index",
        apply: "$item[0]",
      },
      {
        label: "$parameters",
        type: "variable",
        detail: "Current node's parameters",
        apply: "$parameters",
      },
      {
        label: "$parameters.field",
        type: "variable",
        detail: "Access parameter field",
        apply: "$parameters.",
      },
    ],
    earlierNodes: connectedNodes.map((node) => ({
      label: `$items["${node.name}"]`,
      type: "variable",
      detail: `Data from ${node.name} node`,
      apply: `$items["${node.name}"]`,
    })),
  };

  // Initialize CodeMirror
  // biome-ignore lint/correctness/useExhaustiveDependencies: We don't want to re-initialize the editor when the autocompleteSource or placeholder changes
  useEffect(() => {
    if (!editorRef.current) return;

    const extensions: Extension[] = [
      keymap.of(defaultKeymap),
      expressionHighlighter, // Add expression syntax highlighting
      createAutocompleteExtension(autocompleteSource),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          onChange(newValue);
        }
      }),
      // Event handlers: focus, blur, drag and drop
      EditorView.domEventHandlers({
        focus: () => setIsFocused(true),
        blur: () => setIsFocused(false),
        dragover: (e) => {
          e.preventDefault();
          (e.dataTransfer as DataTransfer).dropEffect = "copy";
        },
        drop: (e, view) => {
          e.preventDefault();
          const text = e.dataTransfer?.getData("text/plain");
          if (!text) return;

          // Get drop position
          const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos !== null) {
            view.dispatch({
              changes: { from: pos, insert: text },
              selection: { anchor: pos + text.length },
            });
          }
        },
      }),
      EditorView.theme({
        "&": {
          backgroundColor: "var(--surface-3)",
          border: "1px solid var(--surface-6)",
          borderRadius: "6px",
          fontSize: "14px",
          fontFamily: "var(--font-mono)",
        },
        ".cm-content": {
          padding: "8px 12px",
          paddingLeft: "32px", // Space for fx icon
          caretColor: "var(--surface-12)",
          color: "var(--surface-12)",
        },
        "&.cm-focused": {
          outline: "2px solid var(--info-9)",
          outlineOffset: "0px",
        },
        ".cm-placeholder": {
          color: "var(--surface-10)",
        },
        ".cm-cursor": {
          borderLeftColor: "var(--surface-12)",
        },
        // Expression syntax highlighting styles
        ".cm-expression-brace": {
          color: "var(--orange-11)",
          fontWeight: "600",
        },
        ".cm-expression-content": {
          color: "var(--blue-11)",
          fontWeight: "500",
        },
      }),
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
    ];

    const startState = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  // Update editor when value changes externally
  useEffect(() => {
    if (!viewRef.current) return;
    const currentValue = viewRef.current.state.doc.toString();
    if (currentValue !== value) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Evaluate expression when context or value changes
  useEffect(() => {
    if (!hasExpressions(value)) {
      setEvaluatedResult("");
      setEvaluationError("");
      return;
    }

    if (!executionContext) {
      setEvaluatedResult("");
      setEvaluationError("No execution data available");
      return;
    }

    const result = evaluateTemplate(value, executionContext);
    if (result.success) {
      setEvaluatedResult(String(result.value));
      setEvaluationError("");
    } else {
      setEvaluatedResult("");
      setEvaluationError(result.error || "Evaluation failed");
    }
  }, [value, executionContext]);

  const hasExpression = hasExpressions(value);

  return (
    <div className={cn("flex flex-col gap-2 relative", className)}>
      {/* Editor with fx icon */}
      <div className="relative border border-surface-6 rounded-md">
        <div className="absolute left-2 top-2 z-10 pointer-events-none">
          <LucideIcon
            name="function-square"
            className="w-4 h-4 text-surface-11"
          />
        </div>
        <div ref={editorRef} />
      </div>

      {/* Result Preview (shown when focused or has expression) */}
      {(isFocused || hasExpression) && (
        <div className="border border-surface-6 rounded-md bg-surface-2 p-3 space-y-2">
          {/* Result Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-surface-11 uppercase">
                Result
              </h4>
              <div className="flex items-center gap-2 text-xs text-surface-10">
                <span>Item</span>
                <span className="px-2 py-0.5 bg-surface-4 rounded">0</span>
                <button
                  type="button"
                  className="p-0.5 hover:bg-surface-4 rounded"
                >
                  <LucideIcon name="chevron-left" className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="p-0.5 hover:bg-surface-4 rounded"
                >
                  <LucideIcon name="chevron-right" className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="bg-surface-3 px-3 py-2 rounded text-sm font-mono text-surface-12 min-h-[40px]">
              {evaluationError ? (
                <span className="text-error-11">{evaluationError}</span>
              ) : evaluatedResult ? (
                evaluatedResult
              ) : (
                <span className="text-surface-10">
                  {hasExpression ? "Evaluating..." : "Enter an expression"}
                </span>
              )}
            </div>
          </div>

          {/* Tips Section */}
          <div className="pt-2 border-t border-surface-6">
            <p className="text-xs text-surface-11">
              <span className="font-medium">Tip:</span> Anything inside{" "}
              <code className="px-1 py-0.5 bg-surface-4 rounded">
                {"{{ }}"}
              </code>{" "}
              is a CEL expression.{" "}
              <a
                href="https://docs.example.com/expressions"
                className="text-info-11 hover:text-info-10"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
