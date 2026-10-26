import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

export type ImportFormat = 'AUTO' | 'LIST' | 'CSV' | 'TSV' | 'MARKDOWN' | 'KANBANCORD'
export type ImportField = 'TITLE' | 'DESCRIPTION' | 'COLUMN' | 'DUE' | 'PRIORITY' | 'LABELS' | 'IGNORE'

export const IMPORT_FORMATS: ImportFormat[] = ['AUTO', 'LIST', 'CSV', 'TSV', 'MARKDOWN', 'KANBANCORD']
export const IMPORT_FIELDS: ImportField[] = ['TITLE', 'DESCRIPTION', 'COLUMN', 'DUE', 'PRIORITY', 'LABELS', 'IGNORE']

export type TaskImportInput = {
  text: string
  format: ImportFormat
  defaultColumnId: number | null
  createColumns: boolean
  /** For a table, what each of its columns holds; empty to let the headers decide. */
  fields: ImportField[]
}

export type TaskImportPlan = {
  format: Exclude<ImportFormat, 'AUTO'>
  headers: string[]
  fields: ImportField[]
  /** The columns that get tasks; columnId is missing for one the import creates. */
  columns: { columnId?: string; name: string; created: boolean; tasks: number }[]
  tasks: { title: string; description?: string; column: string; dueDate?: string; priority?: string; labels?: string[] }[]
  /** What was changed or left out; code says what, examples a few of the values concerned. */
  notes: { code: string; count: number; examples?: string[] }[]
}

/** The format a file's name suggests; anything else is worked out from its contents. */
export function formatOfFile(name: string): ImportFormat {
  const extension = name.toLowerCase().split('.').pop()
  if (extension === 'csv') return 'CSV'
  if (extension === 'tsv') return 'TSV'
  if (extension === 'json') return 'KANBANCORD'
  return 'AUTO'
}

function body(input: TaskImportInput) {
  return JSON.stringify({
    text: input.text,
    format: input.format,
    defaultColumnId: input.defaultColumnId,
    createColumns: input.createColumns,
    fields: input.fields.length > 0 ? input.fields : null,
  })
}

/** What importing would do; changes nothing. */
export async function previewTaskImport(serverId: string, boardId: string, input: TaskImportInput): Promise<TaskImportPlan> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/import-tasks/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as TaskImportPlan
}

export async function importTasks(serverId: string, boardId: string, input: TaskImportInput): Promise<TaskImportPlan> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/import-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as TaskImportPlan
}
