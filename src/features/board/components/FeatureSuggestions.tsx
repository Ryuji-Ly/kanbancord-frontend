import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../../api/http'
import { formatLocale, language, t } from '../../../i18n'
import { SITE } from '../../../site/siteInfo'
import {
  dismissFeatureSuggestions,
  fetchFeatureSuggestions,
  FEATURES,
  updateBoardFeatures,
  updateServerFeatures,
  type FeatureSuggestion,
} from '../../../services/featuresService'
import { serverKeys } from '../../server/serverQueries'
import { boardKeys } from '../boardQueries'

/** The guide on switching features on, linked from every suggestion. */
const GUIDE_URL = `${SITE.url}/guides/features-and-simple-mode`

/** "[M], [S] and [E]" in the reader's language; examples with spaces in quotes, so they read as quoted. */
function exampleList(examples: string[]): string {
  const quoted = examples.map((example) =>
    /\s/.test(example) ? t('board.suggestions.quote', { text: example }) : example,
  )
  try {
    return new Intl.ListFormat(formatLocale() ?? language(), { type: 'conjunction' }).format(quoted)
  } catch {
    return quoted.join(', ')
  }
}

function sentence(suggestion: FeatureSuggestion): string {
  const examples = exampleList(suggestion.examples)
  switch (suggestion.feature) {
    case 'LABELS':
      return suggestion.signal === 'COLUMNS'
        ? t('board.suggestions.labelsColumns', { examples })
        : t('board.suggestions.labelsTags', { examples })
    case 'PRIORITIES':
      return t('board.suggestions.priorities', { examples })
    case 'DUE_DATES':
      return t('board.suggestions.dueDates', { examples })
    case 'ASSIGNEES':
      return suggestion.signal === 'COLUMNS'
        ? t('board.suggestions.assigneesColumns', { examples })
        : t('board.suggestions.assigneesNames', { examples })
    default:
      return ''
  }
}

/**
 * A dismissible hint above the columns when the board seems to do an optional feature by hand, such as tags
 * like [M] at the start of titles. Shown to everyone who sees the board; those who may switch the feature on
 * get a button, everyone else is told who can and where. Dismissing hides it for the whole board, for good.
 */
export function FeatureSuggestions({
  serverId,
  boardId,
  showToast,
}: {
  serverId: string
  boardId: string
  showToast: (text: string, kind: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const queryKey = [...boardKeys.all(serverId, boardId), 'suggestions'] as const
  const query = useQuery({
    queryKey,
    queryFn: () => fetchFeatureSuggestions(serverId, boardId),
    // A hint is worth no retries, and it changes only as the board fills up.
    retry: false,
    staleTime: 60_000,
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })
    void queryClient.invalidateQueries({ queryKey: serverKeys.features(serverId) })
  }

  const enable = useMutation({
    mutationFn: (suggestion: FeatureSuggestion) =>
      suggestion.scope === 'SERVER'
        ? updateServerFeatures(serverId, { [suggestion.feature]: true })
        : updateBoardFeatures(serverId, boardId, { [suggestion.feature]: true }),
    onSuccess: (_, suggestion) => {
      showToast(t('board.suggestions.turnedOn', { feature: featureLabel(suggestion) }), 'success')
      refresh()
    },
    onError: (error) => showToast(readableError(error, t('board.page.unknownError')), 'error'),
  })
  const dismiss = useMutation({
    mutationFn: (features: FeatureSuggestion['feature'][]) => dismissFeatureSuggestions(serverId, boardId, features),
    onMutate: () => queryClient.setQueryData(queryKey, []),
    onError: (error) => {
      showToast(readableError(error, t('board.page.unknownError')), 'error')
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const suggestions = query.data ?? []
  if (suggestions.length === 0) return null

  return (
    <aside className="kc-feature-suggestions" aria-label={t('board.suggestions.title')}>
      <div className="kc-feature-suggestions-head">
        <strong>{t('board.suggestions.title')}</strong>
        <button
          type="button"
          className="kc-btn kc-btn-small kc-btn-ghost"
          onClick={() => dismiss.mutate(suggestions.map((suggestion) => suggestion.feature))}
          disabled={dismiss.isPending}
        >
          {t('board.suggestions.dismiss')}
        </button>
      </div>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.feature}>
            <p>{sentence(suggestion)}</p>
            {suggestion.canEnable ? (
              <button
                type="button"
                className="kc-btn kc-btn-small kc-btn-primary"
                onClick={() => enable.mutate(suggestion)}
                disabled={enable.isPending}
              >
                {t('board.suggestions.turnOn', { feature: featureLabel(suggestion) })}
              </button>
            ) : (
              <p className="kc-muted">
                {suggestion.scope === 'SERVER'
                  ? t('board.suggestions.askManager', {
                      manageServer: t('access.flags.MANAGE_GUILD'),
                      where: `${t('dashboard.serverSettings')} → ${t('dashboard.settings.features')}`,
                    })
                  : t('board.suggestions.askBoardEditor', {
                      where: `${t('board.page.settings')} → ${t('settings.boardFeatures.title')}`,
                    })}
              </p>
            )}
          </li>
        ))}
      </ul>
      <a className="kc-feature-suggestions-guide" href={GUIDE_URL} target="_blank" rel="noopener noreferrer">
        {t('board.suggestions.guide')}
      </a>
    </aside>
  )
}

function featureLabel(suggestion: FeatureSuggestion): string {
  return FEATURES.find((feature) => feature.key === suggestion.feature)?.label ?? suggestion.feature
}
