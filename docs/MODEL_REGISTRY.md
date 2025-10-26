# Model Registry - Complete LLM Configuration

The model registry provides centralized configuration for all supported LLM models across multiple providers. It includes capabilities, parameter ranges, and provider information.

## Overview

The model registry is migrated from the agent-platform project and includes comprehensive support for:

- **OpenAI**: GPT-5 series, O-series models
- **Anthropic**: Claude 4.5 series
- **Google**: Gemini 2.5 series

## Architecture

```
┌─────────────────────────────────────────┐
│  Backend Model Registry                 │
│  src/server/models/registry.ts          │
│  - TYPE DEFINITIONS                     │
│  - MODEL_REGISTRY (data)                │
│  - Helper functions                     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  API Endpoint                           │
│  GET /api/models                        │
│  GET /api/models/:id                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Frontend Hooks                         │
│  src/hooks/use-model-registry.ts        │
│  - useModelRegistry()                   │
│  - useModelConfig(modelName)            │
│  - useAvailableModels()                 │
│  - useModelsByProvider(provider)        │
└─────────────────────────────────────────┘
```

## Backend - Model Registry

### Type Definitions

```typescript
import type {
  ParamConfig,
  ModelConfig,
  ModelRegistry,
} from "@/server/models/registry";

interface ParamConfig {
  type: "int" | "float" | "enum" | "bool";
  min?: number;
  max?: number;
  range?: [number, number];
  values?: string[]; // For enum type
  default?: unknown;
}

interface ModelConfig {
  provider: "openai" | "anthropic" | "google";
  supports_temp: boolean;
  valid_params?: Record<string, ParamConfig>;
}

type ModelRegistry = Record<string, ModelConfig>;
```

### Accessing Model Data

```typescript
import { MODEL_REGISTRY } from "@/server/models/registry";

// Get all models
const allModels = Object.entries(MODEL_REGISTRY);

// Get specific model
const gpt5Config = MODEL_REGISTRY["gpt-5"];
// {
//   provider: "openai",
//   supports_temp: false,
//   valid_params: { ... }
// }
```

### Helper Functions

```typescript
import {
  modelSupportsParam,
  getTemperatureRange,
} from "@/server/models/registry";

// Check if model supports a parameter
const hasTemp = modelSupportsParam(gpt5Config, "temperature");

// Get temperature range
const range = getTemperatureRange(claudeConfig); // [0, 1]
```

## API Endpoints

### Get All Models

```bash
GET /api/models
```

**Response:**
```json
{
  "success": true,
  "data": {
    "models": {
      "gpt-5": {
        "provider": "openai",
        "supports_temp": false,
        "valid_params": { ... }
      },
      "claude-sonnet-4-5": {
        "provider": "anthropic",
        "supports_temp": true,
        "valid_params": { ... }
      },
      ...
    },
    "total": 18
  }
}
```

### Get Specific Model

```bash
GET /api/models/claude-sonnet-4-5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "claude-sonnet-4-5",
    "config": {
      "provider": "anthropic",
      "supports_temp": true,
      "valid_params": {
        "temperature": {
          "type": "float",
          "range": [0, 1],
          "default": 0.5
        },
        "top_p": {
          "type": "float",
          "range": [0, 1],
          "default": 0.9
        },
        ...
      }
    }
  }
}
```

## Frontend - React Query Hooks

### useModelRegistry()

Fetch and access the complete model registry.

```typescript
import { useModelRegistry } from "@/hooks/use-model-registry";

function ModelSelector() {
  const { data: registry, isLoading, error } = useModelRegistry();

  if (isLoading) return <p>Loading models...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <select>
      {Object.entries(registry || {}).map(([name, config]) => (
        <option key={name} value={name}>
          {name} ({config.provider})
        </option>
      ))}
    </select>
  );
}
```

### useModelConfig(modelName)

Get configuration for a specific model.

```typescript
import { useModelConfig } from "@/hooks/use-model-registry";

function ModelParameters({ modelName }: { modelName: string }) {
  const { modelConfig, isReady } = useModelConfig(modelName);

  if (!isReady) return <p>Loading model config...</p>;

  return (
    <div>
      <h3>{modelName}</h3>
      <p>Provider: {modelConfig?.provider}</p>
      <p>Supports Temperature: {modelConfig?.supports_temp ? "Yes" : "No"}</p>
      <h4>Parameters:</h4>
      <ul>
        {Object.entries(modelConfig?.valid_params || {}).map(([key, param]) => (
          <li key={key}>
            {key}: {param.type}
            {param.range && ` (${param.range[0]}-${param.range[1]})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### useAvailableModels()

Get all available model names.

