import React from 'react';
import { GitGraph } from '../GitGraph';
import { CommitDetailsSidePane } from '../CommitDetailsSidePane';
import { Commit } from '../types';
import { formatDate } from '../utils';
import { useGitData } from '../GitDataContext';

interface LogTabProps {
  isPulling: boolean;
  setIsPulling: (p: boolean) => void;
  isPushing: boolean;
  setIsPushing: (p: boolean) => void;
  graphWidth: number;
  setGraphWidth: (w: number) => void;
  descWidth: number;
  authorWidth: number;
  dateWidth: number;
  startColumnResize: (col: 'desc' | 'author' | 'date', clientX: number, width: number) => void;
  actualTheadHeight: number;
  actualRowHeight: number;
  theadRef: React.RefObject<HTMLTableSectionElement | null>;
  tbodyRef: React.RefObject<HTMLTableSectionElement | null>;
  selection: any;
  handleRowMouseEnter: (e: React.MouseEvent, commit: Commit) => void;
  handleRowMouseMove: (e: React.MouseEvent) => void;
  handleRowMouseLeave: () => void;
  handleTableScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  renderRefs: (refs: string) => React.ReactNode;
  openContextMenu: (e: React.MouseEvent, data: any) => void;
}

export function LogTab({
  isPulling,
  setIsPulling,
  isPushing,
  setIsPushing,
  graphWidth,
  setGraphWidth,
  descWidth,
  authorWidth,
  dateWidth,
  startColumnResize,
  actualTheadHeight,
  actualRowHeight,
  theadRef,
  tbodyRef,
  selection,
  handleRowMouseEnter,
  handleRowMouseMove,
  handleRowMouseLeave,
  handleTableScroll,
  renderRefs,
  openContextMenu,
}: LogTabProps) {
  const {
    gitData,
    vscode,
    searchQuery,
    setSearchQuery,
    fileFilter,
    setFileFilter,
    isFetching,
    setIsFetching,
    isFetchingMore,
    hasMoreCommits,
    selectedCommitFiles,
    isCompareMode,
    setIsCompareMode,
    filesExpanded,
    setFilesExpanded,
    detailsExpanded,
    setDetailsExpanded,
    filterAuthor,
    setFilterAuthor
  } = useGitData();

  const [authorMenuOpen, setAuthorMenuOpen] = React.useState(false);
  const authorHeaderRef = React.useRef<HTMLTableHeaderCellElement>(null);

  React.useEffect(() => {
    if (!authorMenuOpen) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (authorHeaderRef.current && !authorHeaderRef.current.contains(e.target as Node)) {
        setAuthorMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [authorMenuOpen]);

  const handleSelectAuthor = (author: string) => {
    console.log('[Webview] Selected author:', author);
    setFilterAuthor(author);
    vscode.postMessage({ type: 'setAuthorFilter', author });
    setAuthorMenuOpen(false);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      vscode.postMessage({ type: 'setSearchFilter', search: searchQuery });
    }
  };
  const commitsList = gitData?.log?.all || [];
  const selectedCommit = selection.selectedIndex >= 0 ? commitsList[selection.selectedIndex] : null;

  const handleFileClick = (path: string) => {
    if (selectedCommitFiles) {
      vscode.postMessage({
        type: 'openDiff',
        hash: selectedCommitFiles.hash,
        path,
        isCompare: isCompareMode
      });
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isFetching && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            backgroundColor: 'var(--vscode-editorWidget-background)',
            padding: '12px 24px',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid var(--vscode-widget-border, var(--vscode-panel-border))',
            pointerEvents: 'none'
          }}>
            <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '20px', color: 'var(--vscode-button-background)' }}></span>
            <span style={{ fontSize: '13px', color: 'var(--vscode-foreground)' }}>Loading commits...</span>
          </div>
        )}
        <div className="header" style={{ justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search commits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              style={{
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                padding: '2px 6px',
                fontSize: '11px',
                borderRadius: '2px',
                outline: 'none',
                width: '200px'
              }}
            />
            {searchQuery && (
              <span
                style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.7, padding: '0 4px' }}
                title="Clear Search"
                onClick={() => {
                  setSearchQuery('');
                  vscode.postMessage({ type: 'setSearchFilter', search: '' });
                }}
              >
                ✕
              </span>
            )}

            {fileFilter && (
              <div
                className="file-filter-badge"
                title={`Filtering history by file: ${fileFilter}`}
              >
                <span className="codicon codicon-file"></span>
                <span className="file-filter-badge-name">{fileFilter.split('/').pop()}</span>
                <span
                  className="file-filter-badge-close"
                  onClick={() => {
                    setFileFilter('');
                    vscode.postMessage({ type: 'setFileFilter', file: '' });
                  }}
                >
                  ✕
                </span>
              </div>
            )}
            <span style={{ marginLeft: '20px' }}>{commitsList.length} commits</span>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="toolbar-button"
              title="Refresh / Fetch Remote"
              onClick={() => { setIsFetching(true); vscode.postMessage({ type: 'fetch' }); }}
              disabled={isFetching}
            >
              <span className={`codicon ${isFetching ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'}`}></span>
            </button>
            <button
              className="toolbar-button"
              title="Pull"
              onClick={() => { setIsPulling(true); vscode.postMessage({ type: 'pull' }); }}
              disabled={isPulling}
            >
              <span className={`codicon ${isPulling ? 'codicon-loading codicon-modifier-spin' : 'codicon-cloud-download'}`}></span>
            </button>
            <button
              className="toolbar-button"
              title="Push"
              onClick={() => { setIsPushing(true); vscode.postMessage({ type: 'push' }); }}
              disabled={isPushing}
            >
              <span className={`codicon ${isPushing ? 'codicon-loading codicon-modifier-spin' : 'codicon-cloud-upload'}`}></span>
            </button>
            <button
              className="toolbar-button"
              title={selection.selectedIndices.length > 1 ? `Cherry-pick ${selection.selectedIndices.length} selected commits` : "Cherry-pick selected commit"}
              disabled={selection.selectedIndices.length === 0}
              onClick={() => {
                if (selection.selectedIndices.length > 1) {
                  const sortedIndices = [...selection.selectedIndices].sort((a, b) => b - a); // oldest first
                  const hashes = sortedIndices.map(i => commitsList[i]?.hash).filter((h): h is string => !!h);
                  vscode.postMessage({ type: 'cherryPickMultiple', hashes });
                } else if (selectedCommit) {
                  vscode.postMessage({ type: 'cherryPick', hash: selectedCommit.hash });
                }
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block' }}
              >
                <circle cx="11" cy="18" r="3" />
                <circle cx="18" cy="15" r="3" />
                <path d="M12.5 15.5 15 7" />
                <path d="M19.5 12.5 21 7" />
                <path d="M15 7h6.5l-4.5-4.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="table-container" style={{ flex: 1, position: 'relative' }} onScroll={handleTableScroll}>
          <div style={{ opacity: isFetching ? 0.3 : 1, transition: 'opacity 0.2s ease', pointerEvents: isFetching ? 'none' : 'auto' }}>
            {commitsList.length > 0 && (
              <div style={{ position: 'absolute', top: `${actualTheadHeight}px`, left: 0, pointerEvents: 'none', zIndex: 5 }}>
                <GitGraph
                  commits={commitsList}
                  rowHeight={actualRowHeight}
                  onWidthChange={setGraphWidth}
                  isLinear={!!fileFilter}
                />
              </div>
            )}
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead ref={theadRef}>
                <tr>
                  <th style={{ width: `${graphWidth}px` }}>Graph</th>
                  <th style={{ width: `${descWidth}px`, position: 'relative' }}>
                    Description
                    <div
                      className="resize-handle"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        startColumnResize('desc', e.clientX, descWidth);
                      }}
                    />
                  </th>
                  <th ref={authorHeaderRef} style={{ width: `${authorWidth}px`, position: 'relative' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '8px', boxSizing: 'border-box', height: '100%', width: '100%', overflow: 'hidden' }}
                    >
                      <div
                        onClick={() => setAuthorMenuOpen(prev => !prev)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 12px)' }}
                        title="Filter by Author"
                      >
                        <span style={{ fontWeight: 'bold' }}>
                          Author{filterAuthor !== 'ALL' ? `: ${filterAuthor}` : ''}
                        </span>
                        <span className="codicon codicon-chevron-down" style={{ fontSize: '10px', opacity: 0.8 }}></span>
                      </div>
                    </div>

                    {authorMenuOpen && (
                      <div
                        className="header-filter-popup"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '4px',
                          zIndex: 1000,
                          backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
                          color: 'var(--vscode-foreground, #cccccc)',
                          border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545))',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                          borderRadius: '4px',
                          minWidth: '160px',
                          maxWidth: '240px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          padding: '4px 0',
                          textAlign: 'left'
                        }}
                      >
                        <div
                          className={`header-filter-item ${filterAuthor === 'ALL' ? 'selected' : ''}`}
                          onClick={() => handleSelectAuthor('ALL')}
                          style={{
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            userSelect: 'none'
                          }}
                        >
                          <span>All</span>
                          {filterAuthor === 'ALL' && <span className="codicon codicon-check" style={{ fontSize: '10px' }}></span>}
                        </div>
                        <div className="context-menu-separator" style={{ margin: '4px 0', height: '1px', backgroundColor: 'var(--vscode-panel-border, #454545)', opacity: 0.4 }} />
                        {gitData?.authors?.map((author) => (
                          <div
                            key={author}
                            className={`header-filter-item ${filterAuthor === author ? 'selected' : ''}`}
                            onClick={() => handleSelectAuthor(author)}
                            style={{
                              padding: '4px 12px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              userSelect: 'none',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{author}</span>
                            {filterAuthor === author && <span className="codicon codicon-check" style={{ fontSize: '10px' }}></span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className="resize-handle"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        startColumnResize('author', e.clientX, authorWidth);
                      }}
                    />
                  </th>
                  <th style={{ width: `${dateWidth}px`, position: 'relative' }}>
                    Date
                    <div
                      className="resize-handle"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        startColumnResize('date', e.clientX, dateWidth);
                      }}
                    />
                  </th>
                  <th style={{ width: 'auto', borderRight: 'none' }}></th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {commitsList.map((commit: Commit, idx: number) => (
                  <tr
                    key={commit.hash}
                    className={selection.selectedIndices.includes(idx) ? 'selected' : ''}
                    onClick={(e) => selection.handleSelectCommit(idx, commit.hash, e)}
                    onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                    onContextMenu={(e) => selection.handleRowContextMenu(e, commit, idx, openContextMenu)}
                    onMouseEnter={(e) => handleRowMouseEnter(e, commit)}
                    onMouseMove={handleRowMouseMove}
                    onMouseLeave={handleRowMouseLeave}
                  >
                    <td style={{ width: `${graphWidth}px` }}></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'nowrap', marginRight: '8px', flexShrink: 0 }}>
                          {renderRefs(commit.refs)}
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{commit.message.split('\n')[0]}</span>
                      </div>
                    </td>
                    <td>
                      {commit.author_name}
                      {gitData?.currentUser && (gitData.currentUser.name === commit.author_name || gitData.currentUser.email === commit.author_email) && (
                        <span style={{ marginLeft: '4px', opacity: 0.6, fontSize: '10px', fontStyle: 'italic' }} title="Me">
                          (me)
                        </span>
                      )}
                    </td>
                    <td>{formatDate(commit.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ borderRight: 'none' }}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isFetchingMore && (
            <div className="loading-row">
              <div className="loading-spinner"></div>
              Loading more commits...
            </div>
          )}
        </div>
      </div>

      {selection.selectedIndex >= 0 && (
        <CommitDetailsSidePane
          commit={selectedCommit ?? null}
          files={selectedCommitFiles}
          isCompareMode={isCompareMode}
          filesExpanded={filesExpanded}
          detailsExpanded={detailsExpanded}
          onClose={() => { selection.clearSelection(); setIsCompareMode(false); }}
          onFileClick={handleFileClick}
          onExitCompare={() => {
            setIsCompareMode(false);
            if (selectedCommit) {
              vscode.postMessage({ type: 'getDiff', hash: selectedCommit.hash });
            }
          }}
          onToggleFiles={() => setFilesExpanded(!filesExpanded)}
          onToggleDetails={() => setDetailsExpanded(!detailsExpanded)}
          renderRefs={renderRefs}
        />
      )}
    </div>
  );
}
