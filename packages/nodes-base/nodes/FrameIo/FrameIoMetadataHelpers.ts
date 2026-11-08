import { DateTime } from 'luxon';
import type { IDataObject } from 'n8n-workflow';
import { UserError } from 'n8n-workflow';

export type FrameIoFieldType =
	| 'text'
	| 'long_text'
	| 'select'
	| 'select_multi'
	| 'rating'
	| 'number'
	| 'toggle'
	| 'user_single'
	| 'user_multi'
	| 'date'
	| string;

export interface FrameIoFieldOption {
	id: string;
	display_name: string;
}

export interface FrameIoFieldDefinition {
	id: string;
	name: string;
	field_type: FrameIoFieldType;
	mutable?: boolean;
	field_configuration?: {
		options?: FrameIoFieldOption[];
		enable_add_new?: boolean;
	};
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFrameIoUuid(value: string): boolean {
	return UUID_PATTERN.test(value.trim());
}

function normalizeLabel(value: string): string {
	return value.trim().toLowerCase();
}

export function findFieldDefinition(
	fields: FrameIoFieldDefinition[],
	nameOrId: string,
): FrameIoFieldDefinition | undefined {
	const needle = nameOrId.trim();
	if (!needle) return undefined;

	const byId = fields.find((field) => field.id === needle);
	if (byId) return byId;

	const normalized = normalizeLabel(needle);
	return fields.find((field) => normalizeLabel(field.name) === normalized);
}

export function getFieldSelectOptions(field: FrameIoFieldDefinition): FrameIoFieldOption[] {
	return field.field_configuration?.options ?? [];
}

export function resolveSelectOptionIds(
	field: FrameIoFieldDefinition,
	rawValue: string | string[],
): string[] {
	const options = getFieldSelectOptions(field);
	const parts = Array.isArray(rawValue)
		? rawValue
		: rawValue
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean);

	if (parts.length === 0) {
		throw new UserError(`No value provided for select field "${field.name}"`);
	}

	const optionIds: string[] = [];
	for (const part of parts) {
		if (isFrameIoUuid(part)) {
			const exists = options.some((option) => option.id === part);
			if (!exists && options.length > 0) {
				throw new UserError(
					`Option ID "${part}" was not found on field "${field.name}". Available options: ${options
						.map((option) => option.display_name)
						.join(', ')}`,
				);
			}
			optionIds.push(part);
			continue;
		}

		const normalized = normalizeLabel(part);
		const match = options.find((option) => normalizeLabel(option.display_name) === normalized);
		if (!match) {
			throw new UserError(
				`Option "${part}" was not found on field "${field.name}". Available options: ${
					options.map((option) => option.display_name).join(', ') || '(none)'
				}`,
			);
		}
		optionIds.push(match.id);
	}

	return optionIds;
}

export type FrameIoMetadataApiValue = string | number | boolean | string[];

export function buildMetadataApiValue(
	field: FrameIoFieldDefinition,
	rawValue: unknown,
): FrameIoMetadataApiValue {
	if (rawValue === null || rawValue === undefined || rawValue === '') {
		throw new UserError(`No value provided for field "${field.name}"`);
	}

	switch (field.field_type) {
		case 'select':
		case 'select_multi': {
			const asStringOrList =
				typeof rawValue === 'string'
					? rawValue
					: Array.isArray(rawValue)
						? rawValue.map(String)
						: String(rawValue);
			return resolveSelectOptionIds(field, asStringOrList);
		}
		case 'toggle': {
			if (typeof rawValue === 'boolean') return rawValue;
			const normalized = String(rawValue).trim().toLowerCase();
			if (['true', '1', 'yes'].includes(normalized)) return true;
			if (['false', '0', 'no'].includes(normalized)) return false;
			throw new UserError(
				`Invalid toggle value "${String(rawValue)}" for field "${field.name}". Use true or false.`,
			);
		}
		case 'number':
		case 'rating': {
			if (typeof rawValue === 'number') return rawValue;
			const parsed = Number(rawValue);
			if (Number.isNaN(parsed)) {
				throw new UserError(`Invalid number value "${String(rawValue)}" for field "${field.name}"`);
			}
			return parsed;
		}
		case 'date': {
			// Date pickers and expressions can yield a Luxon DateTime or JS Date.
			if (rawValue instanceof Date) return rawValue.toISOString();
			if (DateTime.isDateTime(rawValue)) return rawValue.toISO() ?? String(rawValue);
			if (typeof rawValue === 'string') return rawValue;
			throw new UserError(`Invalid date value for field "${field.name}". Use an ISO 8601 date.`);
		}
		default: {
			if (Array.isArray(rawValue)) return rawValue.map(String);
			if (typeof rawValue === 'number' || typeof rawValue === 'boolean') return rawValue;
			if (typeof rawValue === 'string') return rawValue;
			throw new UserError(
				`Invalid value for field "${field.name}". Expected text, a number, a boolean, or a list.`,
			);
		}
	}
}

export function toFieldDefinition(resource: IDataObject): FrameIoFieldDefinition {
	const fieldConfiguration = resource.field_configuration as
		| FrameIoFieldDefinition['field_configuration']
		| undefined;

	return {
		id: resource.id as string,
		name: (resource.name as string) ?? (resource.id as string),
		field_type: (resource.field_type as FrameIoFieldType) ?? 'text',
		mutable: resource.mutable as boolean | undefined,
		field_configuration: fieldConfiguration,
	};
}
