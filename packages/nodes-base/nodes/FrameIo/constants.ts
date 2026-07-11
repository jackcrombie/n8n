export const FRAME_IO_API_BASE = 'https://api.frame.io';

export const FRAME_IO_CREDENTIAL = 'frameIoOAuth2Api';

export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

export const FRAME_IO_WEBHOOK_EVENTS = [
	{ name: 'Project Created', value: 'project.created' },
	{ name: 'Project Updated', value: 'project.updated' },
	{ name: 'Project Deleted', value: 'project.deleted' },
	{ name: 'File Created', value: 'file.created' },
	{ name: 'File Ready', value: 'file.ready' },
	{ name: 'File Updated', value: 'file.updated' },
	{ name: 'File Deleted', value: 'file.deleted' },
	{ name: 'File Upload Completed', value: 'file.upload.completed' },
	{ name: 'File Versioned', value: 'file.versioned' },
	{ name: 'File Copied', value: 'file.copied' },
	{ name: 'Folder Created', value: 'folder.created' },
	{ name: 'Folder Updated', value: 'folder.updated' },
	{ name: 'Folder Deleted', value: 'folder.deleted' },
	{ name: 'Folder Copied', value: 'folder.copied' },
	{ name: 'Comment Created', value: 'comment.created' },
	{ name: 'Comment Updated', value: 'comment.updated' },
	{ name: 'Comment Deleted', value: 'comment.deleted' },
	{ name: 'Comment Completed', value: 'comment.completed' },
	{ name: 'Comment Uncompleted', value: 'comment.uncompleted' },
	{ name: 'Metadata Value Updated', value: 'metadata.value.updated' },
	{ name: 'Collection Created', value: 'collection.created' },
	{ name: 'Collection Updated', value: 'collection.updated' },
	{ name: 'Collection Deleted', value: 'collection.deleted' },
	{ name: 'Custom Field Created', value: 'customfield.created' },
	{ name: 'Custom Field Updated', value: 'customfield.updated' },
	{ name: 'Custom Field Deleted', value: 'customfield.deleted' },
	{ name: 'Share Created', value: 'share.created' },
	{ name: 'Share Updated', value: 'share.updated' },
	{ name: 'Share Deleted', value: 'share.deleted' },
	{ name: 'Share Viewed', value: 'share.viewed' },
] as const;

export const MEDIA_LINK_INCLUDE_MAP: Record<string, string> = {
	thumbnail: 'media_links.thumbnail',
	thumbnailHighQuality: 'media_links.thumbnail_high_quality',
	scrubSheet: 'media_links.scrub_sheet',
	previewVideo: 'media_links.video_h264_180',
	highQuality: 'media_links.high_quality',
	efficient: 'media_links.efficient',
	original: 'media_links.original',
};
