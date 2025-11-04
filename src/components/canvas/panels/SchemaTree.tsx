/**
 * Schema Tree Component
 *
 * Renders JSON data as an n8n-style schema tree with:
 * - Type icons and badges
 * - Collapsible nested objects/arrays
 * - Draggable property chips
 */

import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";

interface SchemaTreeProps {
	data: any;
	path?: string;
	nodeName?: string;
}

type DataType = "string" | "number" | "boolean" | "object" | "array" | "null";

function getDataType(value: any): DataType {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value as DataType;
}

function getTypeIcon(type: DataType): string {
	switch (type) {
		case "string":
			return "type";
		case "number":
			return "hash";
		case "boolean":
			return "check-square";
		case "object":
			return "package";
		case "array":
			return "list";
		case "null":
			return "minus";
		default:
			return "circle";
	}
}

function getTypeColor(type: DataType): string {
	switch (type) {
		case "string":
			return "text-surface-11";
		case "number":
			return "text-blue-11";
		case "boolean":
			return "text-purple-11";
		case "object":
			return "text-surface-11";
		case "array":
			return "text-surface-11";
		default:
			return "text-surface-10";
	}
}

function formatValue(value: any, type: DataType): string {
	if (type === "string") return value;
	if (type === "number" || type === "boolean") return String(value);
	if (type === "null") return "null";
	if (type === "array") return `[${value.length}]`;
	if (type === "object") return `{${Object.keys(value).length}}`;
	return "";
}

interface TreeNodeProps {
	label: string;
	value: any;
	path: string;
	level: number;
}

function TreeNode({ label, value, path, level }: TreeNodeProps) {
	const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
	const type = getDataType(value);
	const isExpandable = type === "object" || type === "array";

	const handleDragStart = (e: React.DragEvent) => {
		e.stopPropagation();
		const expression = `{{ ${path} }}`;
		e.dataTransfer.setData("text/plain", expression);
		e.dataTransfer.effectAllowed = "copy";
	};

	const toggleExpanded = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isExpandable) {
			setIsExpanded(!isExpanded);
		}
	};

	return (
		<div className="select-none">
			{/* Node row */}
			<div
				className="flex items-center gap-2 py-1 px-2 hover:bg-surface-3 rounded cursor-pointer group"
				style={{ paddingLeft: `${level * 16 + 8}px` }}
				onClick={toggleExpanded}
			>
				{/* Expand/collapse icon */}
				{isExpandable && (
					<div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
						<LucideIcon
							name={isExpanded ? "chevron-down" : "chevron-right"}
							className="w-3 h-3 text-surface-11"
						/>
					</div>
				)}
				{!isExpandable && <div className="w-4" />}

				{/* Type icon */}
				<div
					className={`w-4 h-4 flex items-center justify-center flex-shrink-0 ${getTypeColor(
						type
					)}`}
				>
					<LucideIcon name={getTypeIcon(type)} className="w-3.5 h-3.5" />
				</div>

				{/* Label chip - draggable */}
				<div
					draggable={!isExpandable}
					onDragStart={handleDragStart}
					className={`px-2 py-0.5 rounded text-xs font-medium bg-surface-4 text-surface-12 ${
						!isExpandable ? "cursor-grab active:cursor-grabbing" : ""
					} group-hover:bg-surface-5 transition-colors`}
				>
					{label}
				</div>

				{/* Value preview */}
				{!isExpandable && (
					<span className="text-xs text-surface-10 truncate flex-1">
						{formatValue(value, type)}
					</span>
				)}

				{/* Array/Object count badge */}
				{isExpandable && (
					<span className="text-xs text-surface-10 ml-auto">
						{type === "array" ? `${value.length} items` : `${Object.keys(value).length} keys`}
					</span>
				)}
			</div>

			{/* Children */}
			{isExpandable && isExpanded && (
				<div>
					{type === "array"
						? value.map((item: any, index: number) => (
								<TreeNode
									key={index}
									label={`[${index}]`}
									value={item}
									path={`${path}[${index}]`}
									level={level + 1}
								/>
							))
						: Object.entries(value).map(([key, val]) => (
								<TreeNode
									key={key}
									label={key}
									value={val}
									path={`${path}.${key}`}
									level={level + 1}
								/>
							))}
				</div>
			)}
		</div>
	);
}

export function SchemaTree({ data, path = "json", nodeName }: SchemaTreeProps) {
	if (!data || typeof data !== "object") {
		return (
			<div className="p-4 text-center text-xs text-surface-10">
				<p>No data to display</p>
			</div>
		);
	}

	return (
		<div className="text-sm">
			{Object.entries(data).map(([key, value]) => (
				<TreeNode
					key={key}
					label={key}
					value={value}
					path={`${path}.${key}`}
					level={0}
				/>
			))}
		</div>
	);
}
