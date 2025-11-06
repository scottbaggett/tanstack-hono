# Validation & Error Handling System

## Problem Statement

Currently, field-level validation errors (e.g., invalid JSON syntax) are visible in the parameter editor but:
- **No execution blocking**: Invalid nodes can still execute
- **No visual feedback on canvas**: Nodes with errors look normal
- **No global error surfacing**: Users must open each node to discover errors
- **No error state persistence**: Errors aren't tracked in node data

## Requirements

1. **Field-level validation**: Each input field validates its own data
2. **Node-level aggregation**: Collect all validation errors for a node
3. **Execution blocking**: Prevent execution of nodes with validation errors
4. **Canvas visual feedback**: Show error badge/state on invalid nodes
5. **Global notifications**: Toast notifications for validation errors (bottom-right)
6. **Persistent error tracking**: Errors stored in node data and workflow state

---

## Architecture Design

### 1. Type Definitions

```typescript
// src/types/validation.ts

export interface IValidationError {
  /** Field name/path that has the error */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Error severity */
  severity: 'error' | 'warning';
  /** Validation rule that failed */
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

// Add to node data
export interface NodeData {
  // ... existing fields
  validation?: INodeValidationState;
}
```

### 2. Validation Flow

```
┌─────────────────┐
│ Field Component │ (JsonEditor, TextInput, etc.)
│  - Local state  │
│  - Validates    │
│  - onChange     │
└────────┬────────┘
         │ Validation result
         ▼
┌─────────────────┐
│ ParametersPanel │
│  - Aggregates   │
│  - Updates node │
└────────┬────────┘
         │ validationErrors → node.data.validation
         ▼
┌─────────────────┐
│   Node (Canvas) │
│  - Shows badge  │
│  - Error state  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notification   │
│     System      │
│  (bottom-right) │
└─────────────────┘
```

### 3. Validation State Management

**Option A: Real-time validation (Recommended)**
- Validate on every parameter change
- Update `node.data.validation` immediately
- Pros: Always up-to-date, responsive UX
- Cons: More frequent updates

**Option B: On-blur validation**
- Validate when field loses focus
- Pros: Fewer updates
- Cons: Delayed feedback

**Decision**: Use **Option A** for critical errors (syntax, type), **Option B** for warnings

### 4. Field-Level Validation Interface

Each field component should support:

```typescript
interface ValidatableFieldProps {
  value: unknown;
  onChange: (value: unknown, error?: IValidationError) => void;
  onValidationChange?: (error: IValidationError | null) => void;
}
```

**Updated JsonEditor:**
```typescript
interface JsonEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  onValidationChange?: (error: IValidationError | null) => void; // NEW
  // ... existing props
}
```

### 5. ParametersPanel Validation Aggregation

```typescript
// Track validation errors for all fields
const [validationErrors, setValidationErrors] = useState<Record<string, IValidationError>>({});

// Callback for field validation changes
const handleFieldValidation = (fieldName: string, error: IValidationError | null) => {
  setValidationErrors(prev => {
    const next = { ...prev };
    if (error) {
      next[fieldName] = error;
    } else {
      delete next[fieldName];
    }
    return next;
  });
};

// Update node data with validation state
useEffect(() => {
  const errors = Object.values(validationErrors);
  const validationState: INodeValidationState = {
    isValid: errors.length === 0,
    errors,
    lastValidated: Date.now(),
  };

  onUpdateNode(selectedNode.id, {
    validation: validationState,
  });
}, [validationErrors]);
```

### 6. Canvas Node Error Display

**Visual indicators:**
- Red border on node
- Error badge with count (top-right corner)
- Red icon in node header
- Tooltip showing first error on hover

```typescript
// src/components/canvas/CustomNode.tsx

const nodeData = node.data as NodeData;
const hasErrors = nodeData.validation && !nodeData.validation.isValid;
const errorCount = nodeData.validation?.errors.length || 0;

return (
  <div className={cn(
    "node-wrapper",
    hasErrors && "border-red-500 border-2"
  )}>
    {hasErrors && (
      <div className="absolute -top-2 -right-2 bg-red-500 rounded-full px-2 py-0.5">
        <span className="text-xs text-white">{errorCount}</span>
      </div>
    )}
    {/* ... rest of node */}
  </div>
);
```

### 7. Execution Blocking

