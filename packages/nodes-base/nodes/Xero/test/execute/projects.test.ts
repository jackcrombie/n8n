import { mock, mockDeep } from 'jest-mock-extended';
import type { IExecuteFunctions, INode } from 'n8n-workflow';

import { XERO_PROJECTS_BASE_URL } from '../../GenericFunctions';
import { Xero } from '../../Xero.node';
import projectFixtures from '../fixtures/projects.json';

describe('Xero Node projects API', () => {
	let xero: Xero;
	let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
	let mockRequestOAuth2: jest.Mock;

	beforeEach(() => {
		xero = new Xero();
		mockExecuteFunctions = mockDeep<IExecuteFunctions>();
		mockRequestOAuth2 = jest.fn();
		mockExecuteFunctions.helpers.requestOAuth2 = mockRequestOAuth2;
		mockExecuteFunctions.getNode.mockReturnValue(
			mock<INode>({ name: 'Xero', type: 'n8n-nodes-base.xero' }),
		);
		mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
		mockExecuteFunctions.continueOnFail.mockReturnValue(false);
		mockExecuteFunctions.helpers.constructExecutionMetaData.mockImplementation((items, meta) =>
			items.map((item, index) => ({
				json: item,
				pairedItem: { item: meta?.itemData?.item ?? index },
			})),
		);
		mockExecuteFunctions.helpers.returnJsonArray.mockImplementation((data) =>
			Array.isArray(data) ? data : [data],
		);
		jest.clearAllMocks();
	});

	it('should get a project from the projects API', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'project',
				operation: 'get',
				organizationId: 'tenant-123',
				projectId: projectFixtures.project.projectId,
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2.mockResolvedValue(projectFixtures.project);

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_PROJECTS_BASE_URL}/Projects/${projectFixtures.project.projectId}`,
				headers: expect.objectContaining({
					'Xero-tenant-id': 'tenant-123',
				}),
			}),
		);
		expect(result[0][0].json).toEqual(projectFixtures.project);
	});

	it('should get many projects with filters from the projects API', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'project',
				operation: 'getAll',
				organizationId: 'tenant-123',
				returnAll: false,
				limit: 1,
				filters: {
					states: 'INPROGRESS',
					contactId: projectFixtures.project.contactId,
				},
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2.mockResolvedValue(projectFixtures.projectsPage);

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_PROJECTS_BASE_URL}/Projects`,
				qs: {
					states: 'INPROGRESS',
					contactID: projectFixtures.project.contactId,
				},
			}),
		);
		expect(result[0][0].json).toEqual(projectFixtures.projectsPage.items[0]);
	});

	it('should get a task from the projects API', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'task',
				operation: 'get',
				organizationId: 'tenant-123',
				projectId: projectFixtures.task.projectId,
				taskId: projectFixtures.task.taskId,
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2.mockResolvedValue(projectFixtures.task);

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_PROJECTS_BASE_URL}/Projects/${projectFixtures.task.projectId}/Tasks/${projectFixtures.task.taskId}`,
			}),
		);
		expect(result[0][0].json).toEqual(projectFixtures.task);
	});

	it('should get time entries by project with invoice filter', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'timeEntry',
				operation: 'getAll',
				organizationId: 'tenant-123',
				lookupMode: 'byProject',
				projectId: projectFixtures.timeEntry.projectId,
				returnAll: false,
				limit: 10,
				filters: {
					invoiceId: 'invoice-456',
				},
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2.mockResolvedValue(projectFixtures.timeEntriesPage);

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_PROJECTS_BASE_URL}/Projects/${projectFixtures.timeEntry.projectId}/Time`,
				qs: {
					invoiceId: 'invoice-456',
				},
			}),
		);
		expect(result[0][0].json).toEqual(projectFixtures.timeEntriesPage.items[0]);
	});

	it('should search time entries by invoice ID across projects', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'timeEntry',
				operation: 'getAll',
				organizationId: 'tenant-123',
				lookupMode: 'byInvoiceId',
				invoiceId: 'invoice-456',
				filters: {},
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2
			.mockResolvedValueOnce(projectFixtures.projectsPage)
			.mockResolvedValueOnce(projectFixtures.emptyPage)
			.mockResolvedValueOnce(projectFixtures.timeEntriesPage);

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenNthCalledWith(
			1,
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_PROJECTS_BASE_URL}/Projects`,
			}),
		);
		expect(mockRequestOAuth2).toHaveBeenNthCalledWith(
			3,
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_PROJECTS_BASE_URL}/Projects/${projectFixtures.project.projectId}/Time`,
				qs: {
					invoiceId: 'invoice-456',
				},
			}),
		);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toEqual(projectFixtures.timeEntriesPage.items[0]);
	});
});
