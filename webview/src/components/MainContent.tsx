import React, { useRef, useState, useCallback, useEffect } from 'react';
import { LogTab } from './LogTab';
import { LocalChangesTab } from './LocalChangesTab';
import { StashTab } from './StashTab';
import { WorktreeTab } from './WorktreeTab';
import { LocalHistoryTab } from './LocalHistoryTab';
import { useGitData } from '../GitDataContext';
import { useContextMenuState } from '../hooks/useContextMenuState';
import { useCommitSelection } from '../hooks/useCommitSelection';
import { useResizable } from '../hooks/useResizable';
import { CommitHoverPopup } from '../CommitHoverPopup';
import { ContextMenu } from '../ContextMenu';
import { Commit, MenuState, MenuActionData } from '../types';
import {
  getCommitMenuItems as buildCommitMenuItems,
  getBranchMenuItems as buildBranchMenuItems,
  getTagMenuItems as buildTagMenuItems,
  getStashMenuItems as buildStashMenuItems
} from '../contextMenuActions';
import { UseCommitSelectionReturn } from '../hooks/useCommitSelection';

interface MainContentProps {
  selection: UseCommitSelectionReturn;
  menuState: MenuState | null;
  openContextMenu: (e: React.MouseEvent, data: MenuActionData) => void;
  handleCloseMenu: () => void;
  handleMenuAction: (action: string) => void;
}

