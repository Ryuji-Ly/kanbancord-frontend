/**
 * Who runs KanbanCord and how to reach them, for the public pages and the legal documents. Change
 * these here and every page follows.
 */
export const SITE = {
  name: 'KanbanCord',
  url: 'https://kanbancord.com',
  /** The person responsible for KanbanCord and its data (the "controller" in privacy law). */
  operator: 'Ryuji Ly',
  /** The country whose law applies, and where the operator is based. */
  country: 'Belgium',
  /** For privacy and legal requests. */
  email: 'privacy@kanbancord.com',
  /** For questions, feedback and corrections to the translations. */
  contactEmail: 'contact@kanbancord.com',
  donationUrl: 'https://ko-fi.com/ryujily',
  supportServerUrl: 'https://discord.gg/SDr4ujFPGR',
  /** The bot's own page in Discord's App Directory. */
  appDirectoryUrl: 'https://discord.com/discovery/applications/1303467182344241283',
  /** Whether the website, API and bot are up, and any planned maintenance. */
  statusUrl: 'https://status.kanbancord.com',
  /** The unrelated bot that happens to share the name, mentioned in the About page's story. */
  sameNameBotUrl: 'https://discord.com/discovery/applications/1301269207073165444',
  /** When the Privacy Policy and Terms of Service last changed. */
  legalUpdated: '25 September 2026',
}

/** The values messages about the site fill in: {name}, {operator} and {email}. */
export const SITE_VALUES = { name: SITE.name, operator: SITE.operator, email: SITE.email }
