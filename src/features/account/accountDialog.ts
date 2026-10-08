/**
 * The section of your preferences and settings to open again once the app is drawn afresh, as it is
 * after choosing another language. Kept outside React, which starts over at that moment.
 */
let pending: string | null = null

export function reopenAccountDialog(section: string) {
  pending = section
}

export function pendingAccountDialog(): string | null {
  return pending
}

export function clearPendingAccountDialog() {
  pending = null
}
