/**
 * Workflow Node Component
 *
 * Represents a single node in the workflow canvas
 * Single input/output handles for simple data flow
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
		executionStatus?: "success" | "error";
	};
	isConnecting?: boolean;
	isSelected?: boolean;
}

export const WorkflowNode = memo(function WorkflowNode({
	data,
	isConnecting,
	isSelected,
}: WorkflowNodeProps) {
	const nodeIcon = data.icon || "box";
	const colorPalette = data.color || "standard-gray";

	return (
		<div
			data-node-color={colorPalette}
			className="flex flex-col gap-1 justify-center"
		>
			<div
				className={`
				relative
				rounded-lg border-2 cursor-pointer
				flex items-center justify-center
				transition-all duration-200 size-24
				${
					data.executionStatus === "success"
						? "bg-green-10/50 border-green-9/50"
						: data.executionStatus === "error"
							? "bg-red-10/50 border-red-9/50"
							: "bg-node/80 border-node-border/50"
				}
				${
					isSelected
						? "shadow-lg shadow-node-border"
						: data.executionStatus
							? ""
							: "hover:border-node-border"
				}
				${isConnecting ? "opacity-50" : "opacity-100"}`}
			>
				{/* Single Input Handle (Left Side) */}
				<Handle
					type="target"
					position={Position.Left}
					id="input"
					className="size-3 -translate-x-1/2 hover:scale-125 transition-transform"
					style={{
						border: "2px solid var(--color-node-border)",
						background: "var(--color-node-input)",
						top: "50%",
						left: 0,
					}}
				/>

				{/* Single Output Handle (Right Side) */}
				<Handle
					type="source"
					position={Position.Right}
					id="output"
					className="size-3 translate-x-1/2 hover:scale-125 transition-transform"
					style={{
						border: "2px solid var(--color-node-border)",
						background: "var(--color-node-output)",
						top: "50%",
						right: 0,
					}}
				/>

				{nodeIcon && (
					<LucideIcon name={nodeIcon} className="size-10 shrink-0 " />
				)}

				{/* Execution Status Badge */}
				{data.executionStatus === "success" && (
					<div className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-green-9 border-2 border-surface-1 flex items-center justify-center">
						<LucideIcon name="check" className="size-3 text-foreground" />
					</div>
				)}
				{data.executionStatus === "error" && (
					<div className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-9 border-2 border-surface-1 flex items-center justify-center">
						<LucideIcon name="x" className="size-3 text-foreground" />
					</div>
				)}
			</div>

			<div className="flex flex-col gap-1 -translate-x-1/2 left-1/2 justify-center absolute top-full min-w-40 items-center content-center pt-1">
				<div className="">{data.label}</div>
			</div>
		</div>
	);
});
