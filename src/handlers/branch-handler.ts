import * as vscode from 'vscode';
import { GitService } from '../git';
import { IGitJBViewProvider, WebviewMessage } from './base-handler';

export async function handleBranchMessage(
  data: WebviewMessage,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  switch (data.type) {
    case 'checkoutBranch':
      await gitService.checkout(data.branch);
      provider.refresh();
      return true;

    case 'pullBranch':
      await gitService.pullBranch(data.branch);
      provider.refresh();
      return true;

    case 'pushBranch':
      await gitService.pushBranch(data.branch, 'origin');
      provider.refresh();
      return true;

    case 'pushBranchTo': {
      const remote = await vscode.window.showInputBox({
        prompt: `Push branch '${data.branch}' to remote`,
        value: 'origin',
        placeHolder: 'Enter remote name'
      });
      if (remote && remote.trim()) {
        await gitService.pushBranch(data.branch, remote.trim());
        provider.refresh();
      }
      return true;
    }

    case 'renameBranch': {
      const newName = await vscode.window.showInputBox({
        prompt: `Rename branch '${data.branch}'`,
        value: data.branch,
        placeHolder: 'Enter new branch name'
      });
      if (newName && newName.trim() && newName.trim() !== data.branch) {
        await gitService.renameBranch(data.branch, newName.trim());
        provider.refresh();
      }
      return true;
    }

    case 'deleteBranch': {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete branch '${data.branch}'?`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        await gitService.deleteBranch(data.branch, data.isRemote);
        provider.refresh();
      }
      return true;
    }

    case 'compareBranchWith': {
      const branchesResult = await gitService.getBranches();
      if (branchesResult) {
        const list = branchesResult.all.filter((b: string) => b !== data.branch);
        const otherBranch = await vscode.window.showQuickPick(list, {
          placeHolder: `Select branch to compare with '${data.branch}'`
        });
        if (otherBranch) {
          const compareFiles = await gitService.compareBranches(otherBranch, data.branch);
          webview.postMessage({
            type: 'compareFiles',
            hash: `${data.branch} vs ${otherBranch}`,
            files: compareFiles
          });
        }
      }
      return true;
    }

    case 'setUpstream': {
      const upstream = await vscode.window.showInputBox({
        prompt: `Set Upstream for '${data.branch}'`,
        placeHolder: 'e.g. origin/main'
      });
      if (upstream && upstream.trim()) {
        await gitService.setUpstream(data.branch, upstream.trim());
        provider.refresh();
      }
      return true;
    }

    case 'createBranchFrom': {
      const promptLabel = data.refType === 'commit' ? `commit ${data.ref.substring(0, 7)}` :
        data.refType === 'tag' ? `tag '${data.ref}'` :
          `'${data.ref}'`;
      const branchName = await vscode.window.showInputBox({
        prompt: `Create Branch from ${promptLabel}`,
        placeHolder: 'Enter branch name'
      });
      if (branchName && branchName.trim()) {
        if (data.refType === 'commit') {
          await gitService.createBranch(branchName.trim(), data.ref);
        } else {
          await gitService.createBranchFrom(branchName.trim(), data.ref);
        }
        provider.refresh();
      }
      return true;
    }

    case 'createTag': {
      const tagName = await vscode.window.showInputBox({
        prompt: `Create Tag at commit ${data.hash.substring(0, 7)}`,
        placeHolder: 'Enter tag name'
      });
      if (tagName && tagName.trim()) {
        await gitService.createTag(tagName.trim(), data.hash);
        provider.refresh();
      }
      return true;
    }

    case 'rebaseRef': {
      const conflicts = await gitService.predictConflicts(data.ref);
      if (conflicts.length > 0) {
        const confirm = await vscode.window.showWarningMessage(
          `Prediction: Rebasing will likely result in conflicts in ${conflicts.length} files.\n\nConflicted files:\n${conflicts.slice(0, 5).join('\n')}${conflicts.length > 5 ? '\n...' : ''}\n\nAre you sure you want to proceed and resolve them manually?`,
          { modal: true },
          'Continue Rebase'
        );
        if (confirm !== 'Continue Rebase') {
          return true;
        }
      }
      await gitService.rebase(data.ref);
      provider.refresh();
      return true;
    }

    case 'mergeRef': {
      const conflicts = await gitService.predictConflicts(data.ref);
      if (conflicts.length > 0) {
        const confirm = await vscode.window.showWarningMessage(
          `Prediction: Merging will result in conflicts in ${conflicts.length} files.\n\nConflicted files:\n${conflicts.slice(0, 5).join('\n')}${conflicts.length > 5 ? '\n...' : ''}\n\nAre you sure you want to proceed and resolve them manually?`,
          { modal: true },
          'Continue Merge'
        );
        if (confirm !== 'Continue Merge') {
          return true;
        }
      }
      await gitService.merge(data.ref);
      provider.refresh();
      return true;
    }

    case 'compareRef': {
      const compareFiles = await gitService.getCompareFiles(data.ref);
      webview.postMessage({
        type: 'compareFiles',
        hash: data.ref,
        files: compareFiles
      });
      return true;
    }

    case 'viewTagDetails': {
      const uri = vscode.Uri.parse(`git-constellation-tag:${data.tag}.txt`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
      return true;
    }

    case 'deleteTag': {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete tag '${data.tag}'?`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        await gitService.deleteTag(data.tag);
        const deleteRemote = await vscode.window.showInformationMessage(
          `Do you also want to delete remote tag '${data.tag}' from origin?`,
          'Yes',
          'No'
        );
        if (deleteRemote === 'Yes') {
          await gitService.deleteRemoteTag(data.tag);
        }
        provider.refresh();
      }
      return true;
    }

    case 'copyTagName':
      await vscode.env.clipboard.writeText(data.tag);
      vscode.window.showInformationMessage('Tag name copied to clipboard');
      return true;

    case 'openRefInBrowser': {
      let browserUrl;
      if (data.refType === 'commit') {
        browserUrl = await gitService.getCommitUrl(data.ref);
      } else if (data.refType === 'branch') {
        browserUrl = await gitService.getBranchUrl(data.ref);
      } else if (data.refType === 'tag') {
        browserUrl = await gitService.getTagUrl(data.ref);
      }
      if (browserUrl) {
        vscode.env.openExternal(vscode.Uri.parse(browserUrl));
      } else {
        vscode.window.showErrorMessage(`Failed to resolve remote URL for ${data.refType}`);
      }
      return true;
    }
  }

  return false;
}
