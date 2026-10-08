import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import { t } from '../i18n'

export type UploadedMedia = {
  /** The file's link on Imgur. */
  url: string
  kind: 'IMAGE' | 'VIDEO'
  contentType: string
}

/** What the file picker offers; the API checks the file's real type either way. */
export const MEDIA_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,video/webm'

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/** Where images and videos are shown from; links to anywhere else stay links. */
const MEDIA_HOST = 'i.imgur.com'
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i

/**
 * Uploads an image or video for the board's task descriptions. The API passes it on to Imgur and
 * returns its link, which the description then refers to.
 */
export async function uploadMedia(serverId: string, boardId: string, file: File): Promise<UploadedMedia> {
  const body = new FormData()
  body.append('file', file)
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/media`, { method: 'POST', body })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<UploadedMedia>
}

/** Checked before uploading, so an oversized file fails at once instead of after the upload. */
export function mediaSizeError(file: File): string | null {
  const video = file.type.startsWith('video/')
  const limit = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size <= limit) return null
  return t(video ? 'board.media.videoTooBig' : 'board.media.imageTooBig', { size: limit / (1024 * 1024) })
}

/** How a link in a description is shown: as an image, as a video, or (from anywhere else) not at all. */
export function mediaKindOf(src: string | undefined): 'image' | 'video' | null {
  if (!src) return null
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== MEDIA_HOST) return null
  return VIDEO_EXTENSIONS.test(url.pathname) ? 'video' : 'image'
}

/** Marks a file in the text while it uploads; the mark becomes the file's link when it is done. */
export const UPLOAD_MARKER_PREFIX = 'uploading-'

export function isUploadMarker(src: string | undefined): boolean {
  return Boolean(src?.startsWith(UPLOAD_MARKER_PREFIX))
}

/** Whether the text still has files uploading into it; saving it now would save the marks. */
export function hasPendingUploads(text: string): boolean {
  return text.includes(`](${UPLOAD_MARKER_PREFIX}`)
}

/** The markdown for an uploaded file; the web app shows a video for a video link written the same way. */
export function mediaMarkdown(file: File, media: UploadedMedia): string {
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[[\]()\\]/g, ' ').replace(/\s+/g, ' ').trim()
  return `![${name || (media.kind === 'VIDEO' ? 'video' : 'image')}](${media.url})`
}
