import { mock, mockDeep } from 'jest-mock-extended';
import type { IExecuteFunctions, ILoadOptionsFunctions, INode } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	addXeroApiUsageHint,
	buildXeroApiUsageMessage,
	getXeroApiUsage,
	getXeroApiUri,
	getXeroBaseUrl,
	XERO_ACCOUNTING_BASE_URL,
	XERO_ASSETS_BASE_URL,
	XERO_FILES_BASE_URL,
	XERO_FINANCE_BASE_URL,
	XERO_PROJECTS_BASE_URL,
	xeroApiRequest,
	xeroApiRequestAllItems,
	xeroApiRequestBinary,
	xeroApiRequestMultipart,
} from '../GenericFunctions';

function mockFullResponse(body: unknown, headers: Record<string, string> = {}) {
	return {
		body,
		headers,
		statusCode: 200,
		statusMessage: 'OK',
	};
}

describe('Xero GenericFunctions', () => {
	let mockFunctions: jest.Mocked<IExecuteFunctions>;
	let mockNode: INode;
	let mockRequestOAuth2: jest.Mock;

	beforeEach(() => {
		mockFunctions = mockDeep<IExecuteFunctions>();
		mockRequestOAuth2 = jest.fn();
		mockFunctions.helpers.requestOAuth2 = mockRequestOAuth2;
		mockNode = mock<INode>({ name: 'Xero' });
		mockFunctions.getNode.mockReturnValue(mockNode);
		jest.clearAllMocks();
	});

	describe('getXeroBaseUrl', () => {
		it.each([
			['project', XERO_PROJECTS_BASE_URL],
			['task', XERO_PROJECTS_BASE_URL],
			['timeEntry', XERO_PROJECTS_BASE_URL],
			['file', XERO_FILES_BASE_URL],
			['folder', XERO_FILES_BASE_URL],
			['asset', XERO_ASSETS_BASE_URL],
			['assetType', XERO_ASSETS_BASE_URL],
			['finance', XERO_FINANCE_BASE_URL],
			['invoice', XERO_ACCOUNTING_BASE_URL],
			['contact', XERO_ACCOUNTING_BASE_URL],
			[undefined, XERO_ACCOUNTING_BASE_URL],
		])('should return the correct base URL for %s', (nodeResource, expectedBaseUrl) => {
			expect(getXeroBaseUrl(nodeResource)).toBe(expectedBaseUrl);
		});
	});

	describe('getXeroApiUri', () => {
		it('should build accounting API URIs by default', () => {
			expect(getXeroApiUri('/Invoices')).toBe(`${XERO_ACCOUNTING_BASE_URL}/Invoices`);
		});

		it('should use explicit URI overrides', () => {
			expect(getXeroApiUri('', undefined, 'https://api.xero.com/connections')).toBe(
				'https://api.xero.com/connections',
			);
		});
	});

	describe('xeroApiRequest', () => {
		it('should call accounting API with tenant header from organizationId', async () => {
			mockRequestOAuth2.mockResolvedValue(mockFullResponse({ Invoices: [] }));

			await xeroApiRequest.call(
				mockFunctions,
				'GET',
				'/Invoices',
				{ organizationId: 'tenant-123' },
				{ statuses: 'AUTHORISED' },
			);

			expect(mockRequestOAuth2).toHaveBeenCalledWith(
				'xeroOAuth2Api',
				expect.objectContaining({
					method: 'GET',
					resolveWithFullResponse: true,
					uri: `${XERO_ACCOUNTING_BASE_URL}/Invoices`,
					qs: { statuses: 'AUTHORISED' },
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						'Xero-tenant-id': 'tenant-123',
					}),
				}),
			);
			expect(mockRequestOAuth2.mock.calls[0][1].body).toBeUndefined();
		});

		it('should track API usage and rate limit headers from responses', async () => {
			mockRequestOAuth2.mockResolvedValue(
				mockFullResponse(
					{ Invoices: [] },
					{
						'x-minlimit-remaining': '58',
						'x-daylimit-remaining': '4995',
						'x-appminlimit-remaining': '59',
					},
				),
			);

			await xeroApiRequest.call(mockFunctions, 'GET', '/Invoices', {
				organizationId: 'tenant-123',
			});

			expect(getXeroApiUsage(mockFunctions)).toEqual({
				apiCallCount: 1,
				minLimitRemaining: 58,
				dayLimitRemaining: 4995,
				appMinLimitRemaining: 59,
			});
		});

		it('should count failed requests and capture rate limit headers from errors', async () => {
			mockRequestOAuth2.mockRejectedValue({
				message: 'Too Many Requests',
				statusCode: 429,
				response: {
					headers: {
						'x-minlimit-remaining': '0',
						'x-rate-limit-problem': 'minute',
					},
				},
			});

			await expect(
				xeroApiRequest.call(mockFunctions, 'GET', '/Invoices', { organizationId: 'tenant-123' }),
			).rejects.toBeInstanceOf(NodeApiError);

			expect(getXeroApiUsage(mockFunctions)).toEqual({
				apiCallCount: 1,
				minLimitRemaining: 0,
				rateLimitProblem: 'minute',
			});
		});

		it.each([
			['project', '/Projects', XERO_PROJECTS_BASE_URL],
			['task', '/Projects/project-id/Tasks', XERO_PROJECTS_BASE_URL],
			['timeEntry', '/Projects/project-id/Time', XERO_PROJECTS_BASE_URL],
			['file', '/Files', XERO_FILES_BASE_URL],
			['folder', '/Folders', XERO_FILES_BASE_URL],
			['asset', '/Assets', XERO_ASSETS_BASE_URL],
			['assetType', '/AssetTypes', XERO_ASSETS_BASE_URL],
			['finance', '/FinancialStatements/ProfitAndLoss', XERO_FINANCE_BASE_URL],
		])(
			'should route %s resource requests to the correct base URL',
			async (nodeResource, endpoint, baseUrl) => {
				mockRequestOAuth2.mockResolvedValue(mockFullResponse({}));

				await xeroApiRequest.call(
					mockFunctions,
					'GET',
					endpoint,
					{ organizationId: 'tenant-123' },
					{},
					undefined,
					{},
					nodeResource,
				);

				expect(mockRequestOAuth2).toHaveBeenCalledWith(
					'xeroOAuth2Api',
					expect.objectContaining({
						uri: `${baseUrl}${endpoint}`,
					}),
				);
			},
		);

		it('should preserve explicit URI overrides for connections', async () => {
			mockRequestOAuth2.mockResolvedValue(mockFullResponse([]));

			await xeroApiRequest.call(
				mockFunctions,
				'GET',
				'',
				{},
				{},
				'https://api.xero.com/connections',
			);

			expect(mockRequestOAuth2).toHaveBeenCalledWith(
				'xeroOAuth2Api',
				expect.objectContaining({
					uri: 'https://api.xero.com/connections',
				}),
			);
		});

		it('should merge custom headers', async () => {
			mockRequestOAuth2.mockResolvedValue(mockFullResponse({}));

			await xeroApiRequest.call(
				mockFunctions,
				'GET',
				'/Invoices',
				{ organizationId: 'tenant-123' },
				{},
				undefined,
				{ Accept: 'application/json' },
			);

			expect(mockRequestOAuth2).toHaveBeenCalledWith(
				'xeroOAuth2Api',
				expect.objectContaining({
					headers: expect.objectContaining({
						Accept: 'application/json',
						'Xero-tenant-id': 'tenant-123',
					}),
				}),
			);
		});

		it('should not mutate the original request body object', async () => {
			mockRequestOAuth2.mockResolvedValue(mockFullResponse({}));
			const body = { organizationId: 'tenant-123', Type: 'ACCREC' };

			await xeroApiRequest.call(mockFunctions, 'POST', '/Invoices', body);

			expect(body.organizationId).toBe('tenant-123');
		});

		it('should wrap API errors in NodeApiError', async () => {
			mockRequestOAuth2.mockRejectedValue({ message: 'Unauthorized', statusCode: 401 });

			await expect(
				xeroApiRequest.call(mockFunctions, 'GET', '/Invoices', { organizationId: 'tenant-123' }),
			).rejects.toBeInstanceOf(NodeApiError);
		});
	});

	describe('xeroApiRequestBinary', () => {
		it('should request binary content from the files API', async () => {
			const fileBuffer = Buffer.from('pdf-content');
			mockRequestOAuth2.mockResolvedValue(mockFullResponse(fileBuffer));

			const response = await xeroApiRequestBinary.call(
				mockFunctions,
				'GET',
				'/Files/file-id/Content',
				'tenant-123',
				{},
				'file',
			);

			expect(response).toEqual(fileBuffer);
			expect(mockRequestOAuth2).toHaveBeenCalledWith(
				'xeroOAuth2Api',
				expect.objectContaining({
					method: 'GET',
					uri: `${XERO_FILES_BASE_URL}/Files/file-id/Content`,
					encoding: null,
					json: false,
					headers: expect.objectContaining({
						'Xero-tenant-id': 'tenant-123',
					}),
				}),
			);
		});
	});

	describe('xeroApiRequestMultipart', () => {
		it('should upload multipart data to the files API', async () => {
			mockRequestOAuth2.mockResolvedValue(mockFullResponse({ Id: 'file-id' }));
			const formData = {
				file: {
					value: Buffer.from('receipt'),
					options: {
						filename: 'receipt.pdf',
						contentType: 'application/pdf',
					},
				},
			};

			await xeroApiRequestMultipart.call(
				mockFunctions,
				'POST',
				'/Files',
				'tenant-123',
				formData,
				{},
				'file',
			);

			expect(mockRequestOAuth2).toHaveBeenCalledWith(
				'xeroOAuth2Api',
				expect.objectContaining({
					method: 'POST',
					uri: `${XERO_FILES_BASE_URL}/Files`,
					formData,
					headers: expect.objectContaining({
						'Xero-tenant-id': 'tenant-123',
					}),
				}),
			);
		});
	});

	describe('xeroApiRequestAllItems', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('should paginate accounting resources until an empty page is returned', async () => {
			mockRequestOAuth2
				.mockResolvedValueOnce(
					mockFullResponse({
						Invoices: [{ InvoiceID: '1' }, { InvoiceID: '2' }],
					}),
				)
				.mockResolvedValueOnce(
					mockFullResponse({
						Invoices: [{ InvoiceID: '3' }],
					}),
				)
				.mockResolvedValueOnce(
					mockFullResponse({
						Invoices: [],
					}),
				);

			const response = await xeroApiRequestAllItems.call(
				mockFunctions,
				'Invoices',
				'GET',
				'/Invoices',
				{ organizationId: 'tenant-123' },
				{ statuses: 'AUTHORISED' },
			);

			expect(response).toEqual([{ InvoiceID: '1' }, { InvoiceID: '2' }, { InvoiceID: '3' }]);
			expect(mockRequestOAuth2).toHaveBeenCalledTimes(3);
			expect(getXeroApiUsage(mockFunctions).apiCallCount).toBe(3);
			expect(mockRequestOAuth2).toHaveBeenNthCalledWith(
				1,
				'xeroOAuth2Api',
				expect.objectContaining({
					qs: {
						statuses: 'AUTHORISED',
						page: 1,
					},
				}),
			);
			expect(mockRequestOAuth2).toHaveBeenNthCalledWith(
				3,
				'xeroOAuth2Api',
				expect.objectContaining({
					qs: {
						statuses: 'AUTHORISED',
						page: 3,
					},
				}),
			);
		});

		it('should include pageSize for projects API pagination', async () => {
			mockRequestOAuth2
				.mockResolvedValueOnce(
					mockFullResponse({
						items: [{ projectId: '1' }],
					}),
				)
				.mockResolvedValueOnce(
					mockFullResponse({
						items: [],
					}),
				);

			await xeroApiRequestAllItems.call(
				mockFunctions,
				'items',
				'GET',
				'/Projects',
				{ organizationId: 'tenant-123' },
				{},
				'project',
			);

			expect(mockRequestOAuth2).toHaveBeenNthCalledWith(
				1,
				'xeroOAuth2Api',
				expect.objectContaining({
					uri: `${XERO_PROJECTS_BASE_URL}/Projects`,
					qs: {
						page: 1,
						pageSize: 50,
					},
				}),
			);
		});

		it('should allow custom pageSize for projects API pagination', async () => {
			mockRequestOAuth2.mockResolvedValueOnce(mockFullResponse({ items: [] }));

			await xeroApiRequestAllItems.call(
				mockFunctions,
				'items',
				'GET',
				'/Projects',
				{ organizationId: 'tenant-123' },
				{},
				'project',
				100,
			);

			expect(mockRequestOAuth2).toHaveBeenNthCalledWith(
				1,
				'xeroOAuth2Api',
				expect.objectContaining({
					qs: {
						page: 1,
						pageSize: 100,
					},
				}),
			);
		});
	});
});

