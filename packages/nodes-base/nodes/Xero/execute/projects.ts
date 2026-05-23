import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import {
	searchTimeEntriesByInvoiceId,
	xeroApiRequest,
	xeroApiRequestAllItems,
} from '../GenericFunctions';

function buildProjectFilters(filters: IDataObject): IDataObject {
	const qs: IDataObject = {};

	if (filters.contactId) {
		qs.contactID = filters.contactId;
	}
	if (filters.projectIds) {
		qs.projectIds = filters.projectIds;
	}
	if (filters.states) {
		qs.states = filters.states;
	}

	return qs;
}

function buildTaskFilters(filters: IDataObject): IDataObject {
	const qs: IDataObject = {};

	if (filters.chargeType) {
		qs.chargeType = filters.chargeType;
	}
	if (filters.taskIds) {
		qs.taskIds = filters.taskIds;
	}

	return qs;
}

function buildTimeEntryFilters(filters: IDataObject): IDataObject {
	const qs: IDataObject = {};

	if (filters.contactId) {
		qs.contactId = filters.contactId;
	}
	if (filters.dateAfterUtc) {
		qs.dateAfterUtc = filters.dateAfterUtc;
	}
	if (filters.dateBeforeUtc) {
		qs.dateBeforeUtc = filters.dateBeforeUtc;
	}
	if (filters.invoiceId) {
		qs.invoiceId = filters.invoiceId;
	}
	if (filters.isChargeable) {
		qs.isChargeable = filters.isChargeable;
	}
	if (filters.states) {
		qs.states = filters.states;
	}
	if (filters.taskId) {
		qs.taskId = filters.taskId;
	}
	if (filters.userId) {
		qs.userId = filters.userId;
	}

	return qs;
}

export async function executeProjectOperations(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	const organizationId = this.getNodeParameter('organizationId', i) as string;

	if (operation === 'get') {
		const projectId = this.getNodeParameter('projectId', i) as string;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			`/Projects/${projectId}`,
			{ organizationId },
			{},
			undefined,
			{},
			'project',
		)) as IDataObject;

		return [responseData];
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i);
		const filters = this.getNodeParameter('filters', i) as IDataObject;
		const qs = buildProjectFilters(filters);

		if (returnAll) {
			return await xeroApiRequestAllItems.call(
				this,
				'items',
				'GET',
				'/Projects',
				{ organizationId },
				qs,
				'project',
			);
		}

		const limit = this.getNodeParameter('limit', i) as number;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			'/Projects',
			{ organizationId },
			qs,
			undefined,
			{},
			'project',
		)) as IDataObject;

		return (responseData.items as IDataObject[]).slice(0, limit);
	}

	return [];
}

export async function executeTaskOperations(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	const organizationId = this.getNodeParameter('organizationId', i) as string;
	const projectId = this.getNodeParameter('projectId', i) as string;

	if (operation === 'get') {
		const taskId = this.getNodeParameter('taskId', i) as string;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			`/Projects/${projectId}/Tasks/${taskId}`,
			{ organizationId },
			{},
			undefined,
			{},
			'task',
		)) as IDataObject;

		return [responseData];
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i);
		const filters = this.getNodeParameter('filters', i) as IDataObject;
		const qs = buildTaskFilters(filters);

		if (returnAll) {
			return await xeroApiRequestAllItems.call(
				this,
				'items',
				'GET',
				`/Projects/${projectId}/Tasks`,
				{ organizationId },
				qs,
				'task',
			);
		}

		const limit = this.getNodeParameter('limit', i) as number;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			`/Projects/${projectId}/Tasks`,
			{ organizationId },
			qs,
			undefined,
			{},
			'task',
		)) as IDataObject;

		return (responseData.items as IDataObject[]).slice(0, limit);
	}

	return [];
}

export async function executeTimeEntryOperations(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	const organizationId = this.getNodeParameter('organizationId', i) as string;

	if (operation === 'get') {
		const projectId = this.getNodeParameter('projectId', i) as string;
		const timeEntryId = this.getNodeParameter('timeEntryId', i) as string;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			`/Projects/${projectId}/Time/${timeEntryId}`,
			{ organizationId },
			{},
			undefined,
			{},
			'timeEntry',
		)) as IDataObject;

		return [responseData];
	}

	if (operation === 'getAll') {
		const lookupMode = this.getNodeParameter('lookupMode', i) as string;
		const filters = this.getNodeParameter('filters', i) as IDataObject;
		const qs = buildTimeEntryFilters(filters);

		if (lookupMode === 'byInvoiceId') {
			const invoiceId = this.getNodeParameter('invoiceId', i) as string;
			return await searchTimeEntriesByInvoiceId.call(this, organizationId, invoiceId, qs);
		}

		const projectId = this.getNodeParameter('projectId', i) as string;
		const returnAll = this.getNodeParameter('returnAll', i);

		if (returnAll) {
			return await xeroApiRequestAllItems.call(
				this,
				'items',
				'GET',
				`/Projects/${projectId}/Time`,
				{ organizationId },
				qs,
				'timeEntry',
			);
		}

		const limit = this.getNodeParameter('limit', i) as number;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			`/Projects/${projectId}/Time`,
			{ organizationId },
			qs,
			undefined,
			{},
			'timeEntry',
		)) as IDataObject;

		return (responseData.items as IDataObject[]).slice(0, limit);
	}

	return [];
}
