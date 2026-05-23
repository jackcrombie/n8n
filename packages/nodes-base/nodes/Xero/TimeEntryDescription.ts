import type { INodeProperties } from 'n8n-workflow';

export const timeEntryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['timeEntry'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a time entry',
				action: 'Get a time entry',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many time entries',
				action: 'Get many time entries',
			},
		],
		default: 'getAll',
	},
];

export const timeEntryFields: INodeProperties[] = [
	{
		displayName: 'Organization Name or ID',
		name: 'organizationId',
		type: 'options',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: {
			loadOptionsMethod: 'getTenants',
		},
		default: '',
		displayOptions: {
			show: {
				resource: ['timeEntry'],
			},
		},
		required: true,
	},
	{
		displayName: 'Lookup Mode',
		name: 'lookupMode',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'By Project',
				value: 'byProject',
				description:
					'Requires a project ID and optionally filters by invoice ID within that project',
			},
			{
				name: 'By Invoice ID',
				value: 'byInvoiceId',
				description: 'Search all projects for time entries linked to an invoice ID',
			},
		],
		default: 'byProject',
	},
	{
		displayName: 'Project ID',
		name: 'projectId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['get'],
			},
		},
	},
	{
		displayName: 'Project ID',
		name: 'projectId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['getAll'],
				lookupMode: ['byProject'],
			},
		},
	},
	{
		displayName: 'Invoice ID',
		name: 'invoiceId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['getAll'],
				lookupMode: ['byInvoiceId'],
			},
		},
		required: true,
		description: 'The invoice ID to search for across all projects',
	},
	{
		displayName: 'Time Entry ID',
		name: 'timeEntryId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['get'],
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['getAll'],
				lookupMode: ['byProject'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['getAll'],
				returnAll: [false],
				lookupMode: ['byProject'],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 500,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['timeEntry'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Date After UTC',
				name: 'dateAfterUtc',
				type: 'string',
				default: '',
				description: 'ISO 8601 UTC date, for example 2024-01-01T00:00:00Z',
			},
			{
				displayName: 'Date Before UTC',
				name: 'dateBeforeUtc',
				type: 'string',
				default: '',
				description: 'ISO 8601 UTC date, for example 2024-12-31T23:59:59Z',
			},
			{
				displayName: 'Invoice ID',
				name: 'invoiceId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						'/lookupMode': ['byProject'],
					},
				},
				description: 'Filter time entries within the selected project by invoice ID',
			},
			{
				displayName: 'Is Chargeable',
				name: 'isChargeable',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'States',
				name: 'states',
				type: 'string',
				default: '',
				description: 'Comma-separated list of time entry states',
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				default: '',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
			},
		],
	},
];
