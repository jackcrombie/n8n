import type { INodeProperties } from 'n8n-workflow';

import { updateDisplayOptions } from '../../../../utils/utilities';
import {
	accountIdField,
	additionalFieldsProperty,
	limitField,
	projectIdField,
	returnAllField,
	workspaceIdField,
} from './shared';

const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['account'],
			},
		},
		options: [
			{
				name: 'List',
				value: 'list',
				description: 'List all accounts',
				action: 'List accounts',
			},
		],
		default: 'list',
	},
];

const workspaceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['workspace'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a workspace' },
			{ name: 'Delete', value: 'delete', action: 'Delete a workspace' },
			{ name: 'Get', value: 'get', action: 'Get a workspace' },
			{ name: 'List', value: 'list', action: 'List workspaces' },
			{ name: 'Update', value: 'update', action: 'Update a workspace' },
		],
		default: 'list',
	},
];

const projectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['project'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a project' },
			{ name: 'Delete', value: 'delete', action: 'Delete a project' },
			{ name: 'Get', value: 'get', action: 'Get a project' },
			{ name: 'List', value: 'list', action: 'List projects' },
			{ name: 'Update', value: 'update', action: 'Update a project' },
		],
		default: 'list',
	},
];

const folderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['folder'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a folder' },
			{ name: 'Delete', value: 'delete', action: 'Delete a folder' },
			{ name: 'Get', value: 'get', action: 'Get a folder' },
			{ name: 'List Children', value: 'listChildren', action: 'List folder children' },
			{ name: 'Update', value: 'update', action: 'Update a folder' },
		],
		default: 'get',
	},
];

const fileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a file' },
			{ name: 'Get', value: 'get', action: 'Get a file' },
			{ name: 'Update', value: 'update', action: 'Update a file' },
		],
		default: 'get',
	},
];

const commentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['comment'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a comment' },
			{ name: 'Delete', value: 'delete', action: 'Delete a comment' },
			{ name: 'Get', value: 'get', action: 'Get a comment' },
			{ name: 'List', value: 'list', action: 'List comments' },
			{ name: 'Update', value: 'update', action: 'Update a comment' },
		],
		default: 'list',
	},
];

const versionStackOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['versionStack'],
			},
		},
		options: [
			{ name: 'Copy', value: 'copy', action: 'Copy a version stack' },
			{ name: 'Create', value: 'create', action: 'Create a version stack' },
			{ name: 'Get', value: 'get', action: 'Get a version stack' },
			{ name: 'List', value: 'list', action: 'List version stacks' },
			{ name: 'List Children', value: 'listChildren', action: 'List version stack children' },
			{ name: 'Move', value: 'move', action: 'Move a version stack' },
		],
		default: 'list',
	},
];

const shareOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['share'],
			},
		},
		options: [
			{ name: 'Add Asset', value: 'addAsset', action: 'Add an asset to a share' },
			{ name: 'Create', value: 'create', action: 'Create a share' },
			{ name: 'Delete', value: 'delete', action: 'Delete a share' },
			{ name: 'Get', value: 'get', action: 'Get a share' },
			{ name: 'List', value: 'list', action: 'List shares' },
			{ name: 'Remove Asset', value: 'removeAsset', action: 'Remove an asset from a share' },
			{ name: 'Update', value: 'update', action: 'Update a share' },
		],
		default: 'list',
	},
];

const webhookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['webhook'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a webhook' },
			{ name: 'Delete', value: 'delete', action: 'Delete a webhook' },
			{ name: 'Get', value: 'get', action: 'Get a webhook' },
			{ name: 'List', value: 'list', action: 'List webhooks' },
			{ name: 'Update', value: 'update', action: 'Update a webhook' },
		],
		default: 'list',
	},
];

const metadataOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['metadata'],
			},
		},
		options: [{ name: 'Update', value: 'update', action: 'Update metadata values' }],
		default: 'update',
	},
];

const collectionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['collection'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a collection' },
			{ name: 'Delete', value: 'delete', action: 'Delete a collection' },
			{ name: 'Get', value: 'get', action: 'Get a collection' },
			{ name: 'List', value: 'list', action: 'List collections' },
			{ name: 'Update', value: 'update', action: 'Update a collection' },
		],
		default: 'list',
	},
];

const customFieldOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['customField'],
			},
		},
		options: [
			{ name: 'Create', value: 'create', action: 'Create a custom field' },
			{ name: 'Delete', value: 'delete', action: 'Delete a custom field' },
			{ name: 'Get', value: 'get', action: 'Get a custom field' },
			{ name: 'List', value: 'list', action: 'List custom fields' },
			{ name: 'Update', value: 'update', action: 'Update a custom field' },
		],
		default: 'list',
	},
];

const permissionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['permission'],
			},
		},
		options: [
			{ name: 'List Users', value: 'listUsers', action: 'List users with permissions' },
			{ name: 'Update User Role', value: 'updateUserRole', action: 'Update a user role' },
		],
		default: 'listUsers',
	},
];

const workspaceFields = updateDisplayOptions(
	{
		show: {
			resource: ['workspace'],
			operation: ['create', 'delete', 'get', 'list', 'update'],
		},
	},
	[
		accountIdField,
		{
			displayName: 'Workspace ID',
			name: 'workspaceId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['workspace'],
					operation: ['delete', 'get', 'update'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['workspace'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const projectFields = updateDisplayOptions(
	{
		show: {
			resource: ['project'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		{
			displayName: 'Project ID',
			name: 'projectId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['project'],
					operation: ['delete', 'get', 'update'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Description',
					name: 'description',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['project'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const folderFields = updateDisplayOptions(
	{
		show: {
			resource: ['folder'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		projectIdField,
		{
			displayName: 'Folder ID',
			name: 'folderId',
			type: 'string',
			required: true,
			default: '',
			description: 'The folder to operate on',
			displayOptions: {
				show: {
					resource: ['folder'],
					operation: ['delete', 'get', 'listChildren', 'update'],
				},
			},
		},
		{
			displayName: 'Parent Folder ID',
			name: 'parentFolderId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					resource: ['folder'],
					operation: ['create'],
				},
			},
			description: 'Parent folder ID. Leave empty to use the project root folder.',
		},
		{
			displayName: 'Child Type',
			name: 'childType',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['folder'],
					operation: ['listChildren'],
				},
			},
			options: [
				{ name: 'Folders', value: 'folders' },
				{ name: 'Files', value: 'files' },
				{ name: 'Both', value: 'both' },
			],
			default: 'both',
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['folder'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const fileFields = updateDisplayOptions(
	{
		show: {
			resource: ['file'],
		},
	},
	[
		accountIdField,
		{
			displayName: 'File ID',
			name: 'fileId',
			type: 'string',
			required: true,
			default: '',
		},
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Include',
					name: 'include',
					type: 'string',
					default: '',
					description: 'Comma-separated include parameters for the GET request',
				},
			],
			{
				show: {
					resource: ['file'],
					operation: ['get', 'update'],
				},
			},
		),
	],
);

const commentFields = updateDisplayOptions(
	{
		show: {
			resource: ['comment'],
		},
	},
	[
		accountIdField,
		{
			displayName: 'File ID',
			name: 'fileId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['comment'],
					operation: ['create', 'list'],
				},
			},
		},
		{
			displayName: 'Comment ID',
			name: 'commentId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['comment'],
					operation: ['delete', 'get', 'update'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Text',
					name: 'text',
					type: 'string',
					typeOptions: {
						rows: 4,
					},
					default: '',
				},
				{
					displayName: 'Timestamp',
					name: 'timestamp',
					type: 'number',
					default: 0,
					description: 'Timestamp in seconds for time-coded comments',
				},
			],
			{
				show: {
					resource: ['comment'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const versionStackFields = updateDisplayOptions(
	{
		show: {
			resource: ['versionStack'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		projectIdField,
		{
			displayName: 'Version Stack ID',
			name: 'versionStackId',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'Parent Folder ID',
			name: 'parentFolderId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					resource: ['versionStack'],
					operation: ['create', 'copy', 'move'],
				},
			},
		},
		{
			displayName: 'Destination Folder ID',
			name: 'destinationFolderId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					resource: ['versionStack'],
					operation: ['copy', 'move'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['versionStack'],
					operation: ['create'],
				},
			},
		),
	],
);

const shareFields = updateDisplayOptions(
	{
		show: {
			resource: ['share'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		projectIdField,
		{
			displayName: 'Share ID',
			name: 'shareId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['share'],
					operation: ['addAsset', 'delete', 'get', 'removeAsset', 'update'],
				},
			},
		},
		{
			displayName: 'Asset ID',
			name: 'assetId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					resource: ['share'],
					operation: ['addAsset', 'removeAsset'],
				},
			},
		},
		{
			displayName: 'Asset Type',
			name: 'assetType',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['share'],
					operation: ['addAsset'],
				},
			},
			options: [
				{ name: 'File', value: 'file' },
				{ name: 'Folder', value: 'folder' },
			],
			default: 'file',
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['share'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const webhookFields = updateDisplayOptions(
	{
		show: {
			resource: ['webhook'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		{
			displayName: 'Webhook ID',
			name: 'webhookId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['webhook'],
					operation: ['delete', 'get', 'update'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
				{
					displayName: 'URL',
					name: 'url',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Events',
					name: 'events',
					type: 'string',
					default: '',
					description: 'Comma-separated list of webhook events',
				},
				{
					displayName: 'Active',
					name: 'active',
					type: 'boolean',
					default: true,
				},
			],
			{
				show: {
					resource: ['webhook'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const metadataFields = updateDisplayOptions(
	{
		show: {
			resource: ['metadata'],
			operation: ['update'],
		},
	},
	[
		accountIdField,
		{
			displayName: 'Resource Type',
			name: 'resourceType',
			type: 'options',
			options: [
				{ name: 'File', value: 'file' },
				{ name: 'Folder', value: 'folder' },
				{ name: 'Project', value: 'project' },
			],
			default: 'file',
		},
		{
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'Metadata Values (JSON)',
			name: 'metadataValues',
			type: 'json',
			default: '{}',
			description: 'Metadata key-value pairs to update',
		},
	],
);

const collectionFields = updateDisplayOptions(
	{
		show: {
			resource: ['collection'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		projectIdField,
		{
			displayName: 'Collection ID',
			name: 'collectionId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['collection'],
					operation: ['delete', 'get', 'update'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['collection'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const customFieldFields = updateDisplayOptions(
	{
		show: {
			resource: ['customField'],
		},
	},
	[
		accountIdField,
		workspaceIdField,
		projectIdField,
		{
			displayName: 'Custom Field ID',
			name: 'customFieldId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					resource: ['customField'],
					operation: ['delete', 'get', 'update'],
				},
			},
		},
		returnAllField,
		limitField,
		additionalFieldsProperty(
			[
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Field Type',
					name: 'field_type',
					type: 'string',
					default: '',
				},
			],
			{
				show: {
					resource: ['customField'],
					operation: ['create', 'update'],
				},
			},
		),
	],
);

const permissionFields = updateDisplayOptions(
	{
		show: {
			resource: ['permission'],
		},
	},
	[
		accountIdField,
		{
			displayName: 'Scope',
			name: 'permissionScope',
			type: 'options',
			options: [
				{ name: 'Workspace', value: 'workspace' },
				{ name: 'Project', value: 'project' },
			],
			default: 'project',
		},
		{
			...workspaceIdField,
			displayOptions: {
				show: {
					resource: ['permission'],
					permissionScope: ['workspace', 'project'],
				},
			},
		},
		{
			...projectIdField,
			displayOptions: {
				show: {
					resource: ['permission'],
					permissionScope: ['project'],
				},
			},
		},
		{
			displayName: 'User ID',
			name: 'userId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					resource: ['permission'],
					operation: ['updateUserRole'],
				},
			},
		},
		{
			displayName: 'Role',
			name: 'role',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					resource: ['permission'],
					operation: ['updateUserRole'],
				},
			},
		},
		returnAllField,
		limitField,
	],
);

export const frameIoProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Workspace', value: 'workspace' },
			{ name: 'Project', value: 'project' },
			{ name: 'Folder', value: 'folder' },
			{ name: 'File', value: 'file' },
			{ name: 'Comment', value: 'comment' },
			{ name: 'Version Stack', value: 'versionStack' },
			{ name: 'Share', value: 'share' },
			{ name: 'Webhook', value: 'webhook' },
			{ name: 'Metadata', value: 'metadata' },
			{ name: 'Collection', value: 'collection' },
			{ name: 'Custom Field', value: 'customField' },
			{ name: 'Permission', value: 'permission' },
		],
		default: 'project',
	},
	...accountOperations,
	...workspaceOperations,
	...projectOperations,
	...folderOperations,
	...fileOperations,
	...commentOperations,
	...versionStackOperations,
	...shareOperations,
	...webhookOperations,
	...metadataOperations,
	...collectionOperations,
	...customFieldOperations,
	...permissionOperations,
	...workspaceFields,
	...projectFields,
	...folderFields,
	...fileFields,
	...commentFields,
	...versionStackFields,
	...shareFields,
	...webhookFields,
	...metadataFields,
	...collectionFields,
	...customFieldFields,
	...permissionFields,
];
