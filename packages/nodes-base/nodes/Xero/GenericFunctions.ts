import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	JsonObject,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export interface XeroApiUsage {
	apiCallCount: number;
	minLimitRemaining?: number;
	dayLimitRemaining?: number;
	appMinLimitRemaining?: number;
	rateLimitProblem?: string;
}

interface IFullHttpResponse {
	body: unknown;
	headers: IDataObject;
	statusCode: number;
	statusMessage?: string;
}

const xeroApiUsageStore = new WeakMap<object, XeroApiUsage>();

function isFullHttpResponse(value: unknown): value is IFullHttpResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'body' in value &&
		'headers' in value &&
		'statusCode' in value
	);
}

function getResponseHeaders(source: unknown): IDataObject | undefined {
	if (!source || typeof source !== 'object') {
		return undefined;
	}

	const object = source as IDataObject;
	if (object.headers && typeof object.headers === 'object') {
		return object.headers as IDataObject;
	}

	if (object.response && typeof object.response === 'object') {
		const response = object.response as IDataObject;
		if (response.headers && typeof response.headers === 'object') {
			return response.headers as IDataObject;
		}
	}

	return undefined;
}

function getHeaderValue(headers: IDataObject, headerName: string): string | undefined {
	const normalizedHeaderName = headerName.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== normalizedHeaderName) {
			continue;
		}

		if (Array.isArray(value)) {
			return value[0]?.toString();
		}

		return value?.toString();
	}

	return undefined;
}

function parseRateLimitHeader(headers: IDataObject, headerName: string): number | undefined {
	const headerValue = getHeaderValue(headers, headerName);
	if (headerValue === undefined) {
		return undefined;
	}

	const parsedValue = Number.parseInt(headerValue, 10);
	return Number.isNaN(parsedValue) ? undefined : parsedValue;
}

function getOrCreateXeroApiUsage(context: object): XeroApiUsage {
	let usage = xeroApiUsageStore.get(context);
	if (!usage) {
		usage = { apiCallCount: 0 };
		xeroApiUsageStore.set(context, usage);
	}

	return usage;
}

export function getXeroApiUsage(context: object): XeroApiUsage {
	return { ...getOrCreateXeroApiUsage(context) };
}

function recordXeroApiUsage(context: object, headers?: IDataObject): void {
	const usage = getOrCreateXeroApiUsage(context);
	usage.apiCallCount += 1;

	if (!headers) {
		return;
	}

	const minLimitRemaining = parseRateLimitHeader(headers, 'X-MinLimit-Remaining');
	if (minLimitRemaining !== undefined) {
		usage.minLimitRemaining = minLimitRemaining;
	}

	const dayLimitRemaining = parseRateLimitHeader(headers, 'X-DayLimit-Remaining');
	if (dayLimitRemaining !== undefined) {
		usage.dayLimitRemaining = dayLimitRemaining;
	}

	const appMinLimitRemaining = parseRateLimitHeader(headers, 'X-AppMinLimit-Remaining');
	if (appMinLimitRemaining !== undefined) {
		usage.appMinLimitRemaining = appMinLimitRemaining;
	}

	const rateLimitProblem = getHeaderValue(headers, 'X-Rate-Limit-Problem');
	if (rateLimitProblem) {
		usage.rateLimitProblem = rateLimitProblem;
	}
}

export function buildXeroApiUsageMessage(usage: XeroApiUsage): string {
	const callLabel = usage.apiCallCount === 1 ? 'call' : 'calls';
	const messageParts = [`This execution made ${usage.apiCallCount} Xero API ${callLabel}.`];

	const limitParts: string[] = [];
	if (usage.minLimitRemaining !== undefined) {
		limitParts.push(`${usage.minLimitRemaining}/min remaining (organization)`);
	}
	if (usage.dayLimitRemaining !== undefined) {
		limitParts.push(`${usage.dayLimitRemaining}/day remaining (organization)`);
	}
	if (usage.appMinLimitRemaining !== undefined) {
		limitParts.push(`${usage.appMinLimitRemaining}/min remaining (app)`);
	}

	if (limitParts.length > 0) {
		messageParts.push(`Rate limits: ${limitParts.join(', ')}.`);
	}

	if (usage.rateLimitProblem) {
		messageParts.push(`Latest rate limit issue: ${usage.rateLimitProblem}.`);
	}

	return messageParts.join(' ');
}

export function addXeroApiUsageHint(context: IExecuteFunctions): void {
	const usage = xeroApiUsageStore.get(context);
	if (!usage || usage.apiCallCount === 0) {
		return;
	}

	context.addExecutionHints({
		type: usage.rateLimitProblem ? 'warning' : 'info',
		message: buildXeroApiUsageMessage(usage),
		location: 'outputPane',
	});
}

async function xeroOAuth2Request(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	options: IRequestOptions,
): Promise<unknown> {
	options.resolveWithFullResponse = true;

	try {
		const response = await this.helpers.requestOAuth2.call(this, 'xeroOAuth2Api', options);
		if (isFullHttpResponse(response)) {
			recordXeroApiUsage(this, response.headers);
			return response.body;
		}

		recordXeroApiUsage(this);
		return response;
	} catch (error) {
		recordXeroApiUsage(this, getResponseHeaders(error));
		throw error;
	}
}

