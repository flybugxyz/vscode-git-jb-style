import React, { useState, useEffect } from 'react';
import { Commit } from '../types';

interface RebaseAction {
  hash: string;
  action: 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';
  message?: string;
  shortMessage: string;
}

interface Props {
  baseCommit: Commit;
  commits: Commit[]; // commits from HEAD down to baseCommit (exclusive of baseCommit)
  onClose: () => void;
  onSubmit: (actions: { action: string; hash: string; message?: string }[]) => void;
}

export function InteractiveRebaseModal({ baseCommit, commits, onClose, onSubmit }: Props) {
  const [actions, setActions] = useState<RebaseAction[]>([]);

  useEffect(() => {
    // Reverse because commits are ordered newest to oldest (HEAD -> base)
    // and git-rebase-todo expects oldest to newest (base -> HEAD)
    const reversed = [...commits].reverse();
    setActions(
      reversed.map((c) => ({
        hash: c.hash,
        action: 'pick',
        message: c.message,
        shortMessage: c.message.split('\n')[0]
      }))
    );
  }, [commits]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === index || isNaN(sourceIndex)) return;

    const newActions = [...actions];
    const [moved] = newActions.splice(sourceIndex, 1);
    newActions.splice(index, 0, moved);
    setActions(newActions);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleActionChange = (index: number, action: RebaseAction['action']) => {
    const newActions = [...actions];
    newActions[index].action = action;
    setActions(newActions);
  };

  const handleMessageChange = (index: number, message: string) => {
    const newActions = [...actions];
    newActions[index].message = message;
    setActions(newActions);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>Interactive Rebase from {baseCommit.hash.substring(0, 7)}</h2>
        </div>
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <p style={{ marginBottom: '16px' }}>Drag and drop rows to reorder commits. Select an action for each commit.</p>
          <div className="rebase-list">
            {actions.map((act, index) => (
              <div
                key={act.hash}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragOver={handleDragOver}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px',
                  border: '1px solid var(--vscode-widget-border)',
                  marginBottom: '4px',
                  backgroundColor: 'var(--vscode-editor-background)',
                  cursor: 'grab'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className="codicon codicon-grabber" style={{ color: 'var(--vscode-descriptionForeground)' }}></i>
                  <select
                    value={act.action}
                    onChange={(e) => handleActionChange(index, e.target.value as any)}
                    style={{
                      background: 'var(--vscode-dropdown-background)',
                      color: 'var(--vscode-dropdown-foreground)',
                      border: '1px solid var(--vscode-dropdown-border)',
                      padding: '4px',
                      outline: 'none'
                    }}
                  >
                    <option value="pick">pick</option>
                    <option value="reword">reword</option>
                    <option value="edit">edit</option>
                    <option value="squash">squash</option>
                    <option value="fixup">fixup</option>
                    <option value="drop">drop</option>
                  </select>
                  <span style={{ fontFamily: 'monospace', color: 'var(--vscode-textLink-foreground)' }}>
                    {act.hash.substring(0, 7)}
                  </span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {act.shortMessage}
                  </span>
                </div>
                {(act.action === 'reword' || act.action === 'squash') && (
                  <div style={{ marginTop: '8px', paddingLeft: '28px' }}>
                    <textarea
                      value={act.message}
                      onChange={(e) => handleMessageChange(index, e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        resize: 'vertical',
                        background: 'var(--vscode-input-background)',
                        color: 'var(--vscode-input-foreground)',
                        border: '1px solid var(--vscode-input-border)',
                        padding: '4px',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px', borderTop: '1px solid var(--vscode-widget-border)' }}>
          <button className="vscode-button secondary" onClick={onClose}>Cancel</button>
          <button className="vscode-button" onClick={() => onSubmit(actions)}>Start Rebase</button>
        </div>
      </div>
    </div>
  );
}
