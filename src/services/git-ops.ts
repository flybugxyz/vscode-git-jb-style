import { GitCoreService } from './git-core';
import { validateFilePath, validateHash, validateBranchName } from '../git-validation';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class GitOpsService {
  constructor(private core: GitCoreService) {}

  public async getStatus() {
    const git = this.core.git;
    if (!git) return undefined;
    try {
      return await git.status();
    } catch (err) {
      console.error('Error fetching git status:', err);
      return undefined;
    }
  }

  public async commit(message: string, files?: string[]) {
    const git = this.core.git;
    if (!git) return false;
    if (files) {
      files.forEach(validateFilePath);
    }
    try {
      if (files && files.length > 0) {
        await git.add(files);
        await git.commit(message, files);
      } else if (files === undefined) {
        await git.add('.');
        await git.commit(message);
      } else {
        throw new Error('No files selected for commit.');
      }
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Commit failed: ${err}`);
      return false;
    }
  }

  public async push(force: boolean = false) {
    const git = this.core.git;
    if (!git) return false;
    try {
      const options = force ? ['--force'] : [];
      await git.push(undefined, undefined, options);
      vscode.window.showInformationMessage(force ? 'Push (force) succeeded.' : 'Push succeeded.');
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Push failed: ${err}`);
      return false;
    }
  }

  public async pull() {
    const git = this.core.git;
    if (!git) return false;
    try {
      await git.pull();
      vscode.window.showInformationMessage('Pull succeeded.');
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Pull failed: ${err}`);
      return false;
    }
  }

  public async fetch() {
    const git = this.core.git;
    if (!git) return false;
    try {
      await git.fetch();
      vscode.window.showInformationMessage('Fetch succeeded.');
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Fetch failed: ${err}`);
      return false;
    }
  }

  public async discardChanges(filePath: string) {
    const git = this.core.git;
    if (!git) return false;
    validateFilePath(filePath);
    try {
      try {
        await git.reset(['HEAD', '--', filePath]);
      } catch (e) {
        // ignore reset failure if not in index
      }
      try {
        await git.checkout(['--', filePath]);
      } catch (e) {
        // ignore checkout failure if untracked
      }
      try {
        await git.clean('fd', ['--', filePath]);
      } catch (e) {
        // ignore clean failure
      }
      vscode.window.showInformationMessage(`Discarded changes in '${filePath}'.`);
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Discard failed: ${err}`);
      return false;
    }
  }

  public async cherryPick(hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateHash(hash);
    try {
      await git.raw(['cherry-pick', hash]);
      vscode.window.showInformationMessage(`Cherry-picked commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick failed: ${err}`);
    }
  }

  public async cherryPickMultiple(hashes: string[]) {
    const git = this.core.git;
    if (!git || hashes.length === 0) return;
    hashes.forEach(validateHash);
    try {
      await git.raw(['cherry-pick', ...hashes]);
      vscode.window.showInformationMessage(`Successfully cherry-picked ${hashes.length} commits.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick failed: ${err}`);
    }
  }

  public async revertCommit(hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateHash(hash);
    try {
      await git.revert(hash, ['--no-edit']);
      vscode.window.showInformationMessage(`Reverted commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Revert failed: ${err}`);
    }
  }

  public async validateSquash(hashes: string[]): Promise<{ valid: boolean; reason?: string }> {
    const git = this.core.git;
    if (!git || hashes.length <= 1) {
      return { valid: false, reason: 'Please select at least 2 commits to squash.' };
    }
    hashes.forEach(validateHash);
    try {
      const branchInfo = await git.branch(['-a']);
      if (branchInfo.detached) {
        return { valid: false, reason: 'Squashing is not supported in detached HEAD state.' };
      }

      const rawLog = await git.raw(['log', '--format=%H', '-n', '1000', 'HEAD']);
      const branchHashes = rawLog.trim().split('\n').filter(Boolean);

      const indices: number[] = [];
      for (const hash of hashes) {
        const index = branchHashes.findIndex(h => h === hash);
        if (index === -1) {
          return { valid: false, reason: `Commit ${hash.substring(0, 7)} is not in the history of the current branch.` };
        }
        indices.push(index);
      }

      indices.sort((a, b) => a - b);

      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) {
          return { valid: false, reason: 'Selected commits must be contiguous in branch history.' };
        }
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, reason: `Validation failed: ${err.message || err}` };
    }
  }

  public async squashCommits(hashes: string[], commitMessage: string): Promise<boolean> {
    const git = this.core.git;
    if (!git || hashes.length <= 1) return false;
    hashes.forEach(validateHash);
    
    let originalBranch = '';
    let originalHead = '';
    let stashed = false;
    
    try {
      const clean = await this.isWorkingTreeClean();
      if (!clean) {
        await git.raw(['stash', 'push', '-m', 'Auto-stash before squash']);
        stashed = true;
      }

      const branchInfo = await git.branch();
      originalBranch = branchInfo.current;
      originalHead = (await git.revparse(['HEAD'])).trim();
      
      if (!originalBranch || branchInfo.detached) {
        throw new Error('Not on a valid branch or branch is detached.');
      }

      const rawLog = await git.raw(['log', '--format=%H', '-n', '1000', 'HEAD']);
      const branchHashes = rawLog.trim().split('\n').filter(Boolean);
      
      const sortedByHistory = hashes
         .map(h => ({ hash: h, index: branchHashes.indexOf(h) }))
         .filter(item => item.index !== -1)
         .sort((a, b) => a.index - b.index); 
      
      if (sortedByHistory.length !== hashes.length) {
        throw new Error('Some commits are not on the current branch.');
      }

      const youngest = sortedByHistory[0].hash;
      const oldest = sortedByHistory[sortedByHistory.length - 1].hash;

      let oldestParent = '';
      try {
        oldestParent = (await git.raw(['rev-parse', `${oldest}^`])).trim();
      } catch (err) {
        throw new Error(`Cannot find parent of oldest commit ${oldest.substring(0, 7)}. Squashing the root commit is not supported.`);
      }

      const isYoungestHead = youngest === originalHead;

      if (isYoungestHead) {
        await git.reset(['--soft', oldestParent]);
        await git.commit(commitMessage);
        vscode.window.showInformationMessage('Successfully squashed commits.');
        return true;
      } else {
        const tempBranchName = `temp-squash-${Date.now()}`;
        
        await git.checkout(['-b', tempBranchName, youngest]);
        await git.reset(['--soft', oldestParent]);
        await git.commit(commitMessage);
        
        try {
          await git.raw(['cherry-pick', `${youngest}..${originalBranch}`]);
        } catch (cpErr) {
          await git.raw(['cherry-pick', '--abort']);
          throw cpErr;
        }
        
        await git.checkout(originalBranch);
        await git.reset(['--hard', tempBranchName]);
        await git.raw(['branch', '-D', tempBranchName]);
        
        vscode.window.showInformationMessage('Successfully squashed commits.');
        return true;
      }
    } catch (err: any) {
      console.error('Squash failed. Rolling back...', err);
      if (originalBranch) {
        try {
          try {
            await git.raw(['cherry-pick', '--abort']);
          } catch (e: any) {
            console.warn('cherry-pick --abort failed during squash rollback', e);
          }
          await git.checkout(originalBranch);
          if (originalHead) {
            await git.reset(['--hard', originalHead]);
          }
        } catch (rollbackErr) {
          console.error('Failed to rollback squash:', rollbackErr);
        }
      }
      vscode.window.showErrorMessage(`Squash commits failed: ${err.message || err}`);
      return false;
    } finally {
      if (stashed) {
        try {
          await git.raw(['stash', 'pop']);
        } catch (stashErr) {
          vscode.window.showWarningMessage('Auto-stash pop resulted in conflicts. Please resolve them in your working directory.');
        }
      }
    }
  }

  public async isWorkingTreeClean(): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    try {
      const status = await git.status();
      const hasChanges = status.files.some(f => {
        const isUntracked = f.index === '?' && f.working_dir === '?';
        return !isUntracked;
      });
      return !hasChanges;
    } catch (err) {
      console.error('Error checking git status cleanliness:', err);
      return false;
    }
  }

  public async rewordCommit(hash: string, newMessage: string): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    validateHash(hash);

    let originalBranch = '';
    let originalHead = '';
    let stashed = false;

    try {
      const clean = await this.isWorkingTreeClean();
      if (!clean) {
        await git.raw(['stash', 'push', '-m', 'Auto-stash before reword']);
        stashed = true;
      }

      const branchInfo = await git.branch();
      originalBranch = branchInfo.current;
      originalHead = (await git.revparse(['HEAD'])).trim();

      if (!originalBranch || branchInfo.detached) {
        throw new Error('Not on a valid branch or branch is detached.');
      }

      const rawLog = await git.raw(['log', '--format=%H', '-n', '1000', 'HEAD']);
      const branchHashes = rawLog.trim().split('\n').filter(Boolean);
      const commitIndex = branchHashes.indexOf(hash);
      if (commitIndex === -1) {
        throw new Error(`Commit ${hash.substring(0, 7)} is not in the history of the current branch.`);
      }

      let parent = '';
      try {
        parent = (await git.raw(['rev-parse', `${hash}^`])).trim();
      } catch (err) {
        throw new Error(`Cannot find parent of commit ${hash.substring(0, 7)}. Rewording the root commit is not supported.`);
      }

      const isHead = hash === originalHead;

      if (isHead) {
        await git.raw(['commit', '--amend', '-m', newMessage]);
        vscode.window.showInformationMessage('Successfully updated commit message.');
        return true;
      } else {
        const tempBranchName = `temp-reword-${Date.now()}`;
        
        await git.checkout(['-b', tempBranchName, hash]);
        await git.raw(['commit', '--amend', '-m', newMessage]);
        
        try {
          await git.raw(['cherry-pick', `${hash}..${originalBranch}`]);
        } catch (cpErr) {
          await git.raw(['cherry-pick', '--abort']);
          throw cpErr;
        }
        
        await git.checkout(originalBranch);
        await git.reset(['--hard', tempBranchName]);
        await git.raw(['branch', '-D', tempBranchName]);
        
        vscode.window.showInformationMessage('Successfully updated commit message.');
        return true;
      }
    } catch (err: any) {
      console.error('Reword failed. Rolling back...', err);
      if (originalBranch) {
        try {
          try {
            await git.raw(['cherry-pick', '--abort']);
          } catch (e: any) {
            console.warn('cherry-pick --abort failed during reword rollback', e);
          }
          await git.checkout(originalBranch);
          if (originalHead) {
            await git.reset(['--hard', originalHead]);
          }
        } catch (rollbackErr) {
          console.error('Failed to rollback reword:', rollbackErr);
        }
      }
      vscode.window.showErrorMessage(`Edit commit message failed: ${err.message || err}`);
      return false;
    } finally {
      if (stashed) {
        try {
          await git.raw(['stash', 'pop']);
        } catch (stashErr) {
          vscode.window.showWarningMessage('Auto-stash pop resulted in conflicts. Please resolve them in your working directory.');
        }
      }
    }
  }

  public async getCommitMessages(hashes: string[]): Promise<string[]> {
    const git = this.core.git;
    if (!git) return [];
    hashes.forEach(validateHash);
    const messages: string[] = [];
    for (const hash of hashes) {
      try {
        const msg = await git.raw(['log', '-1', '--format=%B', hash]);
        messages.push(msg.trim());
      } catch {
        messages.push('');
      }
    }
    return messages;
  }

  public async continueRebase(): Promise<boolean> {
    const git = this.core.git;
    if (!git || !this.core.activeRepoPath) return false;
    
    const gitDir = path.join(this.core.activeRepoPath, '.git');
    const editorScriptPath = path.join(gitDir, 'git-constellation-seq-editor.js');
    const msgEditorScriptPath = path.join(gitDir, 'git-constellation-msg-editor.js');
    const jsonPath = path.join(gitDir, 'git-constellation-rebase.json');
    
    try {
      const nodeExe = process.execPath;
      const env = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        GIT_SEQUENCE_EDITOR: '"' + nodeExe + '" "' + editorScriptPath + '"',
        GIT_EDITOR: '"' + nodeExe + '" "' + msgEditorScriptPath + '"',
        GIT_CONSTELLATION_REBASE_JSON: jsonPath
      };

      git.env(env as any);
      await git.raw(['rebase', '--continue']);
      vscode.window.showInformationMessage('Rebase continued successfully.');
      return true;
    } catch (err: any) {
      console.error('Continue rebase error:', err);
      const rebaseMergeExists = fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'));
      if (rebaseMergeExists) {
        vscode.window.showWarningMessage('Rebase is still paused. Resolve conflicts or edits before continuing.');
        return false;
      } else {
        vscode.window.showErrorMessage('Rebase failed: ' + (err.message || err));
        return false;
      }
    } finally {
      git.env(process.env as any);
      const rebaseMergeExists = fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'));
      if (!rebaseMergeExists) {
        if (fs.existsSync(editorScriptPath)) fs.unlinkSync(editorScriptPath);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
        if (fs.existsSync(msgEditorScriptPath)) fs.unlinkSync(msgEditorScriptPath);
        if (fs.existsSync(jsonPath + '.state')) fs.unlinkSync(jsonPath + '.state');
      }
    }
  }

  public async abortRebase(): Promise<boolean> {
    const git = this.core.git;
    if (!git || !this.core.activeRepoPath) return false;
    try {
      await git.raw(['rebase', '--abort']);
      vscode.window.showInformationMessage('Rebase aborted.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage('Failed to abort rebase: ' + (err.message || err));
      return false;
    } finally {
      const gitDir = path.join(this.core.activeRepoPath, '.git');
      const editorScriptPath = path.join(gitDir, 'git-constellation-seq-editor.js');
      const msgEditorScriptPath = path.join(gitDir, 'git-constellation-msg-editor.js');
      const jsonPath = path.join(gitDir, 'git-constellation-rebase.json');
      if (fs.existsSync(editorScriptPath)) fs.unlinkSync(editorScriptPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      if (fs.existsSync(msgEditorScriptPath)) fs.unlinkSync(msgEditorScriptPath);
      if (fs.existsSync(jsonPath + '.state')) fs.unlinkSync(jsonPath + '.state');
    }
  }

  public async interactiveRebase(base: string, actions: { action: string, hash: string, message?: string }[]): Promise<boolean> {
    const git = this.core.git;
    if (!git || !this.core.activeRepoPath) return false;
    validateHash(base);
    
    const gitDir = path.join(this.core.activeRepoPath, '.git');
    const editorScriptPath = path.join(gitDir, 'git-constellation-seq-editor.js');
    const jsonPath = path.join(gitDir, 'git-constellation-rebase.json');
    
    const editorScript = [
      "const fs = require('fs');",
      "const jsonFile = process.env.GIT_CONSTELLATION_REBASE_JSON;",
      "const todoFile = process.argv[2];",
      "if (!jsonFile || !todoFile) { process.exit(1); }",
      "try {",
      "  const actionsStr = fs.readFileSync(jsonFile, 'utf8');",
      "  const actions = JSON.parse(actionsStr);",
      "  let newTodoContent = '';",
      "  for (const item of actions) {",
      "    if (['pick', 'reword', 'edit', 'squash', 'fixup', 'drop'].includes(item.action)) {",
      "      newTodoContent += item.action + ' ' + item.hash + '\\n';",
      "    }",
      "  }",
      "  fs.writeFileSync(todoFile, newTodoContent, 'utf8');",
      "  process.exit(0);",
      "} catch (e) { process.exit(1); }"
    ].join('\\n');

    const msgEditorScriptPath = path.join(gitDir, 'git-constellation-msg-editor.js');
    const msgEditorScript = [
      "const fs = require('fs');",
      "const jsonFile = process.env.GIT_CONSTELLATION_REBASE_JSON;",
      "const commitMsgFile = process.argv[2];",
      "try {",
      "  const actionsStr = fs.readFileSync(jsonFile, 'utf8');",
      "  const actions = JSON.parse(actionsStr);",
      "  const stateFile = jsonFile + '.state';",
      "  let currentIndex = 0;",
      "  if (fs.existsSync(stateFile)) { currentIndex = parseInt(fs.readFileSync(stateFile, 'utf8'), 10); }",
      "  let editAction = null;",
      "  for (let i = currentIndex; i < actions.length; i++) {",
      "    if (actions[i].action === 'reword' || actions[i].action === 'squash') {",
      "      editAction = actions[i];",
      "      currentIndex = i + 1;",
      "      break;",
      "    }",
      "  }",
      "  if (editAction && editAction.message) { fs.writeFileSync(commitMsgFile, editAction.message, 'utf8'); }",
      "  fs.writeFileSync(stateFile, currentIndex.toString(), 'utf8');",
      "  process.exit(0);",
      "} catch (e) { process.exit(1); }"
    ].join('\\n');

    try {
      fs.writeFileSync(editorScriptPath, editorScript, 'utf8');
      fs.writeFileSync(jsonPath, JSON.stringify(actions), 'utf8');
      fs.writeFileSync(msgEditorScriptPath, msgEditorScript, 'utf8');

      const nodeExe = process.execPath;
      
      const env = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        GIT_SEQUENCE_EDITOR: '"' + nodeExe + '" "' + editorScriptPath + '"',
        GIT_EDITOR: '"' + nodeExe + '" "' + msgEditorScriptPath + '"',
        GIT_CONSTELLATION_REBASE_JSON: jsonPath
      };

      // Set environment variables for the git process
      git.env(env as any);
      await git.raw(['rebase', '-i', base]);
      vscode.window.showInformationMessage('Interactive rebase completed successfully.');
      return true;
    } catch (err: any) {
      console.error('Interactive rebase error:', err);
      const rebaseMergeExists = fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'));
      if (rebaseMergeExists) {
        vscode.window.showWarningMessage('Interactive rebase paused (likely due to conflicts or an edit request). Please resolve them in the working directory.');
        return false;
      } else {
        vscode.window.showErrorMessage('Interactive rebase failed: ' + (err.message || err));
        return false;
      }
    } finally {
      if (fs.existsSync(editorScriptPath)) fs.unlinkSync(editorScriptPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      if (fs.existsSync(msgEditorScriptPath)) fs.unlinkSync(msgEditorScriptPath);
      if (fs.existsSync(jsonPath + '.state')) fs.unlinkSync(jsonPath + '.state');
      
      git.env(process.env as any);
    }
  }
}
