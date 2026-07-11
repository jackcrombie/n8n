import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { frameIoProperties } from './descriptions';
import { executeFrameIo } from './FrameIoV1.execute';
import {
	getAccounts,
	getProjects,
	getShares,
	getWorkspaces,
	searchFiles,
	searchFolders,
} from '../LoadOptionsMethods';

export class FrameIoV1 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			displayName: 'Frame.io',
			name: 'frameIo',
			icon: 'file:frameIo.svg',
			group: ['transform'],
			version: 1,
			subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
			description: 'Consume the Frame.io API',
			defaults: {
				name: 'Frame.io',
			},
			inputs: [NodeConnectionTypes.Main],
			outputs: [NodeConnectionTypes.Main],
			credentials: [
				{
					name: 'frameIoOAuth2Api',
					required: true,
				},
			],
			properties: frameIoProperties,
			usableAsTool: true,
		};
	}

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
		},
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const returnData = await executeFrameIo.call(this, items);
		return [returnData];
	}
}