describe('Xero API usage hints', () => {
	it('should build a readable usage message', () => {
		expect(
			buildXeroApiUsageMessage({
				apiCallCount: 3,
				minLimitRemaining: 57,
				dayLimitRemaining: 4997,
				appMinLimitRemaining: 58,
			}),
		).toBe(
			'This execution made 3 Xero API calls. Rate limits: 57/min remaining (organization), 4997/day remaining (organization), 58/min remaining (app).',
		);
	});

	it('should add an execution hint after successful requests', async () => {
		const mockFunctions = mockDeep<IExecuteFunctions>();
		const mockRequestOAuth2 = jest.fn().mockResolvedValue(
			mockFullResponse(
				{ items: [] },
				{
					'x-minlimit-remaining': '59',
					'x-daylimit-remaining': '4999',
				},
			),
		);
		mockFunctions.helpers.requestOAuth2 = mockRequestOAuth2;
		mockFunctions.getNode.mockReturnValue(mock({ name: 'Xero' }));

		await xeroApiRequest.call(
			mockFunctions,
			'GET',
			'/Projects',
			{ organizationId: 'tenant-123' },
			{},
			undefined,
			{},
			'project',
		);

		addXeroApiUsageHint(mockFunctions);

		expect(mockFunctions.addExecutionHints).toHaveBeenCalledWith({
			type: 'info',
			message:
				'This execution made 1 Xero API call. Rate limits: 59/min remaining (organization), 4999/day remaining (organization).',
			location: 'outputPane',
		});
	});

	it('should use a warning hint when a rate limit problem was reported', async () => {
		const mockFunctions = mockDeep<IExecuteFunctions>();
		const mockRequestOAuth2 = jest.fn().mockRejectedValue({
			message: 'Too Many Requests',
			statusCode: 429,
			response: {
				headers: {
					'x-rate-limit-problem': 'day',
				},
			},
		});
		mockFunctions.helpers.requestOAuth2 = mockRequestOAuth2;
		mockFunctions.getNode.mockReturnValue(mock({ name: 'Xero' }));

		await expect(
			xeroApiRequest.call(mockFunctions, 'GET', '/Invoices', { organizationId: 'tenant-123' }),
		).rejects.toBeInstanceOf(NodeApiError);

		addXeroApiUsageHint(mockFunctions);

		expect(mockFunctions.addExecutionHints).toHaveBeenCalledWith({
			type: 'warning',
			message: 'This execution made 1 Xero API call. Latest rate limit issue: day.',
			location: 'outputPane',
		});
	});
});

describe('Xero GenericFunctions loadOptions compatibility', () => {
	it('should support ILoadOptionsFunctions context', async () => {
		const mockLoadOptionsFunctions = mockDeep<ILoadOptionsFunctions>();
		const mockRequestOAuth2 = jest.fn().mockResolvedValue(mockFullResponse({ Currencies: [] }));
		mockLoadOptionsFunctions.helpers.requestOAuth2 = mockRequestOAuth2;
		mockLoadOptionsFunctions.getNode.mockReturnValue(mock({ name: 'Xero' }));

		await xeroApiRequest.call(mockLoadOptionsFunctions, 'GET', '/Currencies', {
			organizationId: 'tenant-123',
		});

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				uri: `${XERO_ACCOUNTING_BASE_URL}/Currencies`,
			}),
		);
	});
});
