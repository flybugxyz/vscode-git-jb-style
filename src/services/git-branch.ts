import { GitCoreService } from './git-core';
import { validateBranchName, validateHash } from '../git-validation';
import * as vscode from 'vscode';

export class GitBranchService {
  constructor(private core: GitCoreService) {}

  public async getBranches() {
    const git = this.core.git;
    if (!git) return undefined;
    try {
      return await git.branch(['-a']);
    } catch (err) {
      console.error('Error fetching git branches:', err);
      return undefined;
    }
  }

  public async checkout(branch: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(branch);
    try {
      await git.checkout(branch);
    } catch (err) {
      vscode.window.showErrorMessage(`Checkout failed: ${err}`);
    }
  }

  public async createBranch(name: string, hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(name);
    validateHash(hash);
    try {
      await git.checkout(['-b', name, hash]);
      vscode.window.showInformationMessage(`Branch '${name}' created at commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create branch: ${err}`);
    }
  }

  public async createTag(name: string, hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(name);
    validateHash(hash);
    try {
      await git.tag([name, hash]);
      vscode.window.showInformationMessage(`Tag '${name}' created at commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create tag: ${err}`);
    }
  }

  public async rebase(hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(hash);
    try {
      await git.rebase([hash]);
      vscode.window.showInformationMessage(`Successfully rebased current branch onto ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Rebase failed: ${err}`);
    }
  }

  public async merge(hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(hash);
    try {
      await git.merge([hash]);
      vscode.window.showInformationMessage(`Successfully merged commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Merge failed: ${err}`);
    }
  }

  public async predictConflicts(targetRef: string): Promise<string[]> {
    const git = this.core.git;
    if (!git) return [];
    try {
      // merge-tree --write-tree computes the merge in memory. 
      // If successful (no conflicts), exit code is 0.
      await git.raw(['merge-tree', '--write-tree', 'HEAD', targetRef]);
      return [];
    } catch (err: any) {
      // If there are conflicts, exit code is non-zero (usually 1).
      // The output containing the conflict details is inside the error message.
      const output = typeof err === 'string' ? err : (err.message || '');
      const conflictFiles = new Set<string>();
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('CONFLICT') && line.includes('in ')) {
          const match = line.match(/in (.+)$/);
          if (match && match[1]) {
            conflictFiles.add(match[1].trim());
          }
        }
      }
      return Array.from(conflictFiles);
    }
  }

  public async createBranchFrom(newName: string, startPoint: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(newName);
    validateBranchName(startPoint);
    try {
      await git.checkout(['-b', newName, startPoint]);
      vscode.window.showInformationMessage(`Branch '${newName}' created from '${startPoint}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create branch: ${err}`);
    }
  }

  public async pullBranch(branchName: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(branchName);
    try {
      const cleanBranch = branchName.replace(/^remotes\/[^\/]+\//, '');
      await git.pull('origin', cleanBranch);
      vscode.window.showInformationMessage(`Pulled branch '${cleanBranch}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Pull failed: ${err}`);
    }
  }

  public async pushBranch(branchName: string, remote: string = 'origin') {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(branchName);
    validateBranchName(remote);
    try {
      const cleanBranch = branchName.replace(/^remotes\/[^\/]+\//, '');
      await git.push(remote, cleanBranch);
      vscode.window.showInformationMessage(`Pushed branch '${cleanBranch}' to remote '${remote}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Push failed: ${err}`);
    }
  }

  public async renameBranch(oldName: string, newName: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(oldName);
    validateBranchName(newName);
    try {
      await git.branch(['-m', oldName, newName]);
      vscode.window.showInformationMessage(`Renamed branch from '${oldName}' to '${newName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Rename failed: ${err}`);
    }
  }

  public async deleteBranch(branchName: string, isRemote: boolean) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(branchName);
    try {
      if (isRemote) {
        const parts = branchName.replace(/^remotes\//, '').split('/');
        const remoteName = parts[0];
        const remoteBranch = parts.slice(1).join('/');
        await git.push(remoteName, remoteBranch, ['--delete']);
        vscode.window.showInformationMessage(`Deleted remote branch '${remoteBranch}' from remote '${remoteName}'.`);
      } else {
        await git.branch(['-D', branchName]);
        vscode.window.showInformationMessage(`Deleted local branch '${branchName}'.`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Delete failed: ${err}`);
    }
  }

  public async setUpstream(branchName: string, upstreamName: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(branchName);
    validateBranchName(upstreamName);
    try {
      await git.branch([`--set-upstream-to=${upstreamName}`, branchName]);
      vscode.window.showInformationMessage(`Set upstream of '${branchName}' to '${upstreamName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to set upstream: ${err}`);
    }
  }

  public async deleteTag(tagName: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(tagName);
    try {
      await git.tag(['-d', tagName]);
      vscode.window.showInformationMessage(`Deleted local tag '${tagName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to delete tag: ${err}`);
    }
  }

  public async deleteRemoteTag(tagName: string) {
    const git = this.core.git;
    if (!git) return;
    validateBranchName(tagName);
    try {
      await git.push('origin', tagName, ['--delete']);
      vscode.window.showInformationMessage(`Deleted remote tag '${tagName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to delete remote tag: ${err}`);
    }
  }

  public async getTagDetails(tagName: string): Promise<string> {
    const git = this.core.git;
    if (!git) return '';
    validateBranchName(tagName);
    try {
      return await git.show([tagName]);
    } catch (err: any) {
      console.error('Error fetching tag details:', err);
      return '';
    }
  }
}

