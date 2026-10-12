/**
 * Whether the app is running as a Discord Activity: inside Discord, served through Discord's proxy
 * from `<client id>.discordsays.com`. Nothing else is served from there, so the host is enough.
 */
export function isActivity(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.discordsays.com')
}
