/**
 * Workflow Node Component
 *
 * Represents a single node in the workflow canvas
 * Displays node inputs and outputs as connection handles
 * Uses node palette colors from @src/styles/node-palettes.css
 */

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";

interface WorkflowNodeProps {
	data: {
		label: string;
		nodeId?: string;
		displayName?: string;
		description?: string;
		icon?: string;
		color?: string;
		inputs?: Array<{ name: string; displayName: string; type: string }>;
		outputs?: Array<{ name: string; displayName: string; type: string }>;
	};
	isConnecting?: boolean;
	isSelected?: boolean;
}


export const WorkflowNode = memo(function WorkflowNode({
	data,
	isConnecting,
	isSelected,
}: WorkflowNodeProps) {
	const inputs = data.inputs || [];
	const outputs = data.outputs || [];
	const nodeIcon = data.icon || "box";
	const colorPalette = data.color || "standard-blue";

	return (
		<div
			data-node-color={colorPalette}
			className={`
				rounded-lg border-2 cursor-pointer
				transition-all duration-200 min-w-48
				bg-[var(--color-node)] border-[var(--color-node-border)]
				${
					isSelected
						? "shadow-lg shadow-[var(--color-node-border)]/50"
						: "hover:border-[var(--color-node-muted-foreground)]"
				}
				${isConnecting ? "opacity-50" : "opacity-100"}
			`}
		>
			{/* Header */}
			<div
				className="px-3 py-2 border-b flex items-center gap-2"
				style={{
					borderColor: "var(--color-node-border)",
					backgroundColor: "var(--color-node-highlight)",
				}}
			>
				{nodeIcon && (
					<LucideIcon
						name={nodeIcon}
						className="h-4 w-4 flex-shrink-0"
						style={{ color: "var(--color-node-foreground)" }}
					/>
				)}
				<div className="flex-1 min-w-0">
					<div
						className="font-medium text-sm truncate"
						style={{ color: "var(--color-node-foreground)" }}
					>
						{data.displayName || data.label}
					</div>
					{data.description && (
						<div
							className="text-xs truncate"
							style={{ color: "var(--color-node-muted-foreground)" }}
						>
							{data.description}
						</div>
					)}
				</div>
			</div>

			{/* Inputs */}
			{inputs.length > 0 && (
				<div
					className="px-3 py-2 border-b"
					style={{ borderColor: "var(--color-node-border)" }}
				>
					<div
						className="text-xs font-semibold mb-1"
						style={{ color: "var(--color-node-foreground)" }}
					>
						Inputs
					</div>
					{inputs.map((input, idx) => (
						<div
							key={`input-${idx}`}
							className="flex items-center gap-2 text-xs mb-1 last:mb-0"
						>
							<Handle
								type="target"
								position={Position.Left}
								id={`${data.nodeId}-input-${input.name}`}
								className="h-3 w-3"
								style={{ backgroundColor: "var(--color-node-foreground)" }}
							/>
							<span style={{ color: "var(--color-node-foreground)" }}>
								{input.displayName}
							</span>
							<span
								className="text-xs ml-auto flex-shrink-0"
								style={{ color: "var(--color-node-muted-foreground)" }}
							>
								{input.type}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Outputs */}
			{outputs.length > 0 && (
				<div className="px-3 py-2">
					<div
						className="text-xs font-semibold mb-1"
						style={{ color: "var(--color-node-foreground)" }}
					>
						Outputs
					</div>
					{outputs.map((output, idx) => (
						<div
							key={`output-${idx}`}
							className="flex items-center gap-2 text-xs mb-1 last:mb-0"
						>
							<span style={{ color: "var(--color-node-foreground)" }}>
								{output.displayName}
							</span>
							<span
								className="text-xs ml-auto flex-shrink-0"
								style={{ color: "var(--color-node-muted-foreground)" }}
							>
								{output.type}
							</span>
							<Handle
								type="source"
								position={Position.Right}
								id={`${data.nodeId}-output-${output.name}`}
								className="h-3 w-3"
								style={{ backgroundColor: "var(--color-node-foreground)" }}
							/>
						</div>
					))}
				</div>
			)}

			{/* Fallback for simple nodes without inputs/outputs */}
			{inputs.length === 0 && outputs.length === 0 && (
				<div className="px-3 py-2">
					<Handle type="target" position={Position.Top} />
					<Handle type="source" position={Position.Bottom} />
				</div>
			)}
		</div>
	);
});
