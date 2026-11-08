import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { FRAME_IO_ALL_EVENTS, resolveFrameIoWebhookEvents } from '../constants';
import { frameIoTriggerProperties } from '../descriptions/TriggerDescription';
import { verifyFrameIoWebhook } from '../FrameIoTriggerHelpers';
import { frameIoApiRequest } from '../GenericFunctions';
import { getAccounts, getWorkspaces } from '../LoadOptionsMethods';
import type { FrameIoWebhookPayload } from '../types';

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
			subtitle:
				'={{$parameter["events"].includes("*") ? "All events" : $parameter["events"].join(", ")}}',
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

				// Account changed since the webhook was created: let n8n recreate it.
				if (webhookData.accountId && webhookData.accountId !== accountId) {
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
				webhookData.accountId = accountId;
				// V4 create response exposes the secret once as `secret` (not `signing_secret`).
				const signingSecret = (data.secret ?? data.signing_secret) as string | undefined;
				if (signingSecret) {
					webhookData.signingSecret = signingSecret;
				}

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				// Delete from the account the webhook was created in, even if the parameter changed.
				const accountId =
					(webhookData.accountId as string | undefined) ??
					(this.getNodeParameter('accountId') as string);

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
				delete webhookData.accountId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const isValid = await verifyFrameIoWebhook.call(this);
		if (!isValid) {
			const res = this.getResponseObject();
			res.status(401).send('Unauthorized').end();
			return { noWebhookResponse: true };
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

		return {
			workflowData: [this.helpers.returnJsonArray(body as unknown as IDataObject)],
		};
	}
}
