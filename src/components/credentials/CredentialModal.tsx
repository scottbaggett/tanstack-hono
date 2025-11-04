/**
 * Credential Create/Edit Modal
 *
 * Modal for creating and editing credentials
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/icon/LucideIcon';
import type {
	ICredentialType,
	ICredentialData,
} from '@/types/credentials';

interface CredentialModalProps {
	credentialId?: string | null;
	onClose: (saved: boolean) => void;
}

export function CredentialModal({ credentialId, onClose }: CredentialModalProps) {
	const [credentialTypes, setCredentialTypes] = useState<ICredentialType[]>([]);
	const [selectedType, setSelectedType] = useState<string>('');
	const [name, setName] = useState('');
	const [data, setData] = useState<Record<string, any>>({});
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isEditing = !!credentialId;

	// Fetch credential types
	useEffect(() => {
		const fetchTypes = async () => {
			try {
				const response = await fetch('/api/credentials/types');
				const result = await response.json();

				if (result.success) {
					setCredentialTypes(result.data);

					// Set default type if creating new
					if (!isEditing && result.data.length > 0) {
						setSelectedType(result.data[0].name);
					}
				}
			} catch (error) {
				console.error('Failed to fetch credential types:', error);
			}
		};

		fetchTypes();
	}, [isEditing]);

	// Fetch existing credential if editing
	useEffect(() => {
		if (!credentialId) return;

		const fetchCredential = async () => {
			try {
				setLoading(true);
				const response = await fetch(`/api/credentials/${credentialId}`);
				const result = await response.json();

				if (result.success) {
					const cred = result.data;
					setName(cred.name);
					setSelectedType(cred.type);
					setData(cred.data);
				} else {
					setError('Failed to load credential');
				}
			} catch (error) {
				console.error('Failed to fetch credential:', error);
				setError('Failed to load credential');
			} finally {
				setLoading(false);
			}
		};

		fetchCredential();
	}, [credentialId]);

	// Get selected credential type definition
	const selectedTypeDefinition = credentialTypes.find(
		(t) => t.name === selectedType,
	);

	// Handle save
	const handleSave = async () => {
		// Validation
		if (!selectedType) {
			setError('Please select a credential type');
			return;
		}

		// Use a default name if none provided
		const credentialName = name.trim() || getDefaultName();

		// Validate required fields
		if (selectedTypeDefinition) {
			for (const prop of selectedTypeDefinition.properties) {
				if (prop.required && !data[prop.name]) {
					setError(`${prop.displayName} is required`);
					return;
				}
			}
		}

		try {
			setSaving(true);
			setError(null);

			const credentialData: ICredentialData = {
				name: credentialName,
				type: selectedType,
				data,
			};

			let response;

			if (isEditing) {
				// Update existing
				response = await fetch(`/api/credentials/${credentialId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: credentialData.name,
						data: credentialData.data,
					}),
				});
			} else {
				// Create new
				response = await fetch('/api/credentials', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(credentialData),
				});
			}

			const result = await response.json();

			if (result.success) {
				onClose(true);
			} else {
				setError(result.error || 'Failed to save credential');
			}
		} catch (error) {
			console.error('Failed to save credential:', error);
			setError('Failed to save credential');
		} finally {
			setSaving(false);
		}
	};

	// Handle property change
	const handlePropertyChange = (propertyName: string, value: any) => {
		setData((prev) => ({
			...prev,
			[propertyName]: value,
		}));
	};

	// Generate a default name based on credential type
	const getDefaultName = (): string => {
		const typeDefinition = credentialTypes.find((t) => t.name === selectedType);
		const displayName = typeDefinition?.displayName || selectedType;

		// Check if user has filled in any identifying fields
		if (data.username) return `${displayName} (${data.username})`;
		if (data.email) return `${displayName} (${data.email})`;
		if (data.apiKey && typeof data.apiKey === 'string') {
			// Show last 4 chars of API key
			const key = data.apiKey as string;
			const suffix = key.length > 4 ? `...${key.slice(-4)}` : key;
			return `${displayName} (${suffix})`;
		}

		// Fallback: just use the display name
		return displayName;
	};

	// Check if a property should be displayed based on displayOptions
	const shouldDisplayProperty = (prop: any): boolean => {
		if (!prop.displayOptions) return true;

		// Check 'show' conditions
		if (prop.displayOptions.show) {
			for (const [fieldName, allowedValues] of Object.entries(
				prop.displayOptions.show,
			)) {
				const currentValue = data[fieldName];
				if (!allowedValues.includes(currentValue)) {
					return false;
				}
			}
		}

		// Check 'hide' conditions
		if (prop.displayOptions.hide) {
			for (const [fieldName, hideValues] of Object.entries(
				prop.displayOptions.hide,
			)) {
				const currentValue = data[fieldName];
				if (hideValues.includes(currentValue)) {
					return false;
				}
			}
		}

		return true;
	};

	if (loading) {
		return (
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
				<div className="bg-surface-2 rounded-lg p-6">
					<div className="text-surface-11">Loading...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-surface-2 rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b border-surface-6">
					<div>
						<h2 className="text-lg font-semibold text-surface-12">
							{isEditing ? 'Edit Credential' : 'New Credential'}
						</h2>
						<p className="text-sm text-surface-11 mt-1">
							{isEditing
								? 'Update credential details'
								: 'Create a new credential for authentication'}
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onClose(false)}
						className="h-8 w-8 p-0"
					>
						<LucideIcon name="x" className="h-5 w-5" />
					</Button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Error message */}
					{error && (
						<div className="bg-red-3 border border-red-6 rounded-lg p-3 text-sm text-red-11">
							{error}
						</div>
					)}

					{/* Name */}
					<div>
						<label className="block text-sm font-medium text-surface-12 mb-2">
							Name
							<span className="text-xs font-normal text-surface-10 ml-2">
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={
								selectedType
									? `Leave empty for default (e.g., "${getDefaultName()}")`
									: 'My API Key'
							}
							className="w-full px-3 py-2 bg-surface-3 border border-surface-6 rounded-lg text-surface-12 placeholder:text-surface-9 focus:outline-none focus:border-info-7"
						/>
						<p className="text-xs text-surface-10 mt-1">
							A friendly name to identify this credential (useful when you have
							multiple)
						</p>
					</div>

					{/* Type (only for new credentials) */}
					{!isEditing && (
						<div>
							<label className="block text-sm font-medium text-surface-12 mb-2">
								Type
							</label>
							<select
								value={selectedType}
								onChange={(e) => {
									setSelectedType(e.target.value);
									setData({}); // Reset data when changing type
								}}
								className="w-full px-3 py-2 bg-surface-3 border border-surface-6 rounded-lg text-surface-12 focus:outline-none focus:border-info-7"
							>
								{credentialTypes.map((type) => (
									<option key={type.name} value={type.name}>
										{type.displayName}
									</option>
								))}
							</select>
						</div>
					)}

					{/* Credential properties */}
					{selectedTypeDefinition && (
						<div className="space-y-4">
							<div className="text-sm font-medium text-surface-11">
								Credentials
							</div>

							{selectedTypeDefinition.properties
								.filter(shouldDisplayProperty)
								.map((prop) => {
									const inputType =
										prop.type === 'password' || prop.typeOptions?.password
											? 'password'
											: prop.type === 'number'
												? 'number'
												: prop.type === 'boolean'
													? 'checkbox'
													: 'text';

									return (
										<div key={prop.name}>
											<label className="block text-sm font-medium text-surface-12 mb-2">
												{prop.displayName}
												{prop.required && (
													<span className="text-red-9 ml-1">*</span>
												)}
											</label>
											{prop.type === 'boolean' ? (
												<input
													type="checkbox"
													checked={!!data[prop.name]}
													onChange={(e) =>
														handlePropertyChange(prop.name, e.target.checked)
													}
													className="w-4 h-4"
												/>
											) : (
												<input
													type={inputType}
													value={data[prop.name]?.toString() || ''}
													onChange={(e) =>
														handlePropertyChange(
															prop.name,
															prop.type === 'number'
																? Number(e.target.value)
																: e.target.value,
														)
													}
													placeholder={prop.placeholder || prop.default?.toString()}
													className="w-full px-3 py-2 bg-surface-3 border border-surface-6 rounded-lg text-surface-12 placeholder:text-surface-9 focus:outline-none focus:border-info-7 font-mono text-sm"
												/>
											)}
											{prop.description && (
												<p className="text-xs text-surface-10 mt-1">
													{prop.description}
												</p>
											)}
										</div>
									);
								})}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 p-6 border-t border-surface-6">
					<Button variant="outline" onClick={() => onClose(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving}>
						{saving ? (
							<>
								<LucideIcon
									name="loader-2"
									className="w-4 h-4 mr-2 animate-spin"
								/>
								Saving...
							</>
						) : (
							<>{isEditing ? 'Update' : 'Create'}</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
