import { MenuEntry } from './ContextMenu';
import { Commit, MenuState } from './types';

/**
 * Callbacks for menu actions that need to interact with App-level state.
 * This keeps the dispatch logic free of React imports.
 */
export interface MenuActionCallbacks {
  postMessage: (msg: any) => void;
  setSelectedIndex: (index: number) => void;
  setActiveTab: (tab: 'log' | 'local') => void;
  setFilesExpanded: (expanded: boolean) => void;
  setDetailsExpanded: (expanded: boolean) => void;
  setPinnedBranches: (updater: (prev: Set<string>) => Set<string>) => void;
  handleFilter: (branch: string) => void;
  /** All commits for resolving indices to hashes */
  getAllCommitHashes: (indices: number[]) => string[];
  selectedIndices: number[];
  onRewordCommit?: (hash: string, currentMessage: string) => void;
  onSquashCommits?: (hashes: string[]) => void;
  setInteractiveRebaseBase?: (commit: Commit) => void;
}

/**
 * Dispatch a context menu action based on the current menu state.
 */
export function dispatchMenuAction(
  menuState: MenuState,
  action: string,
  cb: MenuActionCallbacks,
): void {
  const { kind } = menuState;
  const ref = kind === 'commit'
    ? menuState.commit.hash
    : kind === 'branch'
      ? menuState.branch
        : kind === 'tag'
          ? menuState.tag
          : menuState.stash.refName;

  // --- Shared actions ---
  switch (action) {
    case 'compareWithCurrent':
      if (menuState.kind === 'commit') cb.setSelectedIndex(menuState.index);
      cb.postMessage({ type: 'compareRef', ref });
      return;
    case 'openInBrowser':
      cb.postMessage({ type: 'openRefInBrowser', ref, refType: kind });
      return;
    case 'createBranchFrom':
      cb.postMessage({ type: 'createBranchFrom', ref, refType: kind });
      return;
    case 'mergeRef':
      cb.postMessage({ type: 'mergeRef', ref });
      return;
    case 'rebaseRef':
      cb.postMessage({ type: 'rebaseRef', ref });
      return;
  }

  // --- Commit-specific actions ---
  if (menuState.kind === 'commit') {
    const { commit, index } = menuState;
    dispatchCommitAction(action, commit, index, cb);
    return;
  }

  // --- Branch-specific actions ---
  if (menuState.kind === 'branch') {
    const { branch, isRemote } = menuState;
    dispatchBranchAction(action, branch, isRemote, cb);
    return;
  }

  // --- Tag-specific actions ---
  if (menuState.kind === 'tag') {
    const { tag } = menuState;
    dispatchTagAction(action, tag, cb);
    return;
  }

  // --- Stash-specific actions ---
  if (menuState.kind === 'stash') {
    const { stash } = menuState;
    dispatchStashAction(action, stash, cb);
    return;
  }
}

function dispatchStashAction(
  action: string,
  stash: any,
  cb: MenuActionCallbacks,
): void {
  switch (action) {
    case 'applyStash':
      cb.postMessage({ type: 'applyStash', refName: stash.refName });
      break;
    case 'popStash':
      cb.postMessage({ type: 'popStash', refName: stash.refName });
      break;
    case 'dropStash':
      cb.postMessage({ type: 'dropStash', refName: stash.refName });
      break;
    case 'copySHA':
      cb.postMessage({ type: 'copySHA', hash: stash.hash });
      break;
    case 'copyMessage':
      cb.postMessage({ type: 'copyMessage', message: stash.message });
      break;
  }
}

