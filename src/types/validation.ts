/**
 * Validation System Types
 *
 * Central type definitions for field and node validation
 */

export interface IValidationError {
  /** Field name/path that has the error */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Error severity */
  severity: "error" | "warning";
  /** Validation rule that failed (optional) */
  rule?: string;
}

export interface INodeValidationState {
  /** Is the node valid? */
  isValid: boolean;
  /** List of validation errors */
  errors: IValidationError[];
  /** Timestamp of last validation */
  lastValidated: number;
}
