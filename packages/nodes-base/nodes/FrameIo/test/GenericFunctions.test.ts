import type { IExecuteFunctions } from 'n8n-workflow';

import {
	buildCacheKey,
	buildIncludeParam,
	enrichEventPayload,
	eventMatchesPattern,
	frameIoApiRequest,
	getCachedResource,
	getFrameIoResourceLabel,
	invalidateCacheFromWebhook,
	setCachedResource,
	toFrameIoResourceOption,
} from '../GenericFunctions';
import type { FrameIoWebhookPayload } from '../types';

describe('FrameIo GenericFunctions', () => {
	describe('toFrameIoResourceOption', () => {
		it('should use display_name for accounts and show id as description', () => {
			expect(
				toFrameIoResourceOption({ id: 'account-1', display_name: 'Integration Account' }, [
					'display_name',
					'name',
				]),
			).toEqual({
				name: 'Integration Account',
				value: 'account-1',
				description: 'account-1',
			});
		});

		it('should use name for workspaces and projects', () => {
			expect(toFrameIoResourceOption({ id: 'workspace-1', name: 'My Workspace' })).toEqual({
				name: 'My Workspace',
				value: 'workspace-1',
				description: 'workspace-1',
			});
		});

		it('should fall back to id when no label is available', () => {
			expect(toFrameIoResourceOption({ id: 'account-1' }, ['display_name', 'name'])).toEqual({
				name: 'account-1',
				value: 'account-1',
			});
		});
	});

	describe('getFrameIoResourceLabel', () => {
		it('should prefer display_name over name', () => {
			expect(
				getFrameIoResourceLabel({
					display_name: 'Account Label',
					name: 'Legacy Name',
				}),
			).toBe('Account Label');
		});
	});

	describe('buildIncludeParam', () => {
		it('should join unique include values', () => {
			expect(buildIncludeParam(['project', 'creator', 'project'])).toBe('project,creator');
		});

		it('should return undefined for empty includes', () => {
			expect(buildIncludeParam([])).toBeUndefined();
		});
	});

	describe('eventMatchesPattern', () => {
		it('should match exact event types', () => {
			expect(eventMatchesPattern('file.ready', ['file.ready'])).toBe(true);
		});

		it('should match wildcard prefixes', () => {
			expect(eventMatchesPattern('file.ready', ['file.*'])).toBe(true);
			expect(eventMatchesPattern('comment.created', ['file.*'])).toBe(false);
		});
	});

	describe('cache helpers', () => {
		const staticData: { frameIoResourceCache?: { entries?: Record<string, unknown> } } = {};

		it('should store and retrieve cached resources within TTL', () => {
			const key = buildCacheKey('account-1', 'GET', '/v4/files/1', 'project');
			setCachedResource(staticData, key, { id: '1', name: 'Clip' });
			expect(getCachedResource(staticData, key)).toEqual({ id: '1', name: 'Clip' });
		});

		it('should invalidate cache entries from webhook payload', () => {
			const key = buildCacheKey('account-1', 'GET', '/v4/files/file-1', '');
			setCachedResource(staticData, key, { id: 'file-1' });

			const payload = {
				type: 'file.updated',
				resource: { id: 'file-1', type: 'file' },
				project: { id: 'project-1' },
			} as FrameIoWebhookPayload;

			invalidateCacheFromWebhook(staticData, payload);
			expect(getCachedResource(staticData, key)).toBeUndefined();
		});
	});

	describe('frameIoApiRequest', () => {
		it('should retry on 429 responses', async () => {
			const mockThis = {
				getNode: vi.fn().mockReturnValue({ name: 'Frame.io' }),
				helpers: {
					httpRequestWithAuthentication: vi
						.fn()
						.mockRejectedValueOnce({ statusCode: 429 })
						.mockResolvedValueOnce({ data: { id: 'ok' } }),
				},
			} as unknown as IExecuteFunctions;

			const response = await frameIoApiRequest.call(mockThis, 'GET', '/v4/me');
			expect(response).toEqual({ data: { id: 'ok' } });
			expect(mockThis.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
		});
	});

	describe('enrichEventPayload', () => {
		it('should skip enrichment for delete events by default', async () => {
			const mockThis = {
				getNode: vi.fn().mockReturnValue({ name: 'Frame.io Enrich' }),
				helpers: {
					httpRequestWithAuthentication: vi.fn(),
				},
			} as unknown as IExecuteFunctions;

			const payload = {
				type: 'file.deleted',
				account: { id: 'account-1' },
				resource: { id: 'file-1', type: 'file' },
			} as FrameIoWebhookPayload;

			const result = await enrichEventPayload.call(mockThis, payload, ['resource', 'actor'], {
				skipOnDelete: true,
			});

			expect(result).toEqual(payload);
			expect(mockThis.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
		});

		it('should enrich file events with creator include', async () => {
			const mockThis = {
				getNode: vi.fn().mockReturnValue({ name: 'Frame.io Enrich' }),
				helpers: {
					httpRequestWithAuthentication: vi.fn().mockResolvedValue({
						data: {
							id: 'file-1',
							name: 'clip.mov',
							creator: { name: 'Jane', email: 'jane@example.com' },
						},
					}),
				},
			} as unknown as IExecuteFunctions;

			const payload = {
				type: 'file.ready',
				account: { id: 'account-1' },
				resource: { id: 'file-1', type: 'file' },
			} as FrameIoWebhookPayload;

			const result = await enrichEventPayload.call(mockThis, payload, ['resource', 'actor'], {});

			expect(result.resource_data).toEqual({
				id: 'file-1',
				name: 'clip.mov',
				creator: { name: 'Jane', email: 'jane@example.com' },
			});
			expect(result.user_data).toEqual({ name: 'Jane', email: 'jane@example.com' });
		});
	});
});
