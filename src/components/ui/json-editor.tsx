/**
 * JSON Editor Component
 *
 * A textarea-based JSON editor with validation and formatting
 */

import { CheckCircle2, Code, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { IValidationError } from "@/types/validation";
import { Button } from "./button";
import { Textarea } from "./textarea";

interface JsonEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Field name for validation error reporting */
  fieldName?: string;
  /** Callback when validation state changes */
  onValidationChange?: (error: IValidationError | null) => void;
}

// Convert value to JSON string (moved outside component to prevent recreation on each render)
function getJsonString(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }
  if (typeof val === "string") {
    // Try to parse if it's already a JSON string
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  }
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export function JsonEditor({
  value,
  onChange,
  placeholder = "{}",
  className,
  disabled = false,
  fieldName = "json",
  onValidationChange,
}: JsonEditorProps) {
  const [jsonString, setJsonString] = useState(() => getJsonString(value));
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  const validateJson = useCallback(
    (str: string): boolean => {
      if (!str.trim()) {
        setError(null);
        setIsValid(true);
        // Notify parent that validation is now valid
        onValidationChange?.(null);
        return true;
      }

      try {
        JSON.parse(str);
        setError(null);
        setIsValid(true);
        // Notify parent that validation is now valid
        onValidationChange?.(null);
        return true;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Invalid JSON";
        setError(errorMessage);
        setIsValid(false);
        // Notify parent of validation error
        onValidationChange?.({
          field: fieldName,
          message: errorMessage,
          severity: "error",
          rule: "json-syntax",
        });
        return false;
      }
    },
    [fieldName, onValidationChange],
  );

  // Update jsonString when value prop changes
  useEffect(() => {
    const newString = getJsonString(value);
    setJsonString((prevString) => {
      if (newString !== prevString) {
        validateJson(newString);
        return newString;
      }
      return prevString;
    });
  }, [value, validateJson]);

  const handleChange = (newString: string) => {
    setJsonString(newString);
    const isValidJson = validateJson(newString);

    if (isValidJson && newString.trim()) {
      try {
        const parsed = JSON.parse(newString);
        onChange(parsed);
      } catch {
        // If parsing fails, still update the string value
        onChange(newString);
      }
    } else if (!newString.trim()) {
      // Empty string should be treated as empty object
      onChange({});
    } else {
      // Invalid JSON, but keep the string value
      onChange(newString);
    }
  };

  const handleFormat = () => {
    if (!jsonString.trim()) {
      setJsonString("{}");
      onChange({});
      return;
    }

    try {
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonString(formatted);
      onChange(parsed);
      setError(null);
      setIsValid(true);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Cannot format invalid JSON";
      setError(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = `${jsonString.substring(
        0,
        start,
      )}  ${jsonString.substring(end)}`;
      setJsonString(newValue);
      handleChange(newValue);

      // Set cursor position after the inserted tab
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }

    // Auto-format on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleFormat();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Textarea
          value={jsonString}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "font-mono text-sm min-h-32 resize-y",
            !isValid && "border-red-500 focus-visible:border-red-500",
            isValid && jsonString.trim() && "border-green-500",
          )}
          spellCheck={false}
        />
        {/* Validation indicator */}
        {jsonString.trim() && (
          <div className="absolute top-2 right-2">
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-12 border border-red-7 rounded p-4">
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Format button and help text */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-surface-11">
          Tab to indent • Cmd+Enter to format
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFormat}
          disabled={disabled}
          className="h-7 text-xs"
        >
          <Code className="h-3 w-3 mr-1" />
          Format
        </Button>
      </div>
    </div>
  );
}
