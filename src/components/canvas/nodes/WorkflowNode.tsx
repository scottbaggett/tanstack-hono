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
				bg-node/80 flex items-center justify-center
				transition-all duration-200 size-24
				bg-node-background border-node-border/50
				${isSelected ? "shadow-lg shadow-node-border" : "hover:border-node-border"}
				${isConnecting ? "opacity-50" : "opacity-100"}`}
			>
				<div className="absolute top-0 left-0 right-0 bottom-0">
					<Handle
						type="target"
						position={Position.Left}
						className="size-4!"
						style={{
							border: "none",
							background: "var(--color-node-input)",
						}}
					/>
					<Handle type="source" position={Position.Right} />
				</div>

				{nodeIcon && (
					<LucideIcon name={nodeIcon} className="size-10 shrink-0 " />
				)}
			</div>

			<div className="flex flex-col gap-1 -translate-x-1/2 left-1/2 justify-center absolute top-full min-w-40 items-center content-center pt-1">
				<div className="">{data.label}</div>
			</div>
		</div>
	);
});
