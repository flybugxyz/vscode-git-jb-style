import { GitCoreService, RepositoryInfo } from './services/git-core';
import { GitLogService } from './services/git-log';
import { GitStashService } from './services/git-stash';
import { GitBranchService } from './services/git-branch';
import { GitDiffService } from './services/git-diff';
import { GitWorktreeService } from './services/git-worktree';
import { GitOpsService } from './services/git-ops';

export { validateBranchName, validateHash, validateFilePath, validateStashRef } from './git-validation';
export { RepositoryInfo };

export class GitService {
  private _core: GitCoreService;
  private _log: GitLogService;
  private _stash: GitStashService;
  private _branch: GitBranchService;
  private _diff: GitDiffService;
  private _worktree: GitWorktreeService;
  private _ops: GitOpsService;

  constructor() {
    this._core = new GitCoreService();
    this._log = new GitLogService(this._core);
    this._stash = new GitStashService(this._core);
    this._branch = new GitBranchService(this._core);
    this._diff = new GitDiffService(this._core);
    this._worktree = new GitWorktreeService(this._core);
    this._ops = new GitOpsService(this._core);
  }

  public get git() {
    return this._core.git;
  }

  // GitCore methods
  public get activeRepoPath(): string | undefined {
    return this._core.activeRepoPath;
  }

  public setActiveRepo(path: string) {
    this._core.setActiveRepo(path);
  }

  public getRepositories(): Promise<RepositoryInfo[]> {
    return this._core.getRepositories();
  }

  public getCommitUrl(hash: string): Promise<string | undefined> {
    return this._core.getCommitUrl(hash);
  }

  public getBranchUrl(branch: string): Promise<string | undefined> {
    return this._core.getBranchUrl(branch);
  }

  public getTagUrl(tag: string): Promise<string | undefined> {
    return this._core.getTagUrl(tag);
  }


  // GitLog methods
  public getLog(
    branch: string = 'ALL',
    author: string = 'ALL',
    search: string = '',
    filePath: string = '',
    skip: number = 0,
    maxCount: number = 100
  ): Promise<any | undefined> {
    return this._log.getLog(branch, author, search, filePath, skip, maxCount);
  }

  public getAuthors(): Promise<string[]> {
    return this._log.getAuthors();
  }

  public getTags(): Promise<string[]> {
    return this._log.getTags();
  }

  public getCurrentUser(): Promise<{ name: string, email: string } | null> {
    return this._log.getCurrentUser();
  }

  // GitBranch methods
  public getBranches() {
    return this._branch.getBranches();
  }

  public checkout(branch: string) {
    return this._branch.checkout(branch);
  }

  public createBranch(name: string, hash: string) {
    return this._branch.createBranch(name, hash);
  }

  public createTag(name: string, hash: string) {
    return this._branch.createTag(name, hash);
  }

  public rebase(hash: string) {
    return this._branch.rebase(hash);
  }

  public merge(hash: string) {
    return this._branch.merge(hash);
  }

  public predictConflicts(targetRef: string): Promise<string[]> {
    return this._branch.predictConflicts(targetRef);
  }

  public createBranchFrom(newName: string, startPoint: string) {
    return this._branch.createBranchFrom(newName, startPoint);
  }

  public pullBranch(branchName: string) {
    return this._branch.pullBranch(branchName);
  }

  public pushBranch(branchName: string, remote: string = 'origin') {
    return this._branch.pushBranch(branchName, remote);
  }

  public renameBranch(oldName: string, newName: string) {
    return this._branch.renameBranch(oldName, newName);
  }

  public deleteBranch(branchName: string, isRemote: boolean) {
    return this._branch.deleteBranch(branchName, isRemote);
  }

  public setUpstream(branchName: string, upstreamName: string) {
    return this._branch.setUpstream(branchName, upstreamName);
  }

  public deleteTag(tagName: string) {
    return this._branch.deleteTag(tagName);
  }

  public deleteRemoteTag(tagName: string) {
    return this._branch.deleteRemoteTag(tagName);
  }

