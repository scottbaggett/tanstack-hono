import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluateTemplate } from '../expressions';
import type { ExpressionContext } from '../expressions';

describe('JavaScript Expression Evaluation', () => {
  const testContext: ExpressionContext = {
    manualTrigger: {
      prompt: 'Write a called, from a black box to a clear box',
      max_length: '200 words',
    },
    httpRequest: {
      statusCode: 200,
      body: { success: true },
    },
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
    },
    dates: {
      now: '2025-01-05T10:30:00Z',
      today: '2025-01-05',
      timestamp: 1704450600000,
    },
    workflow: {
      id: 'wf_123',
      name: 'Test Workflow',
    },
  };

  describe('Simple variable access', () => {
    it('should access manualTrigger.prompt', async () => {
      const result = await evaluateExpression('manualTrigger.prompt', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Write a called, from a black box to a clear box');
    });

    it('should access nested object', async () => {
      const result = await evaluateExpression('httpRequest.body.success', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should access parameters', async () => {
      const result = await evaluateExpression('parameters.model', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('gpt-4');
    });
  });

  describe('Math operations', () => {
    it('should perform addition', async () => {
      const result = await evaluateExpression('httpRequest.statusCode + 100', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(300);
    });

    it('should perform multiplication', async () => {
      const result = await evaluateExpression('parameters.temperature * 10', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(7);
    });

    it('should use Math functions', async () => {
      const result = await evaluateExpression('Math.round(parameters.temperature)', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(1);
    });
  });

  describe('String operations', () => {
    it('should concatenate strings', async () => {
      const result = await evaluateExpression('workflow.name + " - " + dates.today', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Test Workflow - 2025-01-05');
    });

    it('should use string methods', async () => {
      const result = await evaluateExpression('manualTrigger.prompt.toUpperCase()', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('WRITE A CALLED, FROM A BLACK BOX TO A CLEAR BOX');
    });
  });

  describe('Conditional expressions', () => {
    it('should evaluate ternary operator', async () => {
      const result = await evaluateExpression('httpRequest.statusCode === 200 ? "success" : "failed"', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
    });

    it('should evaluate boolean logic', async () => {
      const result = await evaluateExpression('httpRequest.statusCode >= 200 && httpRequest.statusCode < 300', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('Security - blocked globals', () => {
    it('should block window access', async () => {
      const result = await evaluateExpression('window', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should block document access', async () => {
      const result = await evaluateExpression('document', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should block fetch', async () => {
      const result = await evaluateExpression('fetch', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should block alert', async () => {
      const result = await evaluateExpression('alert', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe(undefined);
    });

    // Note: eval cannot be shadowed in strict mode, but its use is limited
    // In a real sandboxed environment (worker processes), it would be fully blocked
  });

  describe('Template evaluation', () => {
    it('should evaluate template with simple variable', async () => {
      const result = await evaluateTemplate('{{ manualTrigger.prompt }}', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Write a called, from a black box to a clear box');
    });

    it('should evaluate template with math', async () => {
      const result = await evaluateTemplate('Status: {{ httpRequest.statusCode + 100 }}', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Status: 300');
    });

    it('should evaluate template with string concat', async () => {
      const result = await evaluateTemplate('{{ workflow.name }} on {{ dates.today }}', testContext);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Test Workflow on 2025-01-05');
    });
  });

  describe('Error handling', () => {
    it('should handle undefined variable', async () => {
      const result = await evaluateExpression('nonexistent.field', testContext);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle syntax error', async () => {
      const result = await evaluateExpression('manualTrigger.prompt +', testContext);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
