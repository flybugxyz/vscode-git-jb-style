import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../git';
import { IGitJBViewProvider, WebviewMessage } from './base-handler';

export async function handleCommitMessage(
  data: WebviewMessage,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  switch (data.type) {
    case 'commit':
      await gitService.commit(data.message, data.files);
      provider.refresh();
      return true;

    case 'commitAndPush': {
      const commitSuccess = await gitService.commit(data.message, data.files);
      if (commitSuccess) {
        await gitService.push(data.force);
      }
      provider.refresh();
      return true;
    }

    case 'cherryPick':
      await gitService.cherryPick(data.hash);
      provider.refresh();
      return true;

    case 'cherryPickMultiple':
      await gitService.cherryPickMultiple(data.hashes);
      provider.refresh();
      return true;

    case 'squashCommits': {
      const validation = await gitService.validateSquash(data.hashes);
      if (!validation.valid) {
        vscode.window.showErrorMessage(`Cannot squash: ${validation.reason}`);
        return true;
      }
      
      const rawMessages = await gitService.getCommitMessages(data.hashes);
      const defaultMessage = rawMessages.filter(Boolean).join('\n\n');
      
      const commitMessage = await vscode.window.showInputBox({
        prompt: 'Enter commit message for the squashed commit',
        value: defaultMessage,
        placeHolder: 'Commit message',
        ignoreFocusOut: true
      });
      
      if (commitMessage === undefined) {
        return true;
      }
      
      const finalMessage = commitMessage.trim();
      if (!finalMessage) {
        vscode.window.showErrorMessage('Commit message cannot be empty.');
        return true;
      }
      
      const success = await gitService.squashCommits(data.hashes, finalMessage);
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'squashCommitsSubmit': {
      const success = await gitService.squashCommits(data.hashes, data.message);
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'rewordCommit': {
      const rawMessages = await gitService.getCommitMessages([data.hash]);
      const currentMessage = rawMessages[0] || '';
      
      const commitMessage = await vscode.window.showInputBox({
        prompt: `Edit commit message for ${data.hash.substring(0, 7)}`,
        value: currentMessage,
        placeHolder: 'Commit message',
        ignoreFocusOut: true
      });
      
      if (commitMessage === undefined) {
        return true;
      }
      
      const finalMessage = commitMessage.trim();
      if (!finalMessage) {
        vscode.window.showErrorMessage('Commit message cannot be empty.');
        return true;
      }
      
      if (finalMessage === currentMessage.trim()) {
        return true;
      }
      
      const success = await gitService.rewordCommit(data.hash, finalMessage);
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'rewordCommitSubmit': {
      const finalMessage = data.message.trim();
      if (!finalMessage) {
        vscode.window.showErrorMessage('Commit message cannot be empty.');
        return true;
      }
      
      const success = await gitService.rewordCommit(data.hash, finalMessage);
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'revertCommit':
      await gitService.revertCommit(data.hash);
      provider.refresh();
      return true;

    case 'interactiveRebase': {
      const success = await gitService.interactiveRebase(data.base, data.actions);
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'continueRebase': {
      const success = await gitService.continueRebase();
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'abortRebase': {
      const success = await gitService.abortRebase();
      if (success) {
        provider.refresh();
      }
      return true;
    }

    case 'copySHA':
      await vscode.env.clipboard.writeText(data.hash);
      vscode.window.showInformationMessage('SHA copied to clipboard');
      return true;

    case 'copyShortSHA':
      await vscode.env.clipboard.writeText(data.hash.substring(0, 7));
      vscode.window.showInformationMessage('Short SHA copied to clipboard');
      return true;

    case 'copyMessage':
      await vscode.env.clipboard.writeText(data.message);
      vscode.window.showInformationMessage('Commit message copied to clipboard');
      return true;

    case 'copyURL': {
      const url = await gitService.getCommitUrl(data.hash);
      if (url) {
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage('Commit URL copied to clipboard');
      } else {
        vscode.window.showErrorMessage('Failed to resolve remote commit URL');
      }
      return true;
    }

    case 'getDiff': {
      const files = await gitService.getCommitFiles(data.hash);
      webview.postMessage({ type: 'files', hash: data.hash, files });
      return true;
    }

    case 'viewDiff': {
      const uri = vscode.Uri.parse(`git-constellation-diff:${data.hash}.diff`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
      return true;
    }

    case 'openDiff': {
      const { hash, path: filePath, isCompare } = data;
      if (hash) {
        if (isCompare) {
          const leftUri = vscode.Uri.parse(`git-constellation-show:HEAD/${filePath}`);
          const rightUri = vscode.Uri.parse(`git-constellation-show:${hash}/${filePath}`);
          vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filePath} (HEAD vs ${hash.substring(0, 7)})`);
        } else {
          const parentHash = await gitService.getParentHash(hash);
          const leftUri = vscode.Uri.parse(`git-constellation-show:${parentHash || ''}/${filePath}`);
          const rightUri = vscode.Uri.parse(`git-constellation-show:${hash}/${filePath}`);
          vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filePath} (${hash.substring(0, 7)})`);
        }
      } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
          const leftUri = vscode.Uri.parse(`git-constellation-show:HEAD/${filePath}`);
          const rightUri = vscode.Uri.file(path.join(workspaceRoot, filePath));
          vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filePath} (Local Changes)`);
        }
      }
      return true;
    }

    case 'openFile': {
      const { path: filePath } = data;
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        const fileUri = vscode.Uri.file(path.join(workspaceRoot, filePath));
        try {
          const doc = await vscode.workspace.openTextDocument(fileUri);
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to open file: ${e.message}`);
        }
      }
      return true;
    }
  }

  return false;
}
