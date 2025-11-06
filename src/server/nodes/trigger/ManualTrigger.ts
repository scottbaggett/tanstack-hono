/**
 * Manual Trigger Node
 *
 * Manually triggered workflow execution
 * Can be used to start workflows with optional input data
 */

import type {
  IExecutionContext,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
} from "@/types/interfaces";

const baseDescription: INodeTypeBaseDescription = {
  displayName: "Manual Trigger",
  name: "manualTrigger",
  icon: "play-circle",
  iconColor: "standard-purple",
  category: "trigger",
  description: "Trigger the worklflow with the click of a button",
  codex: {
    alias: ["Manual", "Trigger", "Start", "Run"],
    categories: ["trigger"],
    subcategories: {
      trigger: ["Manual"],
    },
  },
};

export class ManualTrigger implements INodeType {
  description: INodeTypeDescription;

  constructor() {
    this.description = {
      ...baseDescription,
      version: 1,
      defaults: {
        name: "Manual Trigger",
        color: "standard-blue",
      },
      maxInputs: 0, // Trigger nodes have no inputs
      maxOutputs: 1,
      properties: [
        {
          displayName: "Data",
          name: "outputData",
          type: "json",
          default: "{}",
          description:
            "Optional JSON data to pass to the workflow. This will be available as {{ $json }} in downstream nodes.",
          placeholder: '{"key": "value"}',
        },
      ],
    };
  }

  async execute(
    context: IExecutionContext | any,
  ): Promise<INodeExecutionData[][]> {
    // Get input data from node properties or execution context
    let inputData: Record<string, unknown> = {};

    // Support both IExecutionContext and ExecuteFunctions (which is cast to any)
    const evaluatedProperties =
      context.evaluatedProperties || context.getNodeParameters?.() || {};

    // Try to get input data from properties
    if (evaluatedProperties.inputData) {
      try {
        const parsed =
          typeof evaluatedProperties.inputData === "string"
            ? JSON.parse(evaluatedProperties.inputData)
            : evaluatedProperties.inputData;

        if (typeof parsed === "object" && parsed !== null) {
          inputData = parsed as Record<string, unknown>;
        }
      } catch (error) {
        // If parsing fails, use empty object
        inputData = {};
      }
    }

    // Check if there's workflow-level input data passed in
    const workflowInputs = context.workflowInputs;
    if (workflowInputs && typeof workflowInputs === "object") {
      // Merge workflow inputs with node input data (workflow inputs take precedence)
      inputData = { ...inputData, ...workflowInputs };
    }

    // Return input data as node output
    return [
      [
        {
          json: inputData,
        },
      ],
    ];
  }
}
