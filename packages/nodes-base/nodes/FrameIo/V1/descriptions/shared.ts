import type { INodeProperties } from 'n8n-workflow';

export const accountIdField: INodeProperties = {
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
};

export const workspaceIdField: INodeProperties = {
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
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

export const projectIdField: INodeProperties = {
	displayName: 'Project Name or ID',
	name: 'projectId',
	type: 'options',
	required: true,
	default: '',
	typeOptions: {
		loadOptionsDependsOn: ['accountId', 'workspaceId'],
		loadOptionsMethod: 'getProjects',
	},
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

export const returnAllField: INodeProperties = {
	displayName: 'Return All',
	name: 'returnAll',
	type: 'boolean',
	default: false,
	description: 'Whether to return all results or only up to a given limit',
};

export const limitField: INodeProperties = {
	displayName: 'Limit',
	name: 'limit',
	type: 'number',
	typeOptions: {
		minValue: 1,
	},
	displayOptions: {
		show: {
			returnAll: [false],
		},
	},
	default: 50,
	description: 'Max number of results to return',
};

export const additionalFieldsProperty = (
	fields: INodeProperties[],
	displayOptions: INodeProperties['displayOptions'],
): INodeProperties => ({
	displayName: 'Additional Fields',
	name: 'additionalFields',
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions,
	options: fields,
});
