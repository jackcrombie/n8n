import type { INodeProperties } from 'n8n-workflow';

import { FRAME_IO_WEBHOOK_EVENTS } from '../constants';

export const frameIoTriggerProperties: INodeProperties[] = [
	{
		displayName:
			'The webhook signing secret is stored when the webhook is created. Deactivating and reactivating the workflow creates a new webhook and secret.',
		name: 'signingSecretNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'For file processing workflows, prefer file.ready or file.upload.completed over file.created — uploads may still be in progress when file.created fires.',
		name: 'fileCreatedNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'Subscribe to fewer events per webhook when possible. Frame.io recommends splitting webhooks by logical concern.',
		name: 'eventsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Account Name or ID',
		name: 'accountId',
		type: 'options',
		required: true,
		default: '',
		typeOptions: {
			loadOptionsMethod: 'getAccounts',
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Workspace Name or ID',
		name: 'workspaceId',
		type: 'options',
		required: true,
		default: '',
		typeOptions: {
			loadOptionsDependsOn: ['accountId'],
			loadOptionsMethod: 'getWorkspaces',
		},
		description:
			'Webhook attachment point. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Events',
		name: 'events',
		type: 'multiOptions',
		required: true,
		default: [],
		options: FRAME_IO_WEBHOOK_EVENTS.map((event) => ({
			name: event.name,
			value: event.value,
		})),
		description: 'The events to subscribe to at Frame.io',
	},
];