export const XERO_ACCOUNTING_BASE_URL = 'https://api.xero.com/api.xro/2.0';
export const XERO_PROJECTS_BASE_URL = 'https://api.xero.com/projects.xro/2.0';
export const XERO_FILES_BASE_URL = 'https://api.xero.com/files.xro/1.0';
export const XERO_ASSETS_BASE_URL = 'https://api.xero.com/assets.xro/1.0';
export const XERO_FINANCE_BASE_URL = 'https://api.xero.com/finance.xro/1.0';

export type XeroNodeResource =
	| 'contact'
	| 'invoice'
	| 'project'
	| 'task'
	| 'timeEntry'
	| 'file'
	| 'folder'
	| 'asset'
	| 'assetType'
	| 'finance';

export function getXeroBaseUrl(nodeResource?: string): string {
	switch (nodeResource) {
		case 'project':
		case 'task':
		case 'timeEntry':
			return XERO_PROJECTS_BASE_URL;
		case 'file':
		case 'folder':
			return XERO_FILES_BASE_URL;
		case 'asset':
		case 'assetType':
			return XERO_ASSETS_BASE_URL;
		case 'finance':
			return XERO_FINANCE_BASE_URL;
		default:
			return XERO_ACCOUNTING_BASE_URL;
	}
}

export function getXeroApiUri(endpoint: string, nodeResource?: string, uri?: string): string {
	if (uri) {
		return uri;
	}

	return `${getXeroBaseUrl(nodeResource)}${endpoint}`;
}

function applyOrganizationIdHeader(options: IRequestOptions, body: IDataObject): void {
	if (body.organizationId) {
		options.headers = {
			...options.headers,
			'Xero-tenant-id': body.organizationId as string,
		};
		delete body.organizationId;
	}
}

export async function xeroApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	headers: IDataObject = {},
	nodeResource?: string,
): Promise<IDataObject> {
	const requestBody = { ...body };
	const options: IRequestOptions = {
		headers: {
			'Content-Type': 'application/json',
		},
		method,
		body: requestBody,
		qs: { ...qs },
		uri: getXeroApiUri(endpoint, nodeResource, uri),
		json: true,
	};

	try {
		applyOrganizationIdHeader(options, requestBody);

		if (Object.keys(headers).length !== 0) {
			options.headers = Object.assign({}, options.headers, headers);
		}
		if (Object.keys(requestBody).length === 0) {
			delete options.body;
		}
		return (await xeroOAuth2Request.call(this, options)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function xeroApiRequestBinary(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	organizationId: string,
	qs: IDataObject = {},
	nodeResource?: string,
): Promise<Buffer> {
	const options: IRequestOptions = {
		headers: {
			'Xero-tenant-id': organizationId,
		},
		method,
		qs: { ...qs },
		uri: getXeroApiUri(endpoint, nodeResource),
		encoding: null,
		json: false,
	};

	try {
		if (Object.keys(qs).length === 0) {
			delete options.qs;
		}

		const response = await xeroOAuth2Request.call(this, options);
		return response as Buffer;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function xeroApiRequestMultipart(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	organizationId: string,
	formData: IDataObject,
	qs: IDataObject = {},
	nodeResource?: string,
): Promise<IDataObject> {
	const options: IRequestOptions = {
		headers: {
			'Xero-tenant-id': organizationId,
		},
		method,
		qs: { ...qs },
		formData,
		uri: getXeroApiUri(endpoint, nodeResource),
		json: true,
	};

	try {
		if (Object.keys(qs).length === 0) {
			delete options.qs;
		}

		return (await xeroOAuth2Request.call(this, options)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function xeroApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
	nodeResource?: string,
	pageSize?: number,
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	const paginationQuery: IDataObject = { ...query, page: 1 };

	if (pageSize !== undefined) {
		paginationQuery.pageSize = pageSize;
	} else if (
		nodeResource === 'project' ||
		nodeResource === 'task' ||
		nodeResource === 'timeEntry'
	) {
		paginationQuery.pageSize = 50;
	}

	let items: IDataObject[] = [];

	do {
		const responseData = (await xeroApiRequest.call(
			this,
			method,
			endpoint,
			body,
			paginationQuery,
			undefined,
			{},
			nodeResource,
		)) as IDataObject;

		items = responseData[propertyName] as IDataObject[];
		returnData.push(...items);
		paginationQuery.page = (paginationQuery.page as number) + 1;
	} while (items.length !== 0);

	return returnData;
}

export async function searchTimeEntriesByInvoiceId(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	organizationId: string,
	invoiceId: string,
	query: IDataObject = {},
): Promise<IDataObject[]> {
	const projects = await xeroApiRequestAllItems.call(
		this,
		'items',
		'GET',
		'/Projects',
		{ organizationId },
		{},
		'project',
	);

	const returnData: IDataObject[] = [];

	for (const project of projects) {
		const projectId = project.projectId as string;
		const responseData = (await xeroApiRequest.call(
			this,
			'GET',
			`/Projects/${projectId}/Time`,
			{ organizationId },
			{ ...query, invoiceId },
			undefined,
			{},
			'timeEntry',
		)) as IDataObject;

		const items = responseData.items as IDataObject[] | undefined;
		if (items?.length) {
			returnData.push(...items);
		}
	}

	return returnData;
}
