# Project: GitConstellation - Project Instructions

Foundational mandates for maintenance and future development.

## Project Overview
A VS Code extension mimicking the JetBrains Git UI experience. Located in the `vscode-git-constellation` directory.

## Coding Rule
- Finished the task should run `npm run compile` to compile the project and write a commit message then commit it.
- Finished the task should update GEMINI.md if needed.

## Technical Architecture
- **Extension Host (Node.js)**: Handles Git operations via `simple-git`.
- **UI Layer (Webview)**: React + TypeScript + Vite.
- **Styling**: Vanilla CSS, theme-aware using VS Code CSS variables.
- **Icons**: `@vscode/codicons` (font-based).

## Key Components & Logic
### 1. Git Data Layer (`src/git.ts`)
- Uses `simple-git` with custom raw formatting.
- Log format: `%H%x09%P%x09%D%x09%s%x09%an%x09%ae%x09%at` (Tab-separated).
- Fields: Hash, Parents, Refs, Message, Author, Email, Date (UNIX timestamp).

### 2. Git Graph (`webview/src/GitGraph.tsx`)
- **Rendering**: HTML5 Canvas with High-DPI (Retina/4K) scaling logic.
- **Lanes**: Dynamic lane-based layout.
- **Auto-Width**: Calculates `maxLanes` and notifies parent via `onWidthChange` to adjust table columns.
- **Labels**: Branch/Tag labels are handled by the main App in HTML (description column) to prevent overlap.

### 3. File Tree (`webview/src/FileTree.tsx`)
- **Structure**: Recursive tree with folder support.
- **Expansion**: Default-expanded on load via `useEffect`. The expansion state (`expandedNodes`) is hoisted to parent components (e.g., `LocalChangesPanel`) to prevent state loss and UI flashing when the tree is temporarily unmounted during frequent background git refreshes.
- **Checkboxes**: Supports rendering checkbox controls for selecting files and directories (with checked/unchecked/indeterminate states).
- **Status Coloring**:
    - `A` (Added): Green (`#50fa7b`)
    - `M` (Modified): Blue (`#4a9eff`)
    - `D` (Deleted): Red + Strikethrough (`#ff5555`)
    - `R` (Renamed): Purple (`#bd93f9`)
    - `?` (Untracked): Red-brown (`#d16969`)
    - `U` (Conflicted): Red + Bold (`var(--vscode-errorForeground)`)
- **Conflicts Group**: Conflicted files are dynamically isolated into a virtual, non-deletable, non-renamable "Conflicts" group at the top of the Changelist list. Checkboxes are disabled/hidden for conflicted files to prevent committing unresolved conflicts.
- **Icons**: Mapped to common file extensions using Codicons.

### 4. Side Pane & Top Layout
- **Tabs**: Main navigation across Log, Local Changes, Stashes, Worktrees. Includes a global Refresh button (`codicon-refresh`) to manually trigger a git state sync when file watchers miss changes. Tabs are kept permanently mounted in the DOM and toggled using CSS `display` to preserve their internal states and scroll positions.
- **Side Pane**: Split into Changed Files (top) and Commit Details (bottom). Both sections are collapsible with persistent state in the session.

### 5. Context Menus & Git Operations
- **Trigger**: Right-clicking a commit row, branch (dropdown list / pills), or tag pill triggers custom context menus positioned to respect viewport boundaries.
- **Implementation**: Handled by a unified `<ContextMenu />` component in `ContextMenu.tsx`. It provides standard styling, keyboard navigation, submenus (e.g. for Copying), danger states, and dynamic enabling/disabling of options.
- **Commit Menu**: Copy SHA/short SHA/message/URL, create branch/tag/worktree, cherry-pick (supports multiple commits), squash commits (combines selected contiguous commits on the current branch with same-branch validation), edit commit message (amends HEAD or rewrites history using temp branch and cherry-picks for older commits), revert, rebase, merge, compare, inspect details, open browser, view diff.
- **Branch Menu**: Checkout, new branch, merge, rebase, pull, push, push to remote, rename, delete (local/remote), compare, pin/unpin, open in browser, set upstream. Pinned branches are displayed at the very top of the branch filter popup. The branch filter popup allows searching/filtering the list dynamically by local branches, remote branches, and tags.
- **Tag Menu**: View tag details (registers custom content provider `git-constellation-tag` scheme), create branch, compare, delete (local/remote), copy tag name, open in browser.
- **Stash Menu**: Apply stash, pop stash, drop stash, copy message, copy hash.
- **Compare Mode**: Diff status between branches/tags or HEAD vs commit. Renders file differences list in the side pane with a banner to exit.
- **View Diff**: Registers a custom text content provider `git-constellation-diff` scheme returning full git diffs.
- **VS Code Context Menus**: Right-clicking a file in the VS Code file explorer or editor context menu displays a "View File History (GitConstellation)" option, which automatically focuses the extension panel, filters the commit list to show the file's git history, and switches the active tab to the Log page if it isn't already selected.

