export interface Commit {
  hash: string;
  parents: string[];
  refs: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
}

export interface GitStatusFile {
  path: string;
  index: string;
  working_dir: string;
}

export interface GitStatus {
  files: GitStatusFile[];
  not_added: string[];
  conflicted: string[];
  created: string[];
  deleted: string[];
  modified: string[];
  renamed: { from: string; to: string }[];
  staged: string[];
  ahead: number;
  behind: number;
  current: string | null;
  tracking: string | null;
}

export interface GitBranch {
  name: string;
  commit: string;
  label: string;
  current: boolean;
  isRemote: boolean;
}

export interface GitBranches {
  all: string[];
  branches: { [key: string]: GitBranch };
  current: string;
}

export interface Stash {
  hash: string;
  refName: string;
  message: string;
  date: string;
}

export interface Worktree {
  path: string;
  commit: string;
  branch: string;
  isMain: boolean;
}

export interface RepositoryInfo {
  name: string;
  path: string;
  isMain: boolean;
}

export interface Changelist {
  id: string;
  name: string;
  filePaths: string[];
  isDefault?: boolean;
  isConflicts?: boolean;
}

export interface GitData {
  log: { all: Commit[] } | null;
  status: GitStatus | null;
  branches: GitBranches | null;
  tags: string[];
  authors: string[];
  currentUser: { name: string; email: string } | null;
  fileFilter: string;
  stashes?: Stash[];
  worktrees?: Worktree[];
  repositories?: RepositoryInfo[];
  changelists?: Changelist[];
  localHistoryEnabled?: boolean;
  activeRepo?: string;
  isRebasing?: boolean;
}

export const FILTER_ALL = 'ALL';

export interface WebviewMessage {
  type: string;
  [key: string]: any;
}

type MenuStateBase = { x: number; y: number };
export type CommitMenu = MenuStateBase & { kind: 'commit'; commit: Commit; index: number };
export type BranchMenu = MenuStateBase & { kind: 'branch'; branch: string; isRemote: boolean };
export type TagMenu = MenuStateBase & { kind: 'tag'; tag: string };
export type StashMenu = MenuStateBase & { kind: 'stash'; stash: Stash };

export type MenuState = CommitMenu | BranchMenu | TagMenu | StashMenu;

export type MenuActionData = 
  | Omit<CommitMenu, 'x' | 'y'>
  | Omit<BranchMenu, 'x' | 'y'>
  | Omit<TagMenu, 'x' | 'y'>
  | Omit<StashMenu, 'x' | 'y'>;