**A. Frontend - Disable execute buttons**
```typescript
// In NodeEditorModal
const canExecute = !selectedNode.data.validation ||
                   selectedNode.data.validation.isValid;

<Button
  onClick={handleExecute}
  disabled={!canExecute || isExecuting}
>
  Execute Step
</Button>
```

**B. Backend - Validation check in WorkflowOrchestrator**
```typescript
// Before executeNodeInternal
private validateNodeBeforeExecution(nodeId: string): IValidationError[] {
  const node = this.config.definition.nodes.find(n => n.id === nodeId);
  if (!node) return [{ field: 'node', message: 'Node not found', severity: 'error' }];

  const validation = (node.data as NodeData).validation;
  if (!validation || validation.isValid) {
    return []; // No errors
  }

  return validation.errors;
}

// In executeNodeInternal
const validationErrors = this.validateNodeBeforeExecution(nodeId);
if (validationErrors.length > 0) {
  this.nodeResults.set(nodeId, {
    nodeId,
    nodeType,
    status: 'failed',
    error: {
      message: `Node has validation errors: ${validationErrors.map(e => e.message).join(', ')}`,
      validationErrors,
    },
    // ... rest
  });
  return; // Don't execute
}
```

### 8. Global Notification System

**Use Radix UI Toast (already available in shadcn/ui)**

```typescript
// src/components/ui/toaster.tsx (create)
import { Toast, ToastProvider } from '@radix-ui/react-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(toast => (
        <Toast key={toast.id} variant={toast.variant}>
          <div className="grid gap-1">
            <div className="font-semibold">{toast.title}</div>
            {toast.description && <div className="text-sm">{toast.description}</div>}
          </div>
        </Toast>
      ))}
    </ToastProvider>
  );
}

// src/hooks/use-toast.ts (create)
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ title, description, variant = 'default', duration = 5000 }) => {
    const id = Math.random().toString(36);
    setToasts(prev => [...prev, { id, title, description, variant }]);

    if (duration !== Infinity) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  };

  return { toasts, toast };
}
```

**Trigger notifications on validation errors:**
```typescript
// In ParametersPanel
useEffect(() => {
  if (validationErrors.length > 0) {
    toast({
      title: "Validation Errors",
      description: `${selectedNode.data.displayName} has ${validationErrors.length} error(s)`,
      variant: "destructive",
      duration: Infinity, // Persist until fixed
    });
  }
}, [validationErrors]);
```

---

## Implementation Plan

### Phase 1: Foundation (Types & Interfaces)
1. Create `src/types/validation.ts` with type definitions
2. Update `NodeData` interface to include `validation` field
3. Add validation props to field component interfaces

### Phase 2: Field-Level Validation
1. Update `JsonEditor` to emit validation changes via `onValidationChange`
2. Update other field components (TextInput, NumberInput, etc.)
3. Ensure all fields report validation state

### Phase 3: Node-Level Aggregation
1. Update `ParametersPanel` to collect validation errors
2. Aggregate errors and update node data
3. Show validation summary in parameter panel header

### Phase 4: Canvas Visual Feedback
1. Add error badge to `CustomNode` component
2. Style nodes with error state (red border)
3. Add tooltip showing errors on hover

### Phase 5: Execution Blocking
1. Disable execute buttons when validation fails
2. Add validation check to `WorkflowOrchestrator`
3. Return validation errors instead of executing
4. Show validation errors in execution results

### Phase 6: Global Notifications
1. Set up Radix Toast system
2. Create `useToast` hook
3. Trigger notifications for validation errors
4. Make notifications dismissible but persistent

---

## Testing Strategy

### Unit Tests
- Test field validation logic (JsonEditor, etc.)
- Test validation state aggregation in ParametersPanel
- Test execution blocking in WorkflowOrchestrator

### Integration Tests
- Test validation flow from field → node → canvas
- Test execution blocking with invalid nodes
- Test notification system

### Manual Testing
1. Create node with JSON field
2. Enter invalid JSON
3. Verify error shows in field
4. Verify error badge appears on canvas node
5. Verify execute button is disabled
6. Verify notification appears
7. Fix JSON syntax
8. Verify error clears everywhere

---

## Future Enhancements

1. **Warning-level validation**: Non-blocking warnings (e.g., "This might be slow")
2. **Cross-node validation**: Validate dependencies between nodes
3. **Custom validation rules**: Allow nodes to define custom validation logic
4. **Validation on workflow save**: Prevent saving workflows with errors
5. **Validation summary panel**: Show all validation errors across workflow
6. **Auto-fix suggestions**: Suggest fixes for common validation errors