### 6. Commit List Table
- **Layout**: Uses `table-layout: fixed` for stable column dimensions.
- **Selection**: Supports multiple selection using Ctrl+click (toggle selection) and Shift+click (range selection) with active selection highlighting (`tr.selected`). Right-clicking a row selects it if it isn't already part of the current selection.
- **Resizable Columns**: Enables manual stretching of the "Description", "Author", and "Date" columns via mouse drag handlers on header borders. Final column widths are saved and persisted via `localStorage`.
- **Graph Column**: Exempt from manual resizing; width is automatically controlled by `GitGraph`.

### 7. AI Commit Generation
- **Integration**: OpenAI-compatible API configured via `git-constellation.openai.apiUrl`, `git-constellation.openai.apiKey`, `git-constellation.openai.model`, and `git-constellation.openai.prompt`.
- **Logic**: Reads diff from selected checked files, limits length, and sends to the configured API. If no API key is set, it prompts the user to open settings.
- **Test Command**: `git-constellation.testOpenAISettings` is available via settings page or command palette to verify connection.

### 8. Stash Management
- **Integration**: Access via "Stashes" tab in main UI. Lists stashes fetched via `git stash list`.
- **Create Stash**: Form to stash local changes with options to Keep Staged Changes (`--keep-index`) and Include Untracked Files (`--include-untracked`). Supports generating a concise stash description using the configured OpenAI integration.
- **Details Pane**: Reuses the Commit Details side pane to view files modified in a selected stash. Clicking a file compares the stashed file's changes against the parent commit it was stashed on.
- **Operations**: Context menus to Apply, Pop, or Drop a stash. Offers a toolbar action to clear all stashes with VS Code confirmation prompt validation.

### 9. Worktree Management
- **Integration**: Access via "Worktrees" tab in main UI. Lists worktrees fetched via `git worktree list --porcelain`.
- **View Details**: Displays Path (identifies Main worktree), Branch, Commit.
- **Operations**: One-click actions to:
  - **Open in New Window**: Opens the worktree directory in a new VS Code instance.
  - **Remove Worktree**: Prompts the user to delete/remove a worktree. Disabled for the main worktree. Falls back to a prompt to force-delete (`--force`) if deletion fails.
  - **Prune Worktrees**: Clears stale worktree administrative details.

### 10. Merge Assistant & Conflicts Resolution
- **CodeLens Integration**: Scans open editor windows for standard git conflict markers and adds inline `Explain Conflict with AI` and `Semantic Merge Preview` actions.
- **Merge Editor Integration**: Exposes the same commands (`Explain Conflict with AI` and `Semantic Merge Preview`) as toolbar icons and right-click editor context menu options when editing inside VS Code's 3-way merge editor (`isInMergeEditor` context key).
- **Smart Active Conflict Detection**: If invoked inside the merge editor, it will check if the user's cursor is currently inside a specific conflict block to resolve/explain it. Otherwise, it will automatically target the first conflict block in the document.
- **Language Localization**: Supports toggle config `git-constellation.openai.language` (English `en` vs Chinese `zh-CN`). Translates AI instructions to respond in Simplified Chinese, and localizes all VS Code assistant dialogs, buttons, and notifications.

### 11. Local History (`src/services/git-local-history.ts` & `webview/src/components/LocalHistoryTab.tsx`)
- **Integration**: Access via "Local History" tab in main UI (configurable toggle `git-constellation.localHistory.enabled`).
- **Tracking & Storage**: Tracks snapshots of files automatically on save. Snapshots are stored under the plugin's global storage directory `local-history`.
- **Auto-Cleanup**: Automatically clean up snapshots based on age and max storage limits to prevent excessive disk consumption.
- **AI Semantic Search**: Integrates with OpenAI to allow natural language semantic search of local history diffs and summaries.
- **Operations**: Diff snapshots side-by-side or restore files to a specific snapshot state.

## Maintenance Guidelines
- **Building**: Always run `npm run compile` to build both Webview (Vite) and Extension (Webpack).
- **Styling**: Prefer `var(--vscode-*)` variables for theme compatibility.
- **Communication**: Use `vscode.postMessage` and `window.addEventListener('message', ...)` for host-webview bridge.
- **New Features**: Ensure High-DPI support for any new Canvas elements.

## Testing
- **Framework**: Vitest unit testing.
- **Run command**: `npm run test` executes the unit test suite.
- **Test locations**: `src/__tests__/` (extension host) and `webview/src/__tests__/` (webview logic).
- **Mocks**: Out-of-process modules like `vscode` and `simple-git` are mocked under `src/__tests__/git.test.ts`.

