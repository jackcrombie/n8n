import type { IHookFunctions, IWebhookFunctions } from 'n8n-workflow';
import type { Mock, Mocked } from 'vitest';

import { frameIoApiRequest } from '../GenericFunctions';
import { verifyFrameIoWebhook } from '../FrameIoTriggerHelpers';
import { FrameIoTriggerV1 } from '../V1/FrameIoTriggerV1.node';

vi.mock('../GenericFunctions');
vi.mock('../FrameIoTriggerHelpers');

describe('FrameIoTrigger', () => {
	let trigger: FrameIoTriggerV1;
	let mockHookFunctions: Pick<
		Mocked<IHookFunctions>,
		'getNodeWebhookUrl' | 'getNodeParameter' | 'getWorkflowStaticData' | 'getWorkflow' | 'helpers'
	>;
	let mockWebhookFunctions: Pick<
		Mocked<IWebhookFunctions>,
		'getBodyData' | 'getNode' | 'getNodeParameter' | 'getWorkflowStaticData' | 'helpers'
	>;

	beforeEach(() => {
		vi.clearAllMocks();
		trigger = new FrameIoTriggerV1({
			displayName: 'Frame.io Trigger',
			name: 'frameIoTrigger',
			icon: 'file:frameIo.svg',
			group: ['trigger'],
			description: 'Starts the workflow when Frame.io events occur',
			defaultVersion: 1,
		});

		mockHookFunctions = {
			getNodeWebhookUrl: vi.fn(),
			getNodeParameter: vi.fn(),
			getWorkflowStaticData: vi.fn(),
			getWorkflow: vi.fn(),
			helpers: {} as IHookFunctions['helpers'],
		};

		mockWebhookFunctions = {
			getBodyData: vi.fn(),
			getNode: vi.fn().mockReturnValue({ name: 'Frame.io Trigger' }),
			getNodeParameter: vi.fn(),
			getWorkflowStaticData: vi.fn(),
			helpers: {
				returnJsonArray: vi.fn((data) => data),
			} as unknown as IWebhookFunctions['helpers'],
		};
	});

	describe('webhookMethods.default.create', () => {
		it('should create webhook and store signing secret', async () => {
			const webhookUrl = 'https://example.com/webhook';
			const accountId = 'account-1';
			const workspaceId = 'workspace-1';
			const events = ['file.ready'];
			const webhookData: Record<string, string> = {};

			mockHookFunctions.getNodeWebhookUrl.mockReturnValue(webhookUrl);
			mockHookFunctions.getNodeParameter.mockImplementation((name) => {
				if (name === 'accountId') return accountId;
				if (name === 'workspaceId') return workspaceId;
				if (name === 'events') return events;
				return undefined;
			});
			mockHookFunctions.getWorkflow.mockReturnValue({ id: 'workflow-1' } as ReturnType<
				IHookFunctions['getWorkflow']
			>);
			mockHookFunctions.getWorkflowStaticData.mockReturnValue(webhookData);

			(frameIoApiRequest as Mock).mockResolvedValue({
				data: {
					id: 'webhook-1',
					signing_secret: 'secret-abc',
				},
			});

			const result = await trigger.webhookMethods!.default.create.call(
				mockHookFunctions as unknown as IHookFunctions,
			);

			expect(result).toBe(true);
			expect(frameIoApiRequest).toHaveBeenCalledWith(
				'POST',
				`/v4/accounts/${accountId}/workspaces/${workspaceId}/webhooks`,
				{
					data: {
						name: 'n8n workflow workflow-1',
						url: webhookUrl,
						events,
					},
				},
			);
			expect(webhookData.webhookId).toBe('webhook-1');
			expect(webhookData.signingSecret).toBe('secret-abc');
		});

		it('should expand All Events into the full Frame.io event list', async () => {
			const webhookUrl = 'https://example.com/webhook';
			const accountId = 'account-1';
			const workspaceId = 'workspace-1';
			const webhookData: Record<string, string> = {};

			mockHookFunctions.getNodeWebhookUrl.mockReturnValue(webhookUrl);
			mockHookFunctions.getNodeParameter.mockImplementation((name) => {
				if (name === 'accountId') return accountId;
				if (name === 'workspaceId') return workspaceId;
				if (name === 'events') return ['*'];
				return undefined;
			});
			mockHookFunctions.getWorkflow.mockReturnValue({ id: 'workflow-1' } as ReturnType<
				IHookFunctions['getWorkflow']
			>);
			mockHookFunctions.getWorkflowStaticData.mockReturnValue(webhookData);

			(frameIoApiRequest as Mock).mockResolvedValue({
				data: {
					id: 'webhook-1',
					signing_secret: 'secret-abc',
				},
			});

			await trigger.webhookMethods!.default.create.call(
				mockHookFunctions as unknown as IHookFunctions,
			);

			expect(frameIoApiRequest).toHaveBeenCalledWith(
				'POST',
				`/v4/accounts/${accountId}/workspaces/${workspaceId}/webhooks`,
				expect.objectContaining({
					data: expect.objectContaining({
						events: expect.arrayContaining(['file.ready', 'comment.created', 'project.created']),
					}),
				}),
			);
			const postedEvents = (frameIoApiRequest as Mock).mock.calls[0][2].data.events as string[];
			expect(postedEvents).not.toContain('*');
			expect(postedEvents.length).toBeGreaterThan(20);
		});
	});

	describe('webhookMethods.default.checkExists', () => {
		it('should return false when webhook id is missing', async () => {
			mockHookFunctions.getWorkflowStaticData.mockReturnValue({});

			const result = await trigger.webhookMethods!.default.checkExists.call(
				mockHookFunctions as unknown as IHookFunctions,
			);

			expect(result).toBe(false);
		});

		it('should return true when webhook url and active status match', async () => {
			const webhookUrl = 'https://example.com/webhook';
			mockHookFunctions.getNodeWebhookUrl.mockReturnValue(webhookUrl);
			mockHookFunctions.getNodeParameter.mockReturnValue('account-1');
			mockHookFunctions.getWorkflowStaticData.mockReturnValue({ webhookId: 'webhook-1' });

			(frameIoApiRequest as Mock).mockResolvedValue({
				data: { url: webhookUrl, active: true },
			});

			const result = await trigger.webhookMethods!.default.checkExists.call(
				mockHookFunctions as unknown as IHookFunctions,
			);

			expect(result).toBe(true);
		});
	});

	describe('webhookMethods.default.delete', () => {
		it('should delete webhook and clear static data', async () => {
			const webhookData: Record<string, string> = {
				webhookId: 'webhook-1',
				signingSecret: 'secret-abc',
			};

			mockHookFunctions.getNodeParameter.mockReturnValue('account-1');
			mockHookFunctions.getWorkflowStaticData.mockReturnValue(webhookData);
			(frameIoApiRequest as Mock).mockResolvedValue({});

			const result = await trigger.webhookMethods!.default.delete.call(
				mockHookFunctions as unknown as IHookFunctions,
			);

			expect(result).toBe(true);
			expect(frameIoApiRequest).toHaveBeenCalledWith(
				'DELETE',
				'/v4/accounts/account-1/webhooks/webhook-1',
			);
			expect(webhookData.webhookId).toBeUndefined();
			expect(webhookData.signingSecret).toBeUndefined();
		});
	});

	describe('webhook', () => {
		it('should return empty response for unsubscribed events', async () => {
			(verifyFrameIoWebhook as Mock).mockResolvedValue(true);
			mockWebhookFunctions.getBodyData.mockReturnValue({
				type: 'comment.created',
				workspace: { id: 'workspace-1' },
			});
			mockWebhookFunctions.getNodeParameter.mockImplementation((name) => {
				if (name === 'events') return ['file.ready'];
				if (name === 'workspaceId') return 'workspace-1';
				return undefined;
			});
			mockWebhookFunctions.getWorkflowStaticData.mockReturnValue({});

			const result = await trigger.webhook!.call(
				mockWebhookFunctions as unknown as IWebhookFunctions,
			);

			expect(result).toEqual({});
		});

		it('should emit payload for matching events', async () => {
			const payload = {
				type: 'file.ready',
				workspace: { id: 'workspace-1' },
				resource: { id: 'file-1', type: 'file' },
			};

			(verifyFrameIoWebhook as Mock).mockResolvedValue(true);
			mockWebhookFunctions.getBodyData.mockReturnValue(payload);
			mockWebhookFunctions.getNodeParameter.mockImplementation((name) => {
				if (name === 'events') return ['file.ready'];
				if (name === 'workspaceId') return 'workspace-1';
				return undefined;
			});
			mockWebhookFunctions.getWorkflowStaticData.mockReturnValue({});

			const result = await trigger.webhook!.call(
				mockWebhookFunctions as unknown as IWebhookFunctions,
			);

			expect(result.workflowData).toBeDefined();
			expect(mockWebhookFunctions.helpers.returnJsonArray).toHaveBeenCalledWith(payload);
		});

		it('should emit any event when All Events is selected', async () => {
			const payload = {
				type: 'comment.created',
				workspace: { id: 'workspace-1' },
				resource: { id: 'comment-1', type: 'comment' },
			};

			(verifyFrameIoWebhook as Mock).mockResolvedValue(true);
			mockWebhookFunctions.getBodyData.mockReturnValue(payload);
			mockWebhookFunctions.getNodeParameter.mockImplementation((name) => {
				if (name === 'events') return ['*'];
				if (name === 'workspaceId') return 'workspace-1';
				return undefined;
			});
			mockWebhookFunctions.getWorkflowStaticData.mockReturnValue({});

			const result = await trigger.webhook!.call(
				mockWebhookFunctions as unknown as IWebhookFunctions,
			);

			expect(result.workflowData).toBeDefined();
			expect(mockWebhookFunctions.helpers.returnJsonArray).toHaveBeenCalledWith(payload);
		});
	});
});
