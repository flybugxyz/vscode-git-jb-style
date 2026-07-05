import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GitData, FILTER_ALL, Commit } from './types';

// The singleton vsCodeApi
declare const acquireVsCodeApi: any;
export const vscodeApi = acquireVsCodeApi();

export interface IGitDataContext {
  vscode: any;
  gitData: GitData | null;
  setGitData: React.Dispatch<React.SetStateAction<GitData | null>>;

  activeTab: 'log' | 'local' | 'stashes' | 'worktrees' | 'history';
  setActiveTab: React.Dispatch<React.SetStateAction<'log' | 'local' | 'stashes' | 'worktrees' | 'history'>>;

  checkedFiles: Set<string>;
  setCheckedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;

  selectedCommitFiles: { hash: string; files: { status: string; path: string }[] } | null;
  setSelectedCommitFiles: React.Dispatch<React.SetStateAction<{ hash: string; files: { status: string; path: string }[] } | null>>;

  isCompareMode: boolean;
  setIsCompareMode: React.Dispatch<React.SetStateAction<boolean>>;

  interactiveRebaseBase: Commit | null;
  setInteractiveRebaseBase: React.Dispatch<React.SetStateAction<Commit | null>>;

  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;

  fileFilter: string;
  setFileFilter: React.Dispatch<React.SetStateAction<string>>;

  filterBranch: string;
  setFilterBranch: React.Dispatch<React.SetStateAction<string>>;

  filterAuthor: string;
  setFilterAuthor: React.Dispatch<React.SetStateAction<string>>;

  isFetching: boolean;
  setIsFetching: React.Dispatch<React.SetStateAction<boolean>>;
  isFetchingMore: boolean;
  setIsFetchingMore: React.Dispatch<React.SetStateAction<boolean>>;
  hasMoreCommits: boolean;
  setHasMoreCommits: React.Dispatch<React.SetStateAction<boolean>>;

  filesExpanded: boolean;
  setFilesExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  detailsExpanded: boolean;
  setDetailsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  pinnedBranches: Set<string>;
  setPinnedBranches: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const GitDataContext = createContext<IGitDataContext | undefined>(undefined);

export function GitDataProvider({ children }: { children: ReactNode }) {
  const [gitData, setGitData] = useState<GitData | null>(null);
  const [activeTab, setActiveTab] = useState<'log' | 'local' | 'stashes' | 'worktrees' | 'history'>('log');
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<{ hash: string; files: { status: string; path: string }[] } | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [interactiveRebaseBase, setInteractiveRebaseBase] = useState<Commit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [filterBranch, setFilterBranch] = useState(FILTER_ALL);
  const [filterAuthor, setFilterAuthor] = useState(FILTER_ALL);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreCommits, setHasMoreCommits] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [pinnedBranches, setPinnedBranches] = useState<Set<string>>(new Set());

  const value = {
    vscode: vscodeApi,
    gitData, setGitData,
    activeTab, setActiveTab,
    checkedFiles, setCheckedFiles,
    selectedCommitFiles, setSelectedCommitFiles,
    isCompareMode, setIsCompareMode,
    interactiveRebaseBase, setInteractiveRebaseBase,
    searchQuery, setSearchQuery,
    fileFilter, setFileFilter,
    filterBranch, setFilterBranch,
    filterAuthor, setFilterAuthor,
    isFetching, setIsFetching,
    isFetchingMore, setIsFetchingMore,
    hasMoreCommits, setHasMoreCommits,
    filesExpanded, setFilesExpanded,
    detailsExpanded, setDetailsExpanded,
    pinnedBranches, setPinnedBranches
  };

  return (
    <GitDataContext.Provider value={value}>
      {children}
    </GitDataContext.Provider>
  );
}

export function useGitData() {
  const context = useContext(GitDataContext);
  if (context === undefined) {
    throw new Error('useGitData must be used within a GitDataProvider');
  }
  return context;
}
