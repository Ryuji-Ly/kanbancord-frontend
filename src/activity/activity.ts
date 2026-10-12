import type { DiscordSDK } from '@discord/embedded-app-sdk'
import { signInWithActivityCode } from '../api/session'
import { API_BASE_URL, DISCORD_CLIENT_ID, DISCORD_SCOPES } from '../config/env'

/**
 * KanbanCord as a Discord Activity: the web app, opened inside Discord from a voice or text channel.
 *
 * Discord serves it through its own proxy and lets it reach nothing else directly, so requests to
 * the API, Discord's CDN and Imgur are rewritten to paths the proxy forwards (see
 * {@link activityUrlMappings}). Discord signs the user in, and links open in their browser.
 */

let sdk: DiscordSDK | null = null
/** The server and channel the Activity was opened in; none in DMs and group DMs. */
let opened: { guildId: string | null; channelId: string | null } = { guildId: null, channelId: null }

/**
 * Paths the Activity uses for the hosts it needs. The Developer Portal's URL mappings must have the
 * same prefixes, each pointing at its host, plus `/` pointing at the website.
 */
export function activityUrlMappings(): { prefix: string; target: string }[] {
  const mappings = [
    { prefix: '/discord-cdn', target: 'cdn.discordapp.com' },
    { prefix: '/imgur', target: 'i.imgur.com' },
  ]
  // In development the API is reached through the same origin, and needs no mapping.
  return API_BASE_URL ? [{ prefix: '/kc-api', target: new URL(API_BASE_URL).host }, ...mappings] : mappings
}

/** The server the Activity was opened in, if any. */
export function activityGuildId(): string | null {
  return opened.guildId
}

/**
 * Connects to Discord and signs in, before the app renders. When signing in fails, the app starts
 * signed out and {@link signInThroughDiscord} can try again.
 */
export async function startActivity(): Promise<void> {
  const { DiscordSDK: Sdk, patchUrlMappings } = await import('@discord/embedded-app-sdk')
  patchUrlMappings(activityUrlMappings(), { patchSrcAttributes: true })
  sdk = new Sdk(DISCORD_CLIENT_ID)
  // Read now: the SDK takes them from the address, which the app's own navigation replaces.
  opened = { guildId: sdk.guildId, channelId: sdk.channelId }
  openLinksInBrowser()
  await sdk.ready()
  await signInThroughDiscord().catch(() => undefined)
}

/** Asks Discord to sign the user in; the first time, Discord asks them to allow it. */
export async function signInThroughDiscord(): Promise<void> {
  if (!sdk) throw new Error('The Discord Activity has not started')
  const { code } = await sdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: DISCORD_SCOPES.split(' ') as Parameters<DiscordSDK['commands']['authorize']>[0]['scope'],
  })
  await signInWithActivityCode(code)
}

/** Opens a link in the user's browser; Discord asks them first, as it does for links in chat. */
export function openInBrowser(url: string): void {
  void sdk?.commands.openExternalLink({ url })
}

/**
 * The Activity cannot open pages of its own or leave its frame, so links to other sites, and pages
 * opened with `window.open`, go to the user's browser instead.
 */
function openLinksInBrowser() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement)) return
    const url = new URL(link.href, window.location.href)
    if (url.origin === window.location.origin || !/^https?:$/.test(url.protocol)) return
    event.preventDefault()
    openInBrowser(url.href)
  })
  window.open = (url?: string | URL) => {
    if (url) openInBrowser(new URL(url, window.location.href).href)
    return null
  }
}