## File Manifest
- `package.json`: Extension entry point, scripts, and contributes.
- `tsconfig.json`: TypeScript compiler options and workspace exclusions.
- `vitest.config.ts`: Vitest test suite runner configuration.
- `src/extension.ts`: Main activation logic and message routing to handlers.
- `src/git.ts`: GitService delegating facade maintaining backward compatibility.
- `src/git-validation.ts`: Git validators preventing argument/shell injections.
- `src/ai-client.ts`: Shared OpenAI API client with AbortSignal execution.
- `src/services/`: Modularized Git services implementing specific operations:
  - `git-core.ts`: Base workspace repository context and remote HTTP URL parsing.
  - `git-log.ts`: Commit log fetching, author list, tags list, and user config.
  - `git-branch.ts`: Branch checks, tag creation, rebase, merge, and tag details provider.
  - `git-stash.ts`: Stash management (list, show files, create/apply/pop/drop).
  - `git-diff.ts`: File diff lists, parent hashes, compare files, and file content fetchers.
  - `git-worktree.ts`: Worktree listing, creation, removal, and pruning.
  - `git-ops.ts`: Git status, staging, committing, pushing, fetching, cherry-picks, and squashing.
  - `git-local-history.ts`: Local history snapshot tracking, cleanup, and semantic search.
  - `git-merge-assistant.ts`: 3-way merge conflict CodeLens provider, explanation panel, and semantic resolution.
- `src/handlers/`: Modularized host-side postMessage handlers:
  - `base-handler.ts`: Common interface declarations for message context.
  - `commit-handler.ts`: Commits, copy metadata, cherry-picks, rewording, and squashing.
  - `branch-handler.ts`: Branch management, tag details UI display, and remote URLs in browser.
  - `stash-handler.ts`: Stash list actions, pop/apply/drop, and stashed diffs.
  - `worktree-handler.ts`: Worktree add, remove, and prune actions.
  - `ops-handler.ts`: Global operations (fetch, pull, push) and local change commits.
  - `ai-handler.ts`: OpenAI prompt loading, response cancellation, squash refinement, and split suggestions.
  - `changelist-handler.ts`: SCM changelist operations (create, rename, delete, move files, batch split apply).
- `src/__tests__/git.test.ts`: Unit test suite verifying GitService operations.
- `webview/index.html`: Webview entry.
- `webview/src/App.tsx`: Top-level shell wrapping GitDataProvider and mounting Sidebar, MainContent, and modals.
- `webview/src/GitDataContext.tsx`: Global React Context for all Git state and UI filter/tab state.
- `webview/src/components/`: Modularized frontend UI tab panels:
  - `MainContent.tsx`: Dedicated container rendering the active tab content based on context.
  - `ErrorBoundary.tsx`: React global error fallback boundary UI component.
  - `Sidebar.tsx`: Left-aligned repository and branch/tag filter navigator.
  - `LogTab.tsx`: Main commit log table view with canvas graph and details side pane.
  - `LocalChangesTab.tsx`: File tree of changed files with selective staging checkboxes.
  - `StashTab.tsx`: List of stashes, stash forms, and stashed file difference inspectors.
  - `WorktreeTab.tsx`: Grid showing git worktrees with management action links.
  - `SquashModal.tsx`: Squash message editor and AI refinement panel.
  - `LocalHistoryTab.tsx`: Natural language search bar and snapshot history restore UI.
- `webview/src/types.ts`: Shared TypeScript interface definitions for domain objects (Commit, GitStatus, Stash, Worktree).
- `webview/src/utils.ts`: Shared UI utility helpers.
- `webview/src/GitGraph.tsx`: Commit graph rendering on High-DPI canvas with theme MutationObserver.
- `webview/src/FileTree.tsx`: Modified files tree view.
- `webview/src/ContextMenu.tsx`: Unified context menu component with keyboard navigation.
- `webview/src/CommitDetailsSidePane.tsx`: Commit details side pane (changed files + commit/stash metadata).
- `webview/src/CommitHoverPopup.tsx`: Hover popup showing commit details on mouse hover.
- `webview/src/LocalChangesPanel.tsx`: Local changes panel (file tree + commit box + AI generate).
- `webview/src/contextMenuActions.ts`: Pure logic for context menu item builders (commit, branch, tag, stash) and action dispatch.
- `webview/src/hooks/useResizable.ts`: Custom hook for column/commit-box drag-resize with localStorage persistence.
- `webview/src/hooks/useCommitSelection.ts`: Custom hook for commit multi-select/range-select/squash logic.
- `webview/src/hooks/useVSCodeMessaging.ts`: Custom hook handling postMessage listeners and git data updates.
- `webview/src/hooks/useContextMenuState.ts`: Custom hook handling context menu visibility and triggering.
- `webview/src/__tests__/contextMenuActions.test.ts`: Unit tests for context menu actions (45 tests).
- `webview/src/styles.css`: Global styles, theme overrides, and stash panel layouts.


