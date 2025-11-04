/**
 * Expression System Test
 *
 * Tests the new json/binary/input accessor pattern (no $ prefix)
 */

import { evaluateTemplate } from './src/server/lib/expressions';

console.log('=== Testing Expression System ===\n');

// Test 1: Simple json accessor
console.log('Test 1: Simple json accessor');
const simpleResult = evaluateTemplate(
  '{{ json.text }}',
  {
    json: { text: 'Hello World' }
  }
);
console.log('Expression: {{ json.text }}');
console.log('Result:', simpleResult);
console.log();

// Test 2: Nested property
console.log('Test 2: Nested property');
const nestedResult = evaluateTemplate(
  '{{ json.result.message }}',
  {
    json: {
      result: {
        message: 'Success!'
      }
    }
  }
);
console.log('Expression: {{ json.result.message }}');
console.log('Result:', nestedResult);
console.log();

// Test 3: Template with multiple references
console.log('Test 3: Template with multiple references');
const multiResult = evaluateTemplate(
  'Exit code: {{ json.exitCode }}, Output: {{ json.stdout }}',
  {
    json: { exitCode: 0, stdout: 'Hello!' }
  }
);
console.log('Expression: Exit code: {{ json.exitCode }}, Output: {{ json.stdout }}');
console.log('Result:', multiResult);
console.log();

// Test 4: input.params access
console.log('Test 4: input.params access');
const paramResult = evaluateTemplate(
  '{{ input.params.command }}',
  {
    input: { params: { command: 'echo "test"' } }
  }
);
console.log('Expression: {{ input.params.command }}');
console.log('Result:', paramResult);
console.log();

// Test 5: binary access
console.log('Test 5: binary access');
const binaryResult = evaluateTemplate(
  '{{ binary.file }}',
  {
    binary: { file: 'data.txt' }
  }
);
console.log('Expression: {{ binary.file }}');
console.log('Result:', binaryResult);
console.log();

// Test 6: node metadata
console.log('Test 6: node metadata');
const nodeResult = evaluateTemplate(
  'Node: {{ node.id }} ({{ node.type }})',
  {
    node: { id: 'node123', type: 'executeCommand', version: 1 }
  }
);
console.log('Expression: Node: {{ node.id }} ({{ node.type }})');
console.log('Result:', nodeResult);
console.log();

console.log('=== Tests Complete ===');
console.log('\nTo run: npx tsx test-expressions.ts');