  public getTagDetails(tagName: string): Promise<string> {
    return this._branch.getTagDetails(tagName);
  }


  // GitStash methods
  public getStashes(): Promise<{ hash: string, refName: string, message: string, date: string }[]> {
    return this._stash.getStashes();
  }

  public getStashFiles(hash: string) {
    return this._stash.getStashFiles(hash);
  }

  public applyStash(refName: string): Promise<boolean> {
    return this._stash.applyStash(refName);
  }

  public popStash(refName: string): Promise<boolean> {
    return this._stash.popStash(refName);
  }

  public dropStash(refName: string): Promise<boolean> {
    return this._stash.dropStash(refName);
  }

  public clearStashes(): Promise<boolean> {
    return this._stash.clearStashes();
  }

  public createStash(message: string, keepIndex: boolean, includeUntracked: boolean): Promise<boolean> {
    return this._stash.createStash(message, keepIndex, includeUntracked);
  }

  // GitDiff methods
  public getDiffForFiles(files: string[]): Promise<string> {
    return this._diff.getDiffForFiles(files);
  }

  public getCommitFiles(hash: string) {
    return this._diff.getCommitFiles(hash);
  }

  public getFileContent(hash: string, path: string) {
    return this._diff.getFileContent(hash, path);
  }

  public getParentHash(hash: string) {
    return this._diff.getParentHash(hash);
  }

  public getDiff(hash?: string) {
    return this._diff.getDiff(hash);
  }

  public getCompareFiles(hash: string) {
    return this._diff.getCompareFiles(hash);
  }

  public compareBranches(branchA: string, branchB: string) {
    return this._diff.compareBranches(branchA, branchB);
  }

  // GitWorktree methods
  public getWorktrees() {
    return this._worktree.getWorktrees();
  }

  public createWorktree(path: string, hash: string) {
    return this._worktree.createWorktree(path, hash);
  }

  public cherryPickWithWorktree(path: string, branchName: string, hash: string) {
    return this._worktree.cherryPickWithWorktree(path, branchName, hash);
  }

  public removeWorktree(path: string, force: boolean = false): Promise<boolean> {
    return this._worktree.removeWorktree(path, force);
  }

  public pruneWorktrees(): Promise<boolean> {
    return this._worktree.pruneWorktrees();
  }

  // GitOps methods
  public getStatus() {
    return this._ops.getStatus();
  }

  public commit(message: string, files?: string[]) {
    return this._ops.commit(message, files);
  }

  public push(force: boolean = false) {
    return this._ops.push(force);
  }

  public pull() {
    return this._ops.pull();
  }

  public fetch() {
    return this._ops.fetch();
  }

  public discardChanges(filePath: string) {
    return this._ops.discardChanges(filePath);
  }

  public cherryPick(hash: string) {
    return this._ops.cherryPick(hash);
  }

  public cherryPickMultiple(hashes: string[]) {
    return this._ops.cherryPickMultiple(hashes);
  }

  public revertCommit(hash: string) {
    return this._ops.revertCommit(hash);
  }

  public validateSquash(hashes: string[]): Promise<{ valid: boolean; reason?: string }> {
    return this._ops.validateSquash(hashes);
  }

  public squashCommits(hashes: string[], commitMessage: string): Promise<boolean> {
    return this._ops.squashCommits(hashes, commitMessage);
  }

  public interactiveRebase(base: string, actions: { action: string, hash: string, message?: string }[]): Promise<boolean> {
    return this._ops.interactiveRebase(base, actions);
  }

  public continueRebase(): Promise<boolean> {
    return this._ops.continueRebase();
  }

  public abortRebase(): Promise<boolean> {
    return this._ops.abortRebase();
  }

  public isWorkingTreeClean(): Promise<boolean> {
    return this._ops.isWorkingTreeClean();
  }

  public rewordCommit(hash: string, newMessage: string): Promise<boolean> {
    return this._ops.rewordCommit(hash, newMessage);
  }

  public getCommitMessages(hashes: string[]): Promise<string[]> {
    return this._ops.getCommitMessages(hashes);
  }
}