```typescript
import { useAvailableModels } from "@/hooks/use-model-registry";

function ModelCount() {
  const { models, isLoading } = useAvailableModels();

  if (isLoading) return null;

  return <p>Available models: {models.length}</p>;
}
```

### useModelsByProvider(provider)

Get models filtered by provider.

```typescript
import { useModelsByProvider } from "@/hooks/use-model-registry";

function AnthropicModels() {
  const { models, isLoading } = useModelsByProvider("anthropic");

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {models.map(({ name, config }) => (
        <li key={name}>
          {name} (supports temp: {config.supports_temp ? "yes" : "no"})
        </li>
      ))}
    </ul>
  );
}
```

## Supported Models

### OpenAI

**GPT-5 Series:**
- `gpt-5` - Base model
- `gpt-5-pro` - Professional version (16K context)
- `gpt-5-codex` - Code-optimized
- `gpt-5-mini` - Smaller variant
- `gpt-5-nano` - Minimal version

**O-Series:**
- `o3-pro` - Advanced reasoning
- `o3-mini` - Compact reasoning
- `o4-mini` - Next generation mini

**Parameters:** max_completion_tokens, reasoning_effort, verbosity, reasoning_summary

### Anthropic

**Claude 4.5 Series:**
- `claude-opus-4-1` - Full-featured
- `claude-sonnet-4-5` - Balanced
- `claude-haiku-4-5` - Lightweight

**Parameters:** temperature, top_p, max_tokens, top_k

**Note:** All Claude models support temperature (0.0-1.0)

### Google

**Gemini 2.5 Series:**
- `gemini-2.5-pro` - Full featured
- `gemini-2.5-flash` - Fast inference
- `gemini-2.5-flash-lite` - Lightweight
- `gemini-2.5-flash-native-audio` - Audio support

**Parameters:** temperature, top_p, top_k, max_output_tokens, frequency_penalty, presence_penalty

**Note:** All Gemini models support temperature (0.0-2.0)

## Example: Building a Model Selector Component

```typescript
import { useModelRegistry, useModelConfig } from "@/hooks/use-model-registry";
import { useState } from "react";

export function ModelSelector() {
  const { data: registry, isLoading } = useModelRegistry();
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const { modelConfig } = useModelConfig(selectedModel);

  if (isLoading) return <div>Loading models...</div>;

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Select Model</label>
        <select
          value={selectedModel || ""}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Choose a model...</option>
          {registry &&
            Object.entries(registry).map(([name, config]) => (
              <option key={name} value={name}>
                {name} ({config.provider})
              </option>
            ))}
        </select>
      </div>

      {/* Model Configuration Display */}
      {modelConfig && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">{selectedModel}</h3>
          <p className="text-sm text-gray-600">
            Provider: {modelConfig.provider}
          </p>
          <p className="text-sm text-gray-600">
            Supports Temperature: {modelConfig.supports_temp ? "Yes" : "No"}
          </p>

          {/* Parameters */}
          {modelConfig.valid_params && (
            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">Parameters:</h4>
              <div className="space-y-2">
                {Object.entries(modelConfig.valid_params).map(
                  ([paramName, paramConfig]) => (
                    <div key={paramName} className="text-sm">
                      <label className="font-medium">{paramName}</label>
                      <p className="text-gray-600">
                        Type: {paramConfig.type}
                        {paramConfig.range &&
                          ` (${paramConfig.range[0]} - ${paramConfig.range[1]})`}
                        {paramConfig.min && paramConfig.max &&
                          ` (${paramConfig.min} - ${paramConfig.max})`}
                        {paramConfig.default &&
                          ` Default: ${paramConfig.default}`}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Adding New Models

To add a new model to the registry:

1. **Update the registry** in `src/server/models/registry.ts`:

```typescript
"new-model-name": {
  provider: "openai" | "anthropic" | "google",
  supports_temp: true | false,
  valid_params: {
    parameter_name: {
      type: "int" | "float" | "enum" | "bool",
      // Additional config based on type
      default: value,
    },
    // ... more parameters
  },
},
```

2. **The API and frontend hooks automatically reflect the change** - no code changes needed!

## Caching Strategy

The model registry is cached for **5 minutes** to balance freshness with performance. To invalidate the cache:

```typescript
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

// Invalidate after adding a new model
queryClient.invalidateQueries({ queryKey: ["modelRegistry"] });
```

## Performance Considerations

- ✅ Models are cached in React Query (5-minute TTL)
- ✅ API endpoint is lightweight (static JSON)
- ✅ No database queries required
- ✅ Suitable for frequent access in UI components

## Future Enhancements

- [ ] Dynamic model registry API (CRUD operations)
- [ ] Per-user model preferences/pinning
- [ ] Model performance metrics
- [ ] Token usage tracking per model
- [ ] Cost estimation per model
- [ ] Model capability tags/categories
