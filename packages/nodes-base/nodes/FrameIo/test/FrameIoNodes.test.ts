import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { mock } from 'vitest-mock-extended';

import { FrameIoEnrich } from '../FrameIoEnrich.node';
import { FrameIoFilter } from '../FrameIoFilter.node';
import { routeMatchesResourceScope } from '../FrameIoFilterHelpers';
import { frameIoResourceCache } from '../FrameIoResourceCache';
import {
	createLookupCache,
	enrichEventPayload,
	frameIoApiRequest,
	getCredentialCacheScope,
	getErrorStatusCode,
} from '../GenericFunctions';
import { getMetadataFields, searchFolders, searchShareFolders } from '../LoadOptionsMethods';
import { executeFrameIo } from '../V1/FrameIoV1.execute';
import type { FrameIoWebhookPayload } from '../types';

const filePayload: FrameIoWebhookPayload = {
	type: 'file.ready',
	account: { id: 'acc' },
	workspace: { id: 'ws' },
	project: { id: 'proj' },
	user: { id: 'u' },
	resource: { id: 'file-1', type: 'file' },
};

type HttpMock = ReturnType<typeof vi.fn>;

/** `.call()` is invoked on helpers, so they need real functions rather than deep proxies. */
function withHttp(ctx: { helpers: unknown }): HttpMock {
	const http = vi.fn();
	ctx.helpers = { httpRequestWithAuthentication: http };
	return http;
}

/** Answers comment → file → folder-1 (root) lookups by URL. */
function folderTreeResponder(): (credential: string, options: { url: string }) => Promise<unknown> {
	return async (_credential, { url }) => {
		if (url.includes('/comments/')) return { data: { id: 'c1', file_id: 'file-1' } };
		if (url.includes('/files/')) return { data: { id: 'file-1', parent_id: 'folder-1' } };
		return { data: { id: 'folder-1', parent_id: null } };
	};
}

