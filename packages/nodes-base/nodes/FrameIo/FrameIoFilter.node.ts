import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	type FrameIoFilterRoute,
	routeMatchesEvent,
	routeMatchesProject,
	routeMatchesResourceScope,
	frameIoFilterEventOptions,
} from './FrameIoFilterHelpers';
import type { INodeParameters } from 'n8n-workflow';
import { extractResourceLocatorValue, isResourceInFolderScope } from './GenericFunctions';
import type { FrameIoWebhookPayload } from './types';
import {
	getAccounts,
	getProjects,
	getShares,
	getWorkspaces,
	searchFiles,
	searchFolders,
	searchShares,
} from './LoadOptionsMethods';

const configuredFilterOutputs = (parameters: INodeParameters) => {
	const routes = (parameters.routes as IDataObject)?.route as FrameIoFilterRoute[] | undefined;
	const routeList = routes ?? [];
	return routeList.map((route, index) => ({
		type: 'main',
		displayName: route.outputKey || `Route ${index + 1}`,
	}));
};

export class FrameIoFilter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Frame.io Filter',
		name: 'frameIoFilter',
		icon: 'file:frameIo.svg',
		group: ['transform'],
		version: 1,
		description: 'Route Frame.io webhook events by project, folder, file, or share',
		defaults: {
			name: 'Frame.io Filter',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: `={{(${configuredFilterOutputs})($parameter)}}`,
		credentials: [
			{
				name: 'frameIoOAuth2Api',
				required: true,
			},
		],
		properties: [
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
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
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
					'Used for browsing folders, files, and shares. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Routes',
				name: 'routes',
				placeholder: 'Add Route',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: { route: [{ outputKey: 'Route 1', passAllEvents: true }] },
				options: [
					{
						name: 'route',
						displayName: 'Route',
						values: [
							{
								displayName: 'Output Name',
								name: 'outputKey',
								type: 'string',
								default: '',
								description:
									'Name for this route output. Suggested from the selected resource name.',
								placeholder: 'e.g. Dailies Folder',
							},
							{
								displayName: 'Pass All Events',
								name: 'passAllEvents',
								type: 'boolean',
								default: false,
								description: 'Whether to pass through every event without event-type filtering',
							},
							{
								displayName: 'Event Types',
								name: 'events',
								type: 'multiOptions',
								displayOptions: {
									show: {
										passAllEvents: [false],
									},
								},
								options: frameIoFilterEventOptions,
								default: [],
								description:
									'Events that should be routed to this output. Supports patterns like file.*',
							},
							{
								displayName: 'Limit to Project',
								name: 'projectId',
								type: 'options',
								default: '',
								typeOptions: {
									loadOptionsDependsOn: ['accountId', 'workspaceId'],
									loadOptionsMethod: 'getProjects',
								},
								description: 'If set, only events from this project are routed here',
							},
							{
								displayName: 'Scope Type',
								name: 'scopeType',
								type: 'options',
								options: [
									{ name: 'None', value: 'none' },
									{ name: 'Folder', value: 'folder' },
									{ name: 'File', value: 'file' },
									{ name: 'Share Link', value: 'share' },
								],
								default: 'none',
							},
							{
								displayName: 'Folder Name or ID',
								name: 'folder',
								type: 'resourceLocator',
								default: { mode: 'list', value: '' },
								required: true,
								displayOptions: {
									show: {
										scopeType: ['folder'],
									},
								},
								modes: [
									{
										displayName: 'From List',
										name: 'list',
										type: 'list',
										typeOptions: {
											searchListMethod: 'searchFolders',
											searchable: true,
										},
									},
									{
										displayName: 'By ID',
										name: 'id',
										type: 'string',
									},
								],
							},
							{
								displayName: 'Folder Scope',
								name: 'folderScope',
								type: 'options',
								displayOptions: {
									show: {
										scopeType: ['folder'],
									},
								},
								options: [
									{ name: 'This Folder Only', value: 'exact' },
									{ name: 'Folder and Subfolders', value: 'subtree' },
								],
								default: 'subtree',
							},
							{
								displayName: 'File Name or ID',
								name: 'file',
								type: 'resourceLocator',
								default: { mode: 'list', value: '' },
								required: true,
								displayOptions: {
									show: {
										scopeType: ['file'],
									},
								},
								modes: [
									{
										displayName: 'From List',
										name: 'list',
										type: 'list',
										typeOptions: {
											searchListMethod: 'searchFiles',
											searchable: true,
										},
									},
									{
										displayName: 'By ID',
										name: 'id',
										type: 'string',
									},
								],
							},
							{
								displayName: 'Share Name or ID',
								name: 'share',
								type: 'resourceLocator',
								default: { mode: 'list', value: '' },
								required: true,
								displayOptions: {
									show: {
										scopeType: ['share'],
									},
								},
								modes: [
									{
										displayName: 'From List',
										name: 'list',
										type: 'list',
										typeOptions: {
											searchListMethod: 'searchShares',
											searchable: true,
										},
									},
									{
										displayName: 'By ID',
										name: 'id',
										type: 'string',
									},
								],
							},
							{
								displayName: 'Share Scope',
								name: 'shareScope',
								type: 'options',
								displayOptions: {
									show: {
										scopeType: ['share'],
									},
								},
								options: [
									{ name: 'Entire Share', value: 'entire_share' },
									{ name: 'Folder Within Share', value: 'folder_in_share' },
									{
										name: 'Folder Within Share and Subfolders',
										value: 'folder_in_share_subtree',
									},
								],
								default: 'entire_share',
							},
							{
								displayName: 'Folder Within Share',
								name: 'shareFolder',
								type: 'resourceLocator',
								default: { mode: 'list', value: '' },
								displayOptions: {
									show: {
										scopeType: ['share'],
										shareScope: ['folder_in_share', 'folder_in_share_subtree'],
									},
								},
								modes: [
									{
										displayName: 'From List',
										name: 'list',
										type: 'list',
										typeOptions: {
											searchListMethod: 'searchFolders',
											searchable: true,
										},
									},
									{
										displayName: 'By ID',
										name: 'id',
										type: 'string',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getAccounts,
			getWorkspaces,
			getProjects,
			getShares,
		},
		listSearch: {
			searchFolders,
			searchFiles,
			searchShares,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const routes = (this.getNodeParameter('routes.route', 0, []) as FrameIoFilterRoute[]) ?? [];
		const accountId = this.getNodeParameter('accountId', 0) as string;

		const returnData: INodeExecutionData[][] = routes.map(() => []);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const payload = item.json as FrameIoWebhookPayload;

			for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
				const route = routes[routeIndex];

				if (!routeMatchesEvent(route, payload.type)) continue;
				if (!routeMatchesProject(route, payload)) continue;
				if (!routeMatchesResourceScope(route, payload)) continue;

				if (route.scopeType === 'folder') {
					const folderId = extractResourceLocatorValue(route.folder);
					if (folderId) {
						const inScope = await isResourceInFolderScope.call(
							this,
							accountId,
							payload,
							folderId,
							route.folderScope ?? 'subtree',
						);
						if (!inScope) continue;
					}
				}

				if (route.scopeType === 'share' && route.shareScope !== 'entire_share') {
					const shareFolderId = extractResourceLocatorValue(route.shareFolder);
					if (shareFolderId) {
						const inScope = await isResourceInFolderScope.call(
							this,
							accountId,
							payload,
							shareFolderId,
							route.shareScope === 'folder_in_share_subtree' ? 'subtree' : 'exact',
						);
						if (!inScope) continue;
					}
				}

				returnData[routeIndex].push(item);
			}
		}

		return returnData;
	}
}
