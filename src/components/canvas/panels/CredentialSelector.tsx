/**
 * Credential Selector
 *
 * Dropdown for selecting credentials with create/manage options
 */

import { useState, useEffect } from 'react';
import { LucideIcon } from '@/components/icon/LucideIcon';
import type { ICredentialsResponse } from '@/types/credentials';

interface CredentialSelectorProps {
	credentialType: string;
	value?: { id: string; name: string } | null;
	onChange: (credential: { id: string; name: string } | null) => void;
	required?: boolean;
}

export function CredentialSelector({
	credentialType,
	value,
	onChange,
	required,
}: CredentialSelectorProps) {
	const [credentials, setCredentials] = useState<ICredentialsResponse[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch credentials of this type
	useEffect(() => {
		const fetchCredentials = async () => {
			try {
				setLoading(true);
				const response = await fetch('/api/credentials');
				const result = await response.json();

				if (result.success) {
					// Filter by credential type
					const filtered = result.data.filter(
						(cred: ICredentialsResponse) => cred.type === credentialType,
					);
					setCredentials(filtered);
				} else {
					setError('Failed to load credentials');
				}
			} catch (error) {
				console.error('Failed to fetch credentials:', error);
				setError('Failed to load credentials');
			} finally {
				setLoading(false);
			}
		};

		fetchCredentials();
	}, [credentialType]);

	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const credentialId = e.target.value;

		if (!credentialId) {
			onChange(null);
			return;
		}

		// Find the selected credential
		const credential = credentials.find((c) => c.id === credentialId);
		if (credential) {
			onChange({
				id: credential.id,
				name: credential.name,
			});
		}
	};

	const handleCreateNew = () => {
		// Open credentials page in new tab
		window.open('/credentials', '_blank');
	};

	if (loading) {
		return (
			<div className="flex items-center gap-2 text-sm text-surface-11">
				<LucideIcon name="loader-2" className="w-4 h-4 animate-spin" />
				Loading credentials...
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-sm text-red-11 bg-red-3 border border-red-6 rounded-lg p-2">
				{error}
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<select
				value={value?.id || ''}
				onChange={handleChange}
				className="w-full px-3 py-2 bg-surface-3 border border-surface-6 rounded-lg text-surface-12 focus:outline-none focus:border-info-7"
			>
				<option value="">
					{required ? 'Select credential...' : '(No credential)'}
				</option>
				{credentials.map((credential) => (
					<option key={credential.id} value={credential.id}>
						{credential.name}
					</option>
				))}
			</select>

			{credentials.length === 0 && (
				<div className="flex items-start gap-2 text-xs text-surface-10 bg-surface-3 border border-surface-6 rounded-lg p-2">
					<LucideIcon name="info" className="w-4 h-4 mt-0.5 flex-shrink-0" />
					<div>
						<p className="mb-1">No credentials of this type found.</p>
						<button
							type="button"
							onClick={handleCreateNew}
							className="text-info-11 hover:text-info-12 underline"
						>
							Create a new credential
						</button>
					</div>
				</div>
			)}

			{credentials.length > 0 && (
				<button
					type="button"
					onClick={handleCreateNew}
					className="text-xs text-info-11 hover:text-info-12 flex items-center gap-1"
				>
					<LucideIcon name="plus" className="w-3 h-3" />
					Create new credential
				</button>
			)}
		</div>
	);
}
