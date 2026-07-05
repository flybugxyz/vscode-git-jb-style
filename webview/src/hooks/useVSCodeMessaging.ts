import { useEffect } from 'react';
import { useGitData } from '../GitDataContext';

export function useVSCodeMessaging(callbacks: {
  onCommitMessageGenerated?: (msg: string) => void;
  onCommitMessageProgress?: (chunk: string) => void;
  onStashMessageGenerated?: (msg: string) => void;
  onStopLoadingState?: () => void;
}) {
  const {
    setGitData,
    setHasMoreCommits,
    setIsFetchingMore,
    setIsFetching,
    setFileFilter,
    setActiveTab,
    setSelectedCommitFiles,
    setIsCompareMode,
    vscode,
  } = useGitData();

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
  }, [vscode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'update': {
          const payload = message.payload;
          setGitData(payload);
          setHasMoreCommits(true);
          setIsFetchingMore(false);
          setIsFetching(false);
          callbacks.onStopLoadingState?.();

          if (payload.fileFilter !== undefined) {
            setFileFilter(payload.fileFilter);
          }
          if (payload.selectTab) {
            setActiveTab(payload.selectTab);
          }
          break;
        }
        case 'appendCommits': {
          setIsFetchingMore(false);
          if (message.payload?.log?.all) {
            const newCommits = message.payload.log.all;
            if (newCommits.length < 100) {
              setHasMoreCommits(false);
            }
            setGitData((prev) => {
              if (!prev || !prev.log) return prev;
              return {
                ...prev,
                log: {
                  ...prev.log,
                  all: [...prev.log.all, ...newCommits],
                },
              };
            });
          } else {
            setHasMoreCommits(false);
          }
          break;
        }
        case 'selectTab': {
          if (message.tab) {
            setActiveTab(message.tab);
          }
          break;
        }
        case 'files': {
          setSelectedCommitFiles({ hash: message.hash, files: message.files });
          break;
        }
        case 'compareFiles': {
          setSelectedCommitFiles({ hash: message.hash, files: message.files });
          setIsCompareMode(true);
          break;
        }
        case 'generateCommitMessageResult': {
          if (message.message && callbacks.onCommitMessageGenerated) {
            callbacks.onCommitMessageGenerated(message.message);
          }
          if (message.error && callbacks.onCommitMessageGenerated) {
            // Handle error if needed, or pass empty. But UI can clear generating state.
            callbacks.onCommitMessageGenerated(message.message || '');
          }
          break;
        }
        case 'generateCommitMessageProgress': {
          if (message.chunk && callbacks.onCommitMessageProgress) {
            callbacks.onCommitMessageProgress(message.chunk);
          }
          break;
        }
        case 'generateStashMessageResult': {
          if (message.message && callbacks.onStashMessageGenerated) {
            callbacks.onStashMessageGenerated(message.message);
          }
          break;
        }
        case 'stopLoading': {
          setIsFetching(false);
          setIsFetchingMore(false);
          callbacks.onStopLoadingState?.();
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    setGitData, setHasMoreCommits, setIsFetchingMore, setIsFetching,
    setFileFilter, setActiveTab, setSelectedCommitFiles, setIsCompareMode,
    vscode, callbacks
  ]);
}
