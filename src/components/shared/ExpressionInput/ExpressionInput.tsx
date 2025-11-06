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
import { FunctionSquare } from "lucide-react";
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

function createAutocompleteExtension(
  getSource: () => AutocompleteSource,
): Extension {
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

        // Get the current source dynamically (avoids stale closure)
        const source = getSource();

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
  connectedNodes?: Array<{ id: string; name: string; variableName?: string }>;
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

  // Store connectedNodes in a ref so autocomplete can access latest value
  const connectedNodesRef = useRef(connectedNodes);
  connectedNodesRef.current = connectedNodes;

  // Initialize CodeMirror (once)
  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to initialize once
  useEffect(() => {
    if (!editorRef.current) return;

    const extensions: Extension[] = [
      keymap.of(defaultKeymap),
      expressionHighlighter, // Add expression syntax highlighting
      createAutocompleteExtension(() => {
        // Read latest connectedNodes from ref (avoids stale closure)
        const currentNodes = connectedNodesRef.current;

        return {
          suggested: [
            {
              label: "parameters",
              type: "variable",
              detail: "Current node's parameters",
              apply: "parameters",
            },
            {
              label: "parameters.fieldName",
              type: "variable",
              detail: "Access parameter field",
              apply: "parameters.",
            },
          ],
          earlierNodes: currentNodes.map((node) => {
            // Use provided variableName if available, otherwise compute camelCase
            const camelCaseName =
              node.variableName ||
              node.name
                .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
                .replace(/^[A-Z]/, (char) => char.toLowerCase());

            return {
              label: camelCaseName,
              type: "variable",
              detail: `Data from ${node.name} node`,
              apply: `${camelCaseName}.`,
            };
          }),
        };
      }),
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
        // Autocomplete dropdown styling for dark mode
        ".cm-tooltip-autocomplete": {
          backgroundColor: "var(--color-surface-1) !important",
          border: "1px solid var(--color-surface-6) !important",
          borderRadius: "6px",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
          color: "var(--color-surface-12)",
        },
        ".cm-tooltip-autocomplete > ul": {
          backgroundColor: "var(--color-surface-1) !important",
          maxHeight: "400px",
          overflowY: "auto",
        },
        ".cm-tooltip-autocomplete > ul > li": {
          backgroundColor: "transparent",
        },
        ".cm-tooltip-autocomplete ul li": {
          color: "var(--color-surface-12)",
          padding: "6px 12px",
          cursor: "pointer",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: "var(--info-9)",
          color: "var(--color-surface-1)",
        },
        ".cm-completionLabel": {
          color: "var(--color-surface-12)",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionLabel": {
          color: "var(--color-surface-1)",
        },
        ".cm-completionDetail": {
          color: "var(--color-surface-10)",
          fontSize: "0.85em",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail": {
          color: "var(--color-surface-3)",
        },
        ".cm-completionIcon": {
          color: "var(--color-surface-10)",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionIcon": {
          color: "var(--color-surface-1)",
        },
        ".cm-completionMatchedText": {
          color: "var(--info-11)",
          fontWeight: "600",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionMatchedText":
          {
            color: "var(--info-3)",
          },
        // Section headers (like "SUGGESTED", "EARLIER NODES")
        ".cm-tooltip-autocomplete ul li[aria-disabled='true']": {
          color: "var(--color-surface-10)",
          fontSize: "0.75em",
          fontWeight: "600",
          textTransform: "uppercase",
          padding: "8px 12px 4px",
          backgroundColor: "transparent",
          cursor: "default",
          opacity: "0.8",
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
      setEvaluationError(""); // Don't show error if no context
      return;
    }

    // Async evaluation
    (async () => {
      const result = await evaluateTemplate(value, executionContext);
      if (result.success) {
        setEvaluatedResult(String(result.value));
        setEvaluationError("");
      } else {
        // Check if error is due to undefined variable (previous nodes not executed)
        const errorMsg = result.error || "Evaluation failed";
        const isUndefinedError = errorMsg.includes("is not defined") || errorMsg.includes("undefined");

        if (isUndefinedError) {
          // Not a real error - just missing data from upstream nodes
          setEvaluatedResult("");
          setEvaluationError(""); // Clear error, we'll show a helpful message instead
        } else {
          // Real syntax/evaluation error
          setEvaluatedResult("");
          setEvaluationError(errorMsg);
        }
      }
    })();
  }, [value, executionContext]);

  const hasExpression = hasExpressions(value);

  return (
    <div className={cn("flex flex-col gap-2 relative", className)}>
      {/* Editor with fx icon */}
      <div className="relative border border-surface-6 rounded-md">
        <div className="absolute left-2 top-2 z-10 pointer-events-none">
          <FunctionSquare className="size-5 text-mint-9" strokeWidth={1} />
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
              ) : hasExpression && executionContext ? (
                <span className="text-surface-10">
                  Execute previous nodes for preview
                </span>
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
              <span className="font-medium">Tip:</span> Use simple dot notation
              inside{" "}
              <code className="px-1 py-0.5 bg-surface-4 rounded">
                {"{{ }}"}
              </code>{" "}
              to access data. Example:{" "}
              <code className="px-1 py-0.5 bg-surface-4 rounded">
                manualTrigger.prompt
              </code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