function dispatchCommitAction(
  action: string,
  commit: Commit,
  index: number,
  cb: MenuActionCallbacks,
): void {
  switch (action) {
    case 'copySHA':
      cb.postMessage({ type: 'copySHA', hash: commit.hash });
      break;
    case 'copyShortSHA':
      cb.postMessage({ type: 'copyShortSHA', hash: commit.hash });
      break;
    case 'copyMessage':
      cb.postMessage({ type: 'copyMessage', message: commit.message });
      break;
    case 'copyURL':
      cb.postMessage({ type: 'copyURL', hash: commit.hash });
      break;
    case 'createTag':
      cb.postMessage({ type: 'createTag', hash: commit.hash });
      break;
    case 'createWorktree':
      cb.postMessage({ type: 'createWorktree', hash: commit.hash });
      break;
    case 'cherryPick':
      if (cb.selectedIndices.length > 1) {
        const sortedIndices = [...cb.selectedIndices].sort((a, b) => b - a);
        const hashes = cb.getAllCommitHashes(sortedIndices);
        cb.postMessage({ type: 'cherryPickMultiple', hashes });
      } else {
        cb.postMessage({ type: 'cherryPick', hash: commit.hash });
      }
      break;
    case 'cherryPickWithWorktree':
      cb.postMessage({ type: 'cherryPickWithWorktree', hash: commit.hash });
      break;
    case 'squashCommits': {
      const sortedIndices = [...cb.selectedIndices].sort((a, b) => b - a);
      const hashes = cb.getAllCommitHashes(sortedIndices);
      if (cb.onSquashCommits) {
        cb.onSquashCommits(hashes);
      } else {
        cb.postMessage({ type: 'squashCommits', hashes });
      }
      break;
    }
    case 'rewordCommit':
      if (cb.onRewordCommit) {
        cb.onRewordCommit(commit.hash, commit.message);
      } else {
        cb.postMessage({ type: 'rewordCommit', hash: commit.hash });
      }
      break;
    case 'revertCommit':
      cb.postMessage({ type: 'revertCommit', hash: commit.hash });
      break;
    case 'viewDetails':
      if (index !== undefined) cb.setSelectedIndex(index);
      cb.setActiveTab('log');
      cb.setFilesExpanded(true);
      cb.setDetailsExpanded(true);
      cb.postMessage({ type: 'getDiff', hash: commit.hash });
      break;
    case 'viewDiff':
      cb.postMessage({ type: 'viewDiff', hash: commit.hash });
      break;
    case 'interactiveRebase':
      if (cb.setInteractiveRebaseBase) {
         cb.setInteractiveRebaseBase(commit);
      }
      break;
  }
}

function dispatchBranchAction(
  action: string,
  branch: string,
  isRemote: boolean,
  cb: MenuActionCallbacks,
): void {
  switch (action) {
    case 'checkoutBranch':
      cb.postMessage({ type: 'checkoutBranch', branch });
      break;
    case 'pullBranch':
      cb.postMessage({ type: 'pullBranch', branch });
      break;
    case 'pushBranch':
      cb.postMessage({ type: 'pushBranch', branch });
      break;
    case 'pushBranchTo':
      cb.postMessage({ type: 'pushBranchTo', branch });
      break;
    case 'renameBranch':
      cb.postMessage({ type: 'renameBranch', branch });
      break;
    case 'deleteBranch':
      cb.postMessage({ type: 'deleteBranch', branch, isRemote });
      break;
    case 'compareBranchWith':
      cb.postMessage({ type: 'compareBranchWith', branch });
      break;
    case 'pinBranch':
      cb.setPinnedBranches(prev => new Set(prev).add(branch));
      break;
    case 'unpinBranch':
      cb.setPinnedBranches(prev => { const s = new Set(prev); s.delete(branch); return s; });
      break;
    case 'setUpstream':
      cb.postMessage({ type: 'setUpstream', branch });
      break;
    case 'showInGraph':
      cb.handleFilter(branch);
      break;
  }
}

function dispatchTagAction(
  action: string,
  tag: string,
  cb: MenuActionCallbacks,
): void {
  switch (action) {
    case 'viewTagDetails':
      cb.postMessage({ type: 'viewTagDetails', tag });
      break;
    case 'deleteTag':
      cb.postMessage({ type: 'deleteTag', tag });
      break;
    case 'copyTagName':
      cb.postMessage({ type: 'copyTagName', tag });
      break;
  }
}

// --- Menu Item Builders ---

