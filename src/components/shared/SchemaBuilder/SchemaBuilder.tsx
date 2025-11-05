/**
 * Schema Builder Component
 *
 * Visual JSON schema builder for structured output
 * Allows users to define schemas with properties, types, and descriptions
 */

import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

// ============================================================================
// TYPES
// ============================================================================

type PropertyType = "string" | "number" | "boolean" | "object" | "array";

interface SchemaProperty {
	id: string;
	name: string;
	type: PropertyType;
	description?: string;
	properties?: SchemaProperty[]; // For object and array types
}

interface JSONSchema {
	name: string;
	description?: string;
	properties: Record<string, SchemaPropertyDefinition>;
}

interface SchemaPropertyDefinition {
	type: PropertyType;
	description?: string;
	properties?: Record<string, SchemaPropertyDefinition>; // For nested objects
	items?: SchemaPropertyDefinition; // For arrays
}

export interface SchemaBuilderProps {
	value: JSONSchema;
	onChange: (schema: JSONSchema) => void;
	onGenerate?: (prompt: string) => Promise<JSONSchema>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SchemaBuilder({
	value,
	onChange,
	onGenerate,
}: SchemaBuilderProps) {
	const [mode, setMode] = useState<"simple" | "advanced">("simple");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generatePrompt, setGeneratePrompt] = useState("");

	// Convert schema to flat properties for editing
	const [properties, setProperties] = useState<SchemaProperty[]>(() => {
		return Object.entries(value.properties || {}).map(([name, def], index) => ({
			id: `prop-${index}`,
			name,
			type: def.type,
			description: def.description,
		}));
	});

	const handleAddProperty = () => {
		const newProp: SchemaProperty = {
			id: `prop-${Date.now()}`,
			name: "",
			type: "string",
			description: "",
		};
		setProperties([...properties, newProp]);
	};

	const handleRemoveProperty = (id: string) => {
		setProperties(properties.filter((p) => p.id !== id));
		updateSchema(properties.filter((p) => p.id !== id));
	};

	const handlePropertyChange = (
		id: string,
		field: keyof SchemaProperty,
		value: string,
	) => {
		const updated = properties.map((p) =>
			p.id === id ? { ...p, [field]: value } : p,
		);
		setProperties(updated);
		updateSchema(updated);
	};

	const updateSchema = (props: SchemaProperty[]) => {
		const schemaProps: Record<string, SchemaPropertyDefinition> = {};
		for (const prop of props) {
			if (prop.name) {
				schemaProps[prop.name] = {
					type: prop.type,
					description: prop.description,
				};
			}
		}

		onChange({
			...value,
			properties: schemaProps,
		});
	};

	const handleGenerate = async () => {
		if (!onGenerate || !generatePrompt.trim()) return;

		setIsGenerating(true);
		try {
			const generated = await onGenerate(generatePrompt);
			onChange(generated);
			// Update local properties
			const newProps = Object.entries(generated.properties || {}).map(
				([name, def], index) => ({
					id: `prop-${Date.now()}-${index}`,
					name,
					type: def.type,
					description: def.description,
				}),
			);
			setProperties(newProps);
			setGeneratePrompt("");
		} catch (error) {
			console.error("Schema generation failed:", error);
		} finally {
			setIsGenerating(false);
		}
	};

	const getTypeIcon = (type: PropertyType) => {
		switch (type) {
			case "string":
				return "type";
			case "number":
				return "hash";
			case "boolean":
				return "toggle-left";
			case "object":
				return "braces";
			case "array":
				return "list";
			default:
				return "circle";
		}
	};

	const getTypeColor = (type: PropertyType) => {
		switch (type) {
			case "string":
				return "text-green-11";
			case "number":
				return "text-blue-11";
			case "boolean":
				return "text-purple-11";
			case "object":
				return "text-orange-11";
			case "array":
				return "text-red-11";
			default:
				return "text-surface-11";
		}
	};

