import { describe, expect, it } from 'vitest';

import {
	buildMetadataApiValue,
	findFieldDefinition,
	isFrameIoUuid,
	resolveSelectOptionIds,
	type FrameIoFieldDefinition,
} from '../FrameIoMetadataHelpers';

const statusField: FrameIoFieldDefinition = {
	id: '0c058c17-dc09-4cb1-ba1e-3e0854e3e825',
	name: 'Status',
	field_type: 'select',
	mutable: true,
	field_configuration: {
		options: [
			{ id: '57a35ebc-3ea5-47e6-aedb-8c2ccfe89d3c', display_name: 'Not Required' },
			{ id: '99711b6a-0f3c-4a39-8812-9e0ae80643ac', display_name: 'For Review' },
			{ id: '093b3f43-4d08-49ac-9ca6-f4e67a5a14c8', display_name: 'Draft' },
			{ id: '3603868c-4392-4279-922a-515a40594095', display_name: 'In Progress' },
			{ id: '57748eba-d578-464c-92ec-fd31f6798466', display_name: 'Approved' },
		],
	},
};

describe('FrameIoMetadataHelpers', () => {
	describe('isFrameIoUuid', () => {
		it('should accept uuids', () => {
			expect(isFrameIoUuid('57748eba-d578-464c-92ec-fd31f6798466')).toBe(true);
		});

		it('should reject display names', () => {
			expect(isFrameIoUuid('Approved')).toBe(false);
		});
	});

	describe('findFieldDefinition', () => {
		it('should find by id', () => {
			expect(findFieldDefinition([statusField], statusField.id)).toEqual(statusField);
		});

		it('should find by name case-insensitively', () => {
			expect(findFieldDefinition([statusField], 'status')).toEqual(statusField);
			expect(findFieldDefinition([statusField], ' Status ')).toEqual(statusField);
		});

		it('should return undefined when missing', () => {
			expect(findFieldDefinition([statusField], 'Priority')).toBeUndefined();
		});
	});

	describe('resolveSelectOptionIds', () => {
		it('should resolve a display name to an option id', () => {
			expect(resolveSelectOptionIds(statusField, 'Approved')).toEqual([
				'57748eba-d578-464c-92ec-fd31f6798466',
			]);
		});

		it('should resolve names case-insensitively', () => {
			expect(resolveSelectOptionIds(statusField, 'approved')).toEqual([
				'57748eba-d578-464c-92ec-fd31f6798466',
			]);
		});

		it('should pass through option ids', () => {
			expect(resolveSelectOptionIds(statusField, '57748eba-d578-464c-92ec-fd31f6798466')).toEqual([
				'57748eba-d578-464c-92ec-fd31f6798466',
			]);
		});

		it('should resolve comma-separated multi-select names', () => {
			const multiField: FrameIoFieldDefinition = {
				...statusField,
				field_type: 'select_multi',
			};
			expect(resolveSelectOptionIds(multiField, 'Approved, Draft')).toEqual([
				'57748eba-d578-464c-92ec-fd31f6798466',
				'093b3f43-4d08-49ac-9ca6-f4e67a5a14c8',
			]);
		});

		it('should throw a helpful error for unknown names', () => {
			expect(() => resolveSelectOptionIds(statusField, 'Shipped')).toThrow(
				/Option "Shipped".*Available options: Not Required, For Review, Draft, In Progress, Approved/,
			);
		});
	});

	describe('buildMetadataApiValue', () => {
		it('should build select values as option id lists', () => {
			expect(buildMetadataApiValue(statusField, 'Approved')).toEqual([
				'57748eba-d578-464c-92ec-fd31f6798466',
			]);
		});

		it('should coerce toggle strings', () => {
			const toggleField: FrameIoFieldDefinition = {
				id: 'toggle-1',
				name: 'Transcript',
				field_type: 'toggle',
			};
			expect(buildMetadataApiValue(toggleField, 'true')).toBe(true);
			expect(buildMetadataApiValue(toggleField, 'no')).toBe(false);
		});

		it('should coerce number strings', () => {
			const numberField: FrameIoFieldDefinition = {
				id: 'number-1',
				name: 'Score',
				field_type: 'number',
			};
			expect(buildMetadataApiValue(numberField, '12')).toBe(12);
		});

		it('should pass text values through', () => {
			const textField: FrameIoFieldDefinition = {
				id: 'text-1',
				name: 'Notes',
				field_type: 'text',
			};
			expect(buildMetadataApiValue(textField, 'hello')).toBe('hello');
		});
	});
});
