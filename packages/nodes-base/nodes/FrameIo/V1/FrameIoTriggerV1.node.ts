import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import { frameIoTriggerProperties } from '../descriptions/TriggerDescription';
import { FRAME_IO_ALL_EVENTS, resolveFrameIoWebhookEvents } from '../constants';
import { frameIoApiRequest, invalidateCacheFromWebhook } from '../GenericFunctions';
import type { FrameIoWebhookPayload } from '../types';
import { verifyFrameIoWebhook } from '../FrameIoTriggerHelpers';
import { getAccounts, getWorkspaces } from '../LoadOptionsMethods';

export class FrameIoTriggerV1 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			displayName: 'Frame.io Trigger',
			name: 'frameIoTrigger',
			icon: 'file:frameIo.svg',
			group: ['trigger'],
			version: 1,
			subtitle: '={{$parameter["workspaceId"]}}',
			description: 'Starts the workflow when Frame.io events occur',
			defaults: {
				name: 'Frame.io Trigger',
			},
			inputs: [],
			outputs: [NodeConnectionTypes.Main],
			credentials: [
				{
					name: 'frameIoOAuth2Api',
					required: true,
				},
			],
			webhooks: [
				{
					name: 'default',
					httpMethod: 'POST',
					responseMode: 'onReceived',
					path: 'webhook',
				},
			],
			properties: frameIoTriggerProperties,
		};
	}

	methods = {
		loadOptions: {
			getAccounts,
			getWorkspaces,
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const accountId = this.getNodeParameter('accountId') as string;
				const webhookUrl = this.getNodeWebhookUrl('default');

				if (!webhookData.webhookId) {
					return false;
				}

				try {
					const response = await frameIoApiRequest.call(
						this,
						'GET',
						`/v4/accounts/${accountId}/webhooks/${webhookData.webhookId}`,
					);
					const data = (response.data as Record<string, unknown>) ?? response;
					return data.url === webhookUrl && data.active !== false;
				} catch {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const accountId = this.getNodeParameter('accountId') as string;
				const workspaceId = this.getNodeParameter('workspaceId') as string;
				const events = resolveFrameIoWebhookEvents(this.getNodeParameter('events') as string[]);
				const webhookUrl = this.getNodeWebhookUrl('default');
				const workflow = this.getWorkflow();

				const body = {
					data: {
						name: `n8n workflow ${workflow.id}`,
						url: webhookUrl,
						events,
					},
				};

				const response = await frameIoApiRequest.call(
					this,
					'POST',
					`/v4/accounts/${accountId}/workspaces/${workspaceId}/webhooks`,
					body,
				);

				const data = (response.data as Record<string, unknown>) ?? response;
				webhookData.webhookId = data.id as string;
				if (data.signing_secret) {
					webhookData.signingSecret = data.signing_secret as string;
				}

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const accountId = this.getNodeParameter('accountId') as string;

				if (!webhookData.webhookId) {
					return true;
				}

				try {
					await frameIoApiRequest.call(
						this,
						'DELETE',
						`/v4/accounts/${accountId}/webhooks/${webhookData.webhookId}`,
					);
				} catch (error) {
					return false;
				}

				delete webhookData.webhookId;
				delete webhookData.signingSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const isValid = await verifyFrameIoWebhook.call(this);
		if (!isValid) {
			throw new NodeApiError(this.getNode(), {
				message: 'Invalid Frame.io webhook signature',
			});
		}

		const body = this.getBodyData() as FrameIoWebhookPayload;
		const subscribedEvents = this.getNodeParameter('events') as string[];
		const workspaceId = this.getNodeParameter('workspaceId') as string;

		if (body.workspace?.id && body.workspace.id !== workspaceId) {
			return {};
		}

		const catchAll = subscribedEvents.includes(FRAME_IO_ALL_EVENTS);
		if (!catchAll && !subscribedEvents.includes(body.type)) {
			return {};
		}

		const globalStaticData = this.getWorkflowStaticData('global');
		invalidateCacheFromWebhook(globalStaticData, body);

		return {
			workflowData: [this.helpers.returnJsonArray(body as unknown as IDataObject)],
		};
	}
}
