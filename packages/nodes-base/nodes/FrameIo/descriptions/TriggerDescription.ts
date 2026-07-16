import type { INodeProperties } from 'n8n-workflow';

import { FRAME_IO_ALL_EVENTS, FRAME_IO_WEBHOOK_EVENTS } from '../constants';

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
			'Use All Events for a generic catch-all webhook, then route with Frame.io Filter. Prefer fewer events when a workflow only cares about one concern.',
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
		default: [FRAME_IO_ALL_EVENTS],
		options: [
			{
				name: 'All Events',
				value: FRAME_IO_ALL_EVENTS,
				description: 'Catch every Frame.io event and pass it downstream',
			},
			...FRAME_IO_WEBHOOK_EVENTS.map((event) => ({
				name: event.name,
				value: event.value,
			})),
		],
		description:
			'Events to subscribe to. Choose All Events for a generic webhook that forwards everything.',
	},
];