	return (
		<div className="space-y-4 border border-surface-6 rounded-lg p-4 bg-surface-2">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Structured output (JSON)</h3>
				<div className="flex gap-2">
					<Button
						variant={mode === "simple" ? "default" : "ghost"}
						size="sm"
						onClick={() => setMode("simple")}
					>
						Simple
					</Button>
					<Button
						variant={mode === "advanced" ? "default" : "ghost"}
						size="sm"
						onClick={() => setMode("advanced")}
					>
						Advanced
					</Button>
				</div>
			</div>

			<p className="text-sm text-surface-11">
				The model will generate a JSON object that matches this schema.
			</p>

			{/* Schema Name */}
			<div className="space-y-2">
				<label htmlFor="name" className="text-sm font-medium">
					Name
				</label>
				<Input
					value={value.name || ""}
					onChange={(e) => onChange({ ...value, name: e.target.value })}
					placeholder="schema_name"
					className="bg-surface-3"
				/>
			</div>

			{/* Properties */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<label htmlFor="properties" className="text-sm font-medium">
						Properties
					</label>
				</div>

				{/* Property Headers */}
				{properties.length > 0 && (
					<div className="grid grid-cols-12 gap-2 text-xs text-surface-11 font-medium px-2">
						<div className="col-span-4">Name</div>
						<div className="col-span-3">Type</div>
						<div className="col-span-4">Description</div>
						<div className="col-span-1"></div>
					</div>
				)}

				{/* Property List */}
				<div className="space-y-2">
					{properties.map((property) => (
						<div
							key={property.id}
							className="grid grid-cols-12 gap-2 items-start p-2 rounded bg-surface-3 border border-surface-6"
						>
							{/* Name */}
							<div className="col-span-4 flex items-center gap-2">
								<LucideIcon
									name={getTypeIcon(property.type)}
									className={`w-4 h-4 ${getTypeColor(property.type)}`}
								/>
								<Input
									value={property.name}
									onChange={(e) =>
										handlePropertyChange(property.id, "name", e.target.value)
									}
									placeholder="property_name"
									className="bg-surface-2 h-8"
								/>
							</div>

							{/* Type */}
							<div className="col-span-3">
								<Select
									value={property.type}
									onValueChange={(val) =>
										handlePropertyChange(property.id, "type", val)
									}
								>
									<SelectTrigger className="bg-surface-2 h-8">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="string">STR</SelectItem>
										<SelectItem value="number">NUM</SelectItem>
										<SelectItem value="boolean">BOOL</SelectItem>
										<SelectItem value="object">OBJ</SelectItem>
										<SelectItem value="array">ARR</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Description */}
							<div className="col-span-4">
								<Input
									value={property.description || ""}
									onChange={(e) =>
										handlePropertyChange(
											property.id,
											"description",
											e.target.value,
										)
									}
									placeholder="Add description"
									className="bg-surface-2 h-8"
								/>
							</div>

							{/* Remove Button */}
							<div className="col-span-1 flex justify-end">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleRemoveProperty(property.id)}
									className="h-8 w-8 p-0"
								>
									<LucideIcon
										name="trash-2"
										className="w-4 h-4 text-error-11"
									/>
								</Button>
							</div>
						</div>
					))}
				</div>

				{/* Add Property Button */}
				<Button
					variant="ghost"
					size="sm"
					onClick={handleAddProperty}
					className="w-full"
				>
					<LucideIcon name="plus" className="w-4 h-4 mr-2" />
					Add property
				</Button>
			</div>

			{/* Generate from Prompt */}
			{onGenerate && (
				<div className="space-y-2 pt-4 border-t border-surface-6">
					<label htmlFor="generate-prompt" className="text-sm font-medium">
						Generate Schema from Prompt
					</label>
					<div className="flex gap-2">
						<Input
							value={generatePrompt}
							onChange={(e) => setGeneratePrompt(e.target.value)}
							placeholder="Describe what data you want to extract..."
							className="bg-surface-3 flex-1"
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleGenerate();
								}
							}}
						/>
						<Button
							onClick={handleGenerate}
							disabled={isGenerating || !generatePrompt.trim()}
							size="sm"
						>
							{isGenerating ? (
								<>
									<LucideIcon
										name="loader-2"
										className="w-4 h-4 mr-2 animate-spin"
									/>
									Generating...
								</>
							) : (
								<>
									<LucideIcon name="wand-2" className="w-4 h-4 mr-2" />
									Generate
								</>
							)}
						</Button>
					</div>
					<p className="text-xs text-surface-10">
						AI will generate a JSON schema based on your description
					</p>
				</div>
			)}
		</div>
	);
}