describe('Frame.io nodes', () => {
	beforeEach(() => frameIoResourceCache.clear());

	describe('Filter share scope', () => {
		it('should let file events reach the folder check for folder-within-share scopes', () => {
			expect(
				routeMatchesResourceScope(
					{ scopeType: 'share', share: { value: 'share-1' }, shareScope: 'folder_in_share' },
					filePayload,
				),
			).toBe(true);
		});

		it('should defer share membership of files to the API check', () => {
			expect(
				routeMatchesResourceScope(
					{ scopeType: 'share', share: { value: 'share-1' }, shareScope: 'entire_share' },
					filePayload,
				),
			).toBe(true);
		});

		it.each([
			['a file in the share', filePayload, 1],
			[
				'a comment on a file in the share',
				{ ...filePayload, type: 'comment.created', resource: { id: 'c1', type: 'comment' } },
				1,
			],
			['a file outside the share', { ...filePayload, resource: { id: 'file-2', type: 'file' } }, 0],
		])('should route %s for entire-share scope', async (_label, payload, expected) => {
			const ctx = mock<IExecuteFunctions>();
			const http = withHttp(ctx).mockImplementation((async (
				_credential: string,
				options: { url: string },
			) => {
				if (options.url.endsWith('/shares/share-1/assets')) {
					return {
						data: [
							{ id: 'folder-1', type: 'folder' },
							{ id: 'file-1', type: 'file' },
						],
						links: {},
					};
				}
				return await folderTreeResponder()(_credential, options);
			}) as never);
			ctx.getInputData.mockReturnValue([{ json: payload }, { json: payload }]);
			ctx.getNodeParameter.mockImplementation(((name: string) =>
				name === 'routes.route'
					? [{ scopeType: 'share', share: { value: 'share-1' }, shareScope: 'entire_share' }]
					: 'acc') as never);

			const result = await new FrameIoFilter().execute.call(ctx);

			expect(result[0]).toHaveLength(expected * 2);
			const shareListings = http.mock.calls.filter(([, options]) =>
				(options as { url: string }).url.endsWith('/assets'),
			);
			expect(shareListings).toHaveLength(1);
		});

		it('should route a file inside the selected share folder', async () => {
			const ctx = mock<IExecuteFunctions>();
			withHttp(ctx).mockImplementation(folderTreeResponder());
			ctx.getInputData.mockReturnValue([{ json: filePayload }]);
			ctx.getNodeParameter.mockImplementation(((name: string) =>
				name === 'routes.route'
					? [
							{
								scopeType: 'share',
								share: { value: 'share-1' },
								shareScope: 'folder_in_share',
								shareFolder: { value: 'folder-1' },
							},
						]
					: 'acc') as never);

			const result = await new FrameIoFilter().execute.call(ctx);

			expect(result[0]).toHaveLength(1);
		});
	});

	describe('Filter lookups and errors', () => {
		it('should reuse folder lookups across items and routes', async () => {
			const ctx = mock<IExecuteFunctions>();
			const http = withHttp(ctx).mockImplementation(folderTreeResponder());
			ctx.getInputData.mockReturnValue([{ json: filePayload }, { json: filePayload }]);
			const route = { scopeType: 'folder', folder: { value: 'folder-1' }, folderScope: 'subtree' };
			ctx.getNodeParameter.mockImplementation(((name: string) =>
				name === 'routes.route' ? [route, route] : 'acc') as never);

			const result = await new FrameIoFilter().execute.call(ctx);

			expect(result.map((output) => output.length)).toEqual([2, 2]);
			expect(http).toHaveBeenCalledTimes(2);
		});

		it('should emit the item with an error when continueOnFail is enabled', async () => {
			const ctx = mock<IExecuteFunctions>();
			withHttp(ctx).mockRejectedValue(new Error('boom'));
			ctx.getInputData.mockReturnValue([{ json: filePayload }]);
			ctx.getNodeParameter.mockImplementation(((name: string) =>
				name === 'routes.route'
					? [{ scopeType: 'folder', folder: { value: 'folder-x' }, folderScope: 'subtree' }]
					: 'acc') as never);
			ctx.continueOnFail.mockReturnValue(true);

			const result = await new FrameIoFilter().execute.call(ctx);

			expect(result[0][0].json.error).toBeDefined();
		});
	});

	describe('Enrich', () => {
		const runEnrich = async (outputMode: string) => {
			const ctx = mock<IExecuteFunctions>();
			ctx.getNode.mockReturnValue({} as never);
			withHttp(ctx).mockResolvedValue({ data: { id: 'file-1', name: 'a.mov' } });
			ctx.getInputData.mockReturnValue([{ json: { ...filePayload } }]);
			ctx.getNodeParameter.mockImplementation(
				((name: string) =>
					({ profiles: ['resource'], mediaLinks: [], skipOnDelete: true, outputMode })[
						name
					]) as never,
			);
			ctx.getWorkflowStaticData.mockReturnValue({});
			return (await new FrameIoEnrich().execute.call(ctx))[0][0].json;
		};

		it('should keep the incoming payload in merge mode', async () => {
			const json = await runEnrich('merge');
			expect(json.type).toBe('file.ready');
			expect(json.resource_data).toEqual({ id: 'file-1', name: 'a.mov' });
		});

		it('should output only enriched fields in replace mode', async () => {
			expect(await runEnrich('replace')).toEqual({
				resource_data: { id: 'file-1', name: 'a.mov' },
			});
		});

		it('should resolve the parent folder of a comment without the resource profile', async () => {
			const ctx = mock<IExecuteFunctions>();
			withHttp(ctx).mockImplementation(folderTreeResponder());

			const output = await enrichEventPayload.call(
				ctx,
				{ ...filePayload, type: 'comment.created', resource: { id: 'c1', type: 'comment' } },
				['parentFolder'],
				{},
			);

			expect(output.folder_data).toEqual({ id: 'folder-1', parent_id: null });
		});

		it('should reuse folder lookups across executions with the same credential', async () => {
			const run = async (credentialId: string) => {
				const ctx = mock<IExecuteFunctions>();
				ctx.getNode.mockReturnValue({
					credentials: { frameIoOAuth2Api: { id: credentialId, name: 'Frame.io' } },
				} as never);
				const http = withHttp(ctx).mockImplementation(folderTreeResponder());
				await enrichEventPayload.call(ctx, filePayload, ['parentFolder'], {
					cache: createLookupCache(getCredentialCacheScope.call(ctx)),
				});
				return http.mock.calls.map(([, options]) => (options as { url: string }).url);
			};

			const first = await run('cred-1');
			const second = await run('cred-1');
			const otherCredential = await run('cred-2');

			expect(first).toHaveLength(2);
			// The event's own file is always refetched; its folder comes from cache.
			expect(second).toEqual([first[0]]);
			expect(otherCredential).toHaveLength(2);
		});

		it('should not write to workflow static data', async () => {
			const ctx = mock<IExecuteFunctions>();
			ctx.getNode.mockReturnValue({} as never);
			withHttp(ctx).mockResolvedValue({ data: { id: 'file-1' } });
			ctx.getInputData.mockReturnValue([{ json: { ...filePayload } }]);
			ctx.getNodeParameter.mockImplementation(
				((name: string) =>
					({ profiles: ['resource'], mediaLinks: [], skipOnDelete: true, outputMode: 'merge' })[
						name
					]) as never,
			);

			await new FrameIoEnrich().execute.call(ctx);

			expect(ctx.getWorkflowStaticData).not.toHaveBeenCalled();
		});
	});

	describe('metadata', () => {
		const fieldDefinitions = {
			data: [
				{
					id: 'f-status',
					name: 'Status',
					field_type: 'select',
					field_configuration: { options: [{ id: 'o-approved', display_name: 'Approved' }] },
				},
				{ id: 'f-notes', name: 'Notes', field_type: 'text' },
				{ id: 'f-due', name: 'Due', field_type: 'date' },
				{ id: 'f-score', name: 'Score', field_type: 'rating' },
				{ id: 'f-done', name: 'Done', field_type: 'toggle' },
			],
			links: {},
		};

		it('should expose each field with an input type matching its Frame.io type', async () => {
			const ctx = mock<ILoadOptionsFunctions>();
			withHttp(ctx).mockResolvedValue(fieldDefinitions);
			ctx.getNodeParameter.mockReturnValue('acc');

			const { fields } = await getMetadataFields.call(ctx);

			expect(fields.map((field) => [field.displayName, field.type])).toEqual([
				['Status', 'options'],
				['Notes', 'string'],
				['Due', 'dateTime'],
				['Score', 'number'],
				['Done', 'boolean'],
			]);
			expect(fields[0].options).toEqual([{ name: 'Approved', value: 'Approved' }]);
		});

		const runMetadataUpdate = async (
			mappingMode: string,
			inputJson: IDataObject,
			value: IDataObject,
		) => {
			const ctx = mock<IExecuteFunctions>();
			const http = withHttp(ctx);
			http.mockImplementation((async (_credential: string, options: { url: string }) =>
				options.url.endsWith('/field_definitions') ? fieldDefinitions : {}) as never);
			const params: IDataObject = {
				resource: 'metadata',
				operation: 'update',
				accountId: 'acc',
				projectId: 'proj',
				fileId: 'file-1',
				'metadataFields.mappingMode': mappingMode,
				'metadataFields.value': value,
			};
			ctx.getNodeParameter.mockImplementation(((name: string, _i: number, fallback: unknown) =>
				name in params ? params[name] : fallback) as never);

			const output = await executeFrameIo.call(ctx, [{ json: inputJson }]);
			const patch = http.mock.calls.find(([, options]) => options.method === 'PATCH');
			return { output, body: patch?.[1].body as IDataObject | undefined };
		};

		it('should send option IDs for select names and skip unset fields', async () => {
			const { body } = await runMetadataUpdate(
				'defineBelow',
				{},
				{
					'f-status': 'Approved',
					'f-notes': '',
					'f-score': 4,
				},
			);

			expect(body).toEqual({
				data: {
					file_ids: ['file-1'],
					values: [
						{ field_definition_id: 'f-status', value: ['o-approved'] },
						{ field_definition_id: 'f-score', value: 4 },
					],
				},
			});
		});

		it('should auto-map input keys by field name and ignore unknown keys', async () => {
			const { body } = await runMetadataUpdate(
				'autoMapInputData',
				{ Status: 'approved', Done: 'yes', unrelated: 'x' },
				{},
			);

			expect(body?.data).toMatchObject({
				values: [
					{ field_definition_id: 'f-status', value: ['o-approved'] },
					{ field_definition_id: 'f-done', value: true },
				],
			});
		});
	});

	describe('pickers', () => {
		// root → Dailies → Day 1, plus root → Archive
		const tree: Record<string, IDataObject[]> = {
			root: [
				{ id: 'dailies', name: 'Dailies' },
				{ id: 'archive', name: 'Archive' },
			],
			dailies: [{ id: 'day-1', name: 'Day 1' }],
			archive: [],
			'day-1': [],
		};

		const pickerContext = () => {
			const ctx = mock<ILoadOptionsFunctions>();
			const http = withHttp(ctx).mockImplementation((async (
				_credential: string,
				options: { url: string },
			) => {
				if (options.url.endsWith('/projects/proj')) return { data: { root_folder_id: 'root' } };
				const folderId = options.url.split('/folders/')[1]?.split('/')[0];
				return { data: tree[folderId] ?? [], links: {} };
			}) as never);
			ctx.getNodeParameter.mockImplementation(
				((name: string) => ({ accountId: 'acc', projectId: 'proj' })[name]) as never,
			);
			return { ctx, http };
		};

		it('should list nested folders with their path', async () => {
			const { ctx } = pickerContext();

			const { results } = await searchFolders.call(ctx);

			expect(results.map((result) => result.name)).toEqual([
				'Dailies',
				'Archive',
				'Dailies / Day 1',
			]);
		});

		it('should match a filter against the folder path', async () => {
			const { ctx } = pickerContext();

			const { results } = await searchFolders.call(ctx, 'dailies');

			expect(results.map((result) => result.value)).toEqual(['dailies', 'day-1']);
		});

		it('should continue the walk from the pagination token', async () => {
			const { ctx, http } = pickerContext();
			const token = JSON.stringify([{ id: 'dailies', path: 'Dailies' }]);

			const { results, paginationToken } = await searchFolders.call(ctx, undefined, token);

			expect(results.map((result) => result.name)).toEqual(['Dailies / Day 1']);
			// The rest of the tree fit in this page, so the walk is done.
			expect(paginationToken).toBeUndefined();
			expect(http.mock.calls.some(([, options]) => options.url.endsWith('/projects/proj'))).toBe(
				false,
			);
		});

		it('should hand back a token when the tree does not fit in one page', async () => {
			const { ctx } = pickerContext();
			tree.root = Array.from({ length: 20 }, (_, i) => ({ id: `wide-${i}`, name: `Wide ${i}` }));

			const firstPage = await searchFolders.call(ctx);
			const secondPage = await searchFolders.call(ctx, undefined, firstPage.paginationToken);

			expect(firstPage.paginationToken).toBeDefined();
			expect(secondPage.paginationToken).toBeUndefined();
		});

		it('should list only the folders of the share in the same route', async () => {
			const ctx = mock<ILoadOptionsFunctions>();
			withHttp(ctx).mockResolvedValue({
				data: [
					{ id: 'folder-1', type: 'folder', name: 'Selects' },
					{ id: 'file-1', type: 'file', name: 'a.mov' },
				],
				links: {},
			});
			ctx.getNodeParameter.mockReturnValue('acc');
			ctx.getCurrentNodeParameter.mockImplementation(((path: string) =>
				path === '&share' ? { mode: 'list', value: 'share-1' } : undefined) as never);

			const { results } = await searchShareFolders.call(ctx);

			expect(results.map((result) => result.value)).toEqual(['folder-1']);
		});
	});

	describe('request retries', () => {
		afterEach(() => vi.useRealTimers());

		it.each([
			['statusCode', { statusCode: 429 }],
			['axios response.status', { response: { status: 429, headers: {} } }],
			['NodeApiError httpCode', { httpCode: '429' }],
		])('should read the status code from %s', (_label, error) => {
			expect(getErrorStatusCode(error)).toBe(429);
		});

		it('should retry a rate-limited request after the Retry-After delay', async () => {
			vi.useFakeTimers();
			const ctx = mock<IExecuteFunctions>();
			withHttp(ctx)
				.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '2' } } })
				.mockResolvedValueOnce({ ok: true });

			const request = frameIoApiRequest.call(ctx, 'GET', '/v4/me');
			await vi.advanceTimersByTimeAsync(1999);
			let settled = false;
			void request.then(() => (settled = true));
			await Promise.resolve();
			expect(settled).toBe(false);
			await vi.advanceTimersByTimeAsync(1);

			await expect(request).resolves.toEqual({ ok: true });
		});
	});
});