export function MainContent({
  selection,
  menuState,
  openContextMenu,
  handleCloseMenu,
  handleMenuAction
}: MainContentProps) {
  const {
    gitData,
    activeTab,
    setActiveTab,
    vscode,
    searchQuery,
    fileFilter,
    setSelectedCommitFiles,
    setIsCompareMode,
    pinnedBranches
  } = useGitData();

  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [commitActionState, setCommitActionState] = useState<'commit' | 'commitAndPush' | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [actualRowHeight, setActualRowHeight] = useState(24);
  const [actualTheadHeight, setActualTheadHeight] = useState(28);
  const [graphWidth, setGraphWidth] = useState(100);

  const { descWidth, authorWidth, dateWidth, commitBoxHeight, startColumnResize, startCommitBoxResize } = useResizable();

  const { filterBranch, filterAuthor } = useGitData();

  useEffect(() => {
    selection.clearSelection();
  }, [filterBranch, filterAuthor]);

  const [hoveredCommit, setHoveredCommit] = useState<{ commit: Commit; x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseCoordsRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!tbodyRef.current || !theadRef.current) return;
    let animationFrameId: number;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (theadRef.current) {
          setActualTheadHeight(theadRef.current.getBoundingClientRect().height);
        }
        if (tbodyRef.current) {
          const length = gitData?.log?.all?.length || 0;
          if (length > 0) {
            const tHeight = tbodyRef.current.getBoundingClientRect().height;
            setActualRowHeight(tHeight / length);
          }
        }
      });
    });
    observer.observe(tbodyRef.current);
    observer.observe(theadRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [gitData?.log?.all]);

  const handleRowMouseEnter = useCallback((e: React.MouseEvent, commit: Commit) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCommit({ commit, x: mouseCoordsRef.current.x, y: mouseCoordsRef.current.y });
    }, 450);
  }, []);

  const handleRowMouseMove = useCallback((e: React.MouseEvent) => {
    mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
    if (hoveredCommit) {
      setHoveredCommit(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  }, [hoveredCommit]);

  const handleRowMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredCommit(null);
  }, []);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredCommit(null);
  }, []);

  const renderRefs = useCallback((refs: string) => {
    if (!refs) return null;
    
    const refArray: string[] = [];
    refs.split(', ').forEach(ref => {
      if (ref.includes('HEAD ->')) {
        refArray.push('HEAD');
        refArray.push(ref.split('HEAD ->')[1].trim());
      } else {
        refArray.push(ref.trim());
      }
    });

    return refArray.map((ref, i) => {
      const isHead = ref === 'HEAD';
      const isRemote = ref.includes('/');
      const isTag = ref.includes('tag: ');
      
      let className = 'label-branch';
      if (isHead) className = 'label-head';
      else if (isRemote) className = 'label-remote';
      else if (isTag) className = 'label-tag';

      const displayText = isTag ? ref.replace('tag: ', '') : ref;

      return (
        <span 
          key={`${ref}-${i}`} 
          className={`label-pill ${className}`}
          onContextMenu={(e) => {
            if (isHead) return;
            openContextMenu(e, isTag 
              ? { kind: 'tag', tag: displayText } 
              : { kind: 'branch', branch: displayText, isRemote }
            );
          }}
        >
          {displayText}
        </span>
      );
    });
  }, [openContextMenu]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'update' || event.data.type === 'stopLoading') {
        setIsPulling(false);
        setIsPushing(false);
        setCommitActionState(null);
      }
      if (event.data.type === 'generateCommitMessageResult') {
        setIsGenerating(false);
        if (event.data.message) {
          setCommitMessage(event.data.message);
        }
      }
      if (event.data.type === 'generateCommitMessageProgress') {
        if (event.data.chunk) {
          setCommitMessage(prev => prev + event.data.chunk);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const getCommitMenuItems = () => buildCommitMenuItems(selection.selectedIndices.length, selection.checkCanSquash());
  const getBranchMenuItems = () => {
    if (menuState?.kind !== 'branch') return [];
    return buildBranchMenuItems(
      menuState.branch,
      menuState.isRemote,
      menuState.branch === gitData?.branches?.current,
      pinnedBranches?.has(menuState.branch) || false
    );
  };
  const getTagMenuItems = () => buildTagMenuItems();
  const getStashMenuItems = () => buildStashMenuItems();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      <div className="tabs">
        <div className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>Log</div>
        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => { setActiveTab('local'); selection.clearSelection(); setIsCompareMode(false); }}>
          Local Changes {gitData?.status?.files && gitData.status.files.length > 0 && `(${gitData.status.files.length})`}
        </div>
        <div className={`tab ${activeTab === 'stashes' ? 'active' : ''}`} onClick={() => { setActiveTab('stashes'); selection.clearSelection(); setIsCompareMode(false); }}>
          Stashes {gitData?.stashes && gitData.stashes.length > 0 && `(${gitData.stashes.length})`}
        </div>
        <div className={`tab ${activeTab === 'worktrees' ? 'active' : ''}`} onClick={() => { setActiveTab('worktrees'); selection.clearSelection(); setIsCompareMode(false); }}>
          Worktrees {gitData?.worktrees && gitData.worktrees.length > 0 && `(${gitData.worktrees.length})`}
        </div>
        <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); selection.clearSelection(); setIsCompareMode(false); }}>
          Local History
        </div>
        <div style={{ flex: 1 }}></div>
        <div 
          className="tab" 
          title={activeTab === 'history' ? 'Refresh Local History' : 'Refresh Git Status'}
          onClick={() => vscode.postMessage({ type: 'refresh' })}
          style={{ padding: '0 10px', display: 'flex', alignItems: 'center' }}
        >
          <span className="codicon codicon-refresh" style={{ fontSize: '14px' }}></span>
        </div>
      </div>

      {gitData?.isRebasing && (
        <div style={{ 
          backgroundColor: 'var(--vscode-statusBarItem-warningBackground)', 
          color: 'var(--vscode-statusBarItem-warningForeground)', 
          padding: '4px 12px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          borderBottom: '1px solid var(--vscode-widget-border)'
        }}>
          <span className="codicon codicon-warning"></span>
          <span>Rebase in progress. Resolve conflicts in Local Changes, then continue.</span>
          <div style={{ flex: 1 }}></div>
          <button className="vscode-button" onClick={() => vscode.postMessage({ type: 'continueRebase' })} style={{ height: '24px', padding: '0 8px' }}>Continue Rebase</button>
          <button className="vscode-button secondary" onClick={() => vscode.postMessage({ type: 'abortRebase' })} style={{ height: '24px', padding: '0 8px' }}>Abort Rebase</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} className="main-content">
        <div style={{ display: activeTab === 'log' ? 'flex' : 'none', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <LogTab
            isPulling={isPulling}
            setIsPulling={setIsPulling}
            isPushing={isPushing}
            setIsPushing={setIsPushing}
            graphWidth={graphWidth}
            setGraphWidth={setGraphWidth}
            descWidth={descWidth}
            authorWidth={authorWidth}
            dateWidth={dateWidth}
            startColumnResize={startColumnResize}
            actualTheadHeight={actualTheadHeight}
            actualRowHeight={actualRowHeight}
            theadRef={theadRef}
            tbodyRef={tbodyRef}
            selection={selection}
            handleRowMouseEnter={handleRowMouseEnter}
            handleRowMouseMove={handleRowMouseMove}
            handleRowMouseLeave={handleRowMouseLeave}
            handleTableScroll={handleTableScroll}
            renderRefs={renderRefs}
            openContextMenu={openContextMenu}
          />
        </div>
        <div style={{ display: activeTab === 'local' ? 'flex' : 'none', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <LocalChangesTab
            commitBoxHeight={commitBoxHeight}
            onStartResizeCommitBox={startCommitBoxResize}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            commitActionState={commitActionState}
            setCommitActionState={setCommitActionState}
          />
        </div>
        <div style={{ display: activeTab === 'stashes' ? 'flex' : 'none', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <StashTab
            openContextMenu={openContextMenu}
            renderRefs={renderRefs}
          />
        </div>
        <div style={{ display: activeTab === 'worktrees' ? 'flex' : 'none', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <WorktreeTab />
        </div>
        <div style={{ display: activeTab === 'history' ? 'flex' : 'none', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <LocalHistoryTab />
        </div>

      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={
            menuState.kind === 'commit'
              ? getCommitMenuItems()
              : menuState.kind === 'branch'
                ? getBranchMenuItems()
                : menuState.kind === 'tag'
                  ? getTagMenuItems()
                  : getStashMenuItems()
          }
          onAction={handleMenuAction}
          onClose={handleCloseMenu}
        />
      )}
      
      {hoveredCommit && (
        <CommitHoverPopup
          commit={hoveredCommit.commit}
          x={hoveredCommit.x}
          y={hoveredCommit.y}
        />
      )}
      </div>
    </div>
  );
}