export function getCommitMenuItems(
  selectedCount: number,
  canSquash: boolean,
): MenuEntry[] {
  const isMulti = selectedCount > 1;
  return [
    {
      label: 'Copy', icon: 'copy',
      submenu: [
        { label: 'Copy SHA', icon: 'copy', action: 'copySHA', disabled: isMulti },
        { label: 'Copy Short SHA', icon: 'copy', action: 'copyShortSHA', disabled: isMulti },
        { label: 'Copy Message', icon: 'copy', action: 'copyMessage', disabled: isMulti },
        { label: 'Copy URL', icon: 'link', action: 'copyURL', disabled: isMulti },
      ],
    },
    { type: 'separator' },
    { label: 'Create Branch...', icon: 'git-branch', action: 'createBranchFrom', disabled: isMulti },
    { label: 'Create Tag...', icon: 'tag', action: 'createTag', disabled: isMulti },
    { label: 'Create Worktree...', icon: 'worktree', action: 'createWorktree', disabled: isMulti },
    { type: 'separator' },
    {
      label: isMulti ? `Cherry Pick ${selectedCount} Commits` : 'Cherry Pick',
      icon: 'git-merge',
      action: 'cherryPick',
    },
    { label: 'Cherry Pick (with worktree)', icon: 'git-merge', action: 'cherryPickWithWorktree', disabled: isMulti },
    { label: 'Squash Commits...', icon: 'arrow-both', action: 'squashCommits', disabled: !canSquash },
    { label: 'Edit Commit Message...', icon: 'edit', action: 'rewordCommit', disabled: isMulti },
    { label: 'Revert Commit', icon: 'discard', action: 'revertCommit', danger: true, disabled: isMulti },
    { label: 'Interactive Rebase from Here...', icon: 'edit', action: 'interactiveRebase', disabled: isMulti },
    { label: 'Rebase Current Branch onto This', icon: 'sync', action: 'rebaseRef', disabled: isMulti },
    { label: 'Merge into Current Branch...', icon: 'merge', action: 'mergeRef', disabled: isMulti },
    { type: 'separator' },
    { label: 'Compare with Current Branch', icon: 'git-compare', action: 'compareWithCurrent', disabled: isMulti },
    { label: 'View Details', icon: 'inspect', action: 'viewDetails', disabled: isMulti },
    { label: 'Open in Browser', icon: 'link-external', action: 'openInBrowser', disabled: isMulti },
    { label: 'View Diff', icon: 'diff', action: 'viewDiff', disabled: isMulti },
  ];
}

export function getBranchMenuItems(
  branch: string,
  isRemote: boolean,
  isCurrent: boolean,
  isPinned: boolean,
): MenuEntry[] {
  return [
    { label: 'Checkout Branch', icon: 'check', action: 'checkoutBranch', disabled: isCurrent },
    { label: 'New Branch from...', icon: 'git-branch', action: 'createBranchFrom' },
    { type: 'separator' },
    { label: 'Merge into Current Branch...', icon: 'git-merge', action: 'mergeRef', disabled: isCurrent },
    { label: 'Rebase Current Branch onto This', icon: 'sync', action: 'rebaseRef', disabled: isCurrent },
    { label: 'Pull into Current Branch', icon: 'cloud-download', action: 'pullBranch' },
    { label: 'Push...', icon: 'cloud-upload', action: 'pushBranch' },
    { label: 'Push to Remote...', icon: 'cloud-upload', action: 'pushBranchTo' },
    { type: 'separator' },
    { label: 'Rename Branch...', icon: 'edit', action: 'renameBranch', hidden: isRemote },
    { label: 'Delete Branch...', icon: 'trash', action: 'deleteBranch', danger: true },
    { type: 'separator' },
    { label: 'Compare with Current Branch', icon: 'git-compare', action: 'compareWithCurrent' },
    { label: 'Compare with Branch...', icon: 'git-compare', action: 'compareBranchWith' },
    { type: 'separator' },
    isPinned
      ? { label: 'Unpin Branch', icon: 'pin', action: 'unpinBranch' }
      : { label: 'Pin Branch', icon: 'pin', action: 'pinBranch' },
    { label: 'Open in Browser', icon: 'link-external', action: 'openInBrowser' },
    { label: 'Set as Upstream Branch', icon: 'link', action: 'setUpstream', hidden: isRemote },
    { label: 'Show in Commit Graph', icon: 'graph', action: 'showInGraph' },
  ];
}

export function getTagMenuItems(): MenuEntry[] {
  return [
    { label: 'View Tag Details', icon: 'inspect', action: 'viewTagDetails' },
    { label: 'Create Branch from Tag...', icon: 'git-branch', action: 'createBranchFrom' },
    { label: 'Compare with Current Branch', icon: 'git-compare', action: 'compareWithCurrent' },
    { label: 'Delete Tag...', icon: 'trash', action: 'deleteTag', danger: true },
    { type: 'separator' },
    { label: 'Copy Tag Name', icon: 'copy', action: 'copyTagName' },
    { label: 'Open in Browser', icon: 'link-external', action: 'openInBrowser' },
  ];
}

export function getStashMenuItems(): MenuEntry[] {
  return [
    { label: 'Apply Stash', icon: 'check', action: 'applyStash' },
    { label: 'Pop Stash', icon: 'git-merge', action: 'popStash' },
    { label: 'Drop Stash...', icon: 'trash', action: 'dropStash', danger: true },
    { type: 'separator' },
    { label: 'Copy Message', icon: 'copy', action: 'copyMessage' },
    { label: 'Copy Hash', icon: 'copy', action: 'copySHA' },
  ];
}

