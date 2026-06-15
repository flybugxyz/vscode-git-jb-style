import { useState, useCallback } from 'react';
import { MenuState, CommitMenu, BranchMenu, TagMenu, StashMenu, MenuActionData } from '../types';
import { dispatchMenuAction } from '../contextMenuActions';
import { useGitData } from '../GitDataContext';
import { UseCommitSelectionReturn } from './useCommitSelection';

export function useContextMenuState(selection: UseCommitSelectionReturn) {
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [rewordModal, setRewordModal] = useState<{ hash: string; currentMessage: string } | null>(null);
  const [squashModal, setSquashModal] = useState<{ hashes: string[]; defaultMessage: string } | null>(null);
  
  const { 
    vscode, 
    gitData, 
    setActiveTab, 
    setFilesExpanded, 
    setDetailsExpanded, 
    setPinnedBranches, 
    setFilterBranch,
    setInteractiveRebaseBase
  } = useGitData();

  const handleFilter = useCallback((branch: string) => {
    setFilterBranch(branch);
    selection.clearSelection();
    vscode.postMessage({ type: 'setFilter', branch });
  }, [setFilterBranch, selection, vscode]);

  const openContextMenu = useCallback((
    e: React.MouseEvent,
    data: MenuActionData
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      ...data,
      x: e.clientX,
      y: e.clientY
    } as MenuState);
  }, []);

  const handleCloseMenu = useCallback(() => setMenuState(null), []);

  const handleMenuAction = useCallback((action: string) => {
    if (!menuState) return;
    dispatchMenuAction(menuState, action, {
      postMessage: (msg: any) => vscode.postMessage(msg),
      setSelectedIndex: selection.setSelectedIndex,
      setActiveTab,
      setFilesExpanded,
      setDetailsExpanded,
      setPinnedBranches,
      handleFilter,
      getAllCommitHashes: (indices: number[]) =>
        indices.map(i => gitData?.log?.all?.[i]?.hash).filter((h): h is string => !!h),
      selectedIndices: selection.selectedIndices,
      onRewordCommit: (hash: string, currentMessage: string) => {
        setRewordModal({ hash, currentMessage });
      },
      onSquashCommits: (hashes: string[]) => {
        const selectedCommits = selection.selectedIndices.map(i => gitData?.log?.all?.[i]);
        const messages = selectedCommits.map(c => c?.message || '').filter(Boolean);
        const defaultMessage = messages.join('\n\n');
        setSquashModal({ hashes, defaultMessage });
      },
      setInteractiveRebaseBase
    });
    setMenuState(null);
  }, [
    menuState, vscode, selection, setActiveTab, 
    setFilesExpanded, setDetailsExpanded, setPinnedBranches, 
    handleFilter, gitData, setInteractiveRebaseBase
  ]);

  return {
    menuState,
    openContextMenu,
    handleCloseMenu,
    handleMenuAction,
    rewordModal,
    setRewordModal,
    squashModal,
    setSquashModal
  };
}
