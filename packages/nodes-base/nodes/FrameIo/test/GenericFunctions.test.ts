import type { IExecuteFunctions } from 'n8n-workflow';

import {
	buildIncludeParam,
	enrichEventPayload,
	eventMatchesPattern,
	frameIoApiRequest,
	getFrameIoResourceLabel,
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
				// eslint-disable-next-line n8n-nodes-base/node-param-description-lowercase-first-char -- test data, not a node param
				description: 'account-1',
			});
		});

		it('should use name for workspaces and projects', () => {
			expect(toFrameIoResourceOption({ id: 'workspace-1', name: 'My Workspace' })).toEqual({
				name: 'My Workspace',
				value: 'workspace-1',
				// eslint-disable-next-line n8n-nodes-base/node-param-description-lowercase-first-char -- test data, not a node param
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

		it('should not send file-only includes on comment enrichment', async () => {
			const mockThis = {
				getNode: vi.fn().mockReturnValue({ name: 'Frame.io Enrich' }),
				helpers: {
					httpRequestWithAuthentication: vi
						.fn()
						.mockResolvedValueOnce({
							data: {
								id: 'comment-1',
								file_id: 'file-1',
								owner: { name: 'Jane', email: 'jane@example.com' },
							},
						})
						.mockResolvedValueOnce({
							data: {
								id: 'file-1',
								name: 'clip.mov',
								media_links: { thumbnail: { url: 'https://example.com/thumb.jpg' } },
							},
						}),
				},
			} as unknown as IExecuteFunctions;

			const payload = {
				type: 'comment.created',
				account: { id: 'account-1' },
				resource: { id: 'comment-1', type: 'comment' },
			} as FrameIoWebhookPayload;

			const result = await enrichEventPayload.call(
				mockThis,
				payload,
				['resource', 'actor', 'metadata', 'mediaLinks'],
				{ mediaLinks: ['thumbnail'] },
			);

			expect(mockThis.helpers.httpRequestWithAuthentication).toHaveBeenNthCalledWith(
				1,
				'frameIoOAuth2Api',
				expect.objectContaining({
					url: 'https://api.frame.io/v4/accounts/account-1/comments/comment-1',
					qs: { include: 'owner' },
				}),
			);
			expect(mockThis.helpers.httpRequestWithAuthentication).toHaveBeenNthCalledWith(
				2,
				'frameIoOAuth2Api',
				expect.objectContaining({
					url: 'https://api.frame.io/v4/accounts/account-1/files/file-1',
					qs: { include: 'metadata,media_links.thumbnail' },
				}),
			);
			expect(result.user_data).toEqual({ name: 'Jane', email: 'jane@example.com' });
			expect(result.file_data).toEqual({
				id: 'file-1',
				name: 'clip.mov',
				media_links: { thumbnail: { url: 'https://example.com/thumb.jpg' } },
			});
		});
	});
});
