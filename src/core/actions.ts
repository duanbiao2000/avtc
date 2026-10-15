/**
 * The fixed action catalogue: the single source of truth for all 8 templates.
 * If a third-party site changes its URL scheme, this is the only file to touch.
 */

export type ActionGroup = 'understand' | 'ai' | 'code' | 'run';

/** How the target site handles repositories that are not public. */
export type PrivateRepoSupport =
  /** Public repositories only. */
  | 'no'
  /** Needs the user's login session on the target site. */
  | 'session'
  /** Accepts a personal access token that the user pastes on the target site. */
  | 'token';

export type ActionId =
  | 'gitdiagram'
  | 'deepwiki'
  | 'zread'
  | 'gitreverse'
  | 'gitingest'
  | 'github1s'
  | 'githubdev'
  | 'stackblitz';

export interface Action {
  readonly id: ActionId;
  readonly group: ActionGroup;
  /** i18n message key for the Chinese/English action label. */
  readonly labelKey: string;
  /** Tool name, kept in its original English spelling (never translated). */
  readonly tool: string;
  /** URL template, must contain {owner} and {repo}. */
  readonly template: string;
  readonly privateRepo: PrivateRepoSupport;
}

/** Order of this array is the default order shown in the popup. */
export const ACTIONS: readonly Action[] = [
  {
    id: 'gitdiagram',
    group: 'understand',
    labelKey: 'actionGitdiagram',
    tool: 'GitDiagram',
    template: 'https://gitdiagram.com/{owner}/{repo}',
    privateRepo: 'token',
  },
  {
    id: 'deepwiki',
    group: 'understand',
    labelKey: 'actionDeepwiki',
    tool: 'DeepWiki',
    template: 'https://deepwiki.com/{owner}/{repo}',
    privateRepo: 'no',
  },
  {
    id: 'zread',
    group: 'understand',
    labelKey: 'actionZread',
    tool: 'Zread',
    template: 'https://zread.ai/{owner}/{repo}',
    privateRepo: 'no',
  },
  {
    id: 'gitreverse',
    group: 'ai',
    labelKey: 'actionGitreverse',
    tool: 'GitReverse',
    template: 'https://www.gitreverse.com/{owner}/{repo}',
    privateRepo: 'no',
  },
  {
    id: 'gitingest',
    group: 'ai',
    labelKey: 'actionGitingest',
    tool: 'Gitingest',
    template: 'https://gitingest.com/{owner}/{repo}',
    privateRepo: 'token',
  },
  {
    id: 'github1s',
    group: 'code',
    labelKey: 'actionGithub1s',
    tool: 'GitHub1s',
    template: 'https://github1s.com/{owner}/{repo}',
    privateRepo: 'session',
  },
  {
    id: 'githubdev',
    group: 'code',
    labelKey: 'actionGithubdev',
    tool: 'GitHub.dev',
    template: 'https://github.dev/{owner}/{repo}',
    privateRepo: 'session',
  },
  {
    id: 'stackblitz',
    group: 'run',
    labelKey: 'actionStackblitz',
    tool: 'StackBlitz',
    template: 'https://stackblitz.com/github/{owner}/{repo}',
    privateRepo: 'no',
  },
];

export const GROUP_ORDER: readonly ActionGroup[] = ['understand', 'ai', 'code', 'run'];

export const GROUP_LABEL_KEY: Readonly<Record<ActionGroup, string>> = {
  understand: 'groupUnderstand',
  ai: 'groupAi',
  code: 'groupCode',
  run: 'groupRun',
};

const BY_ID: ReadonlyMap<string, Action> = new Map(ACTIONS.map((a) => [a.id, a] as const));

export function actionById(id: string): Action | undefined {
  return BY_ID.get(id);
}

export function actionIds(): string[] {
  return ACTIONS.map((a) => a.id);
}
