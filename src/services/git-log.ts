import { GitCoreService } from './git-core';
import { validateBranchName, validateFilePath } from '../git-validation';
const FILTER_ALL = 'ALL';

export class GitLogService {
  constructor(private core: GitCoreService) { }

  public async getLog(
    branch: string = FILTER_ALL,
    author: string = FILTER_ALL,
    search: string = '',
    filePath: string = '',
    skip: number = 0,
    maxCount: number = 100
  ): Promise<any | undefined> {
    const git = this.core.git;
    if (!git) {
      console.log('GitLogService: No git instance available');
      return undefined;
    }
    try {
      console.log(`GitLogService: Fetching log with parents for branch/filter: ${branch}...`);

      if (branch !== FILTER_ALL && branch !== 'HEAD' && branch !== '') {
        validateBranchName(branch);
      }
      if (author && author !== FILTER_ALL) {
        if (author.startsWith('-')) {
          throw new Error(`Invalid author: "${author}"`);
        }
      }
      if (search) {
        if (search.startsWith('-')) {
          throw new Error(`Invalid search query: "${search}"`);
        }
      }
      if (filePath) {
        validateFilePath(filePath);
      }

      const formatStr = '--format=%H%x09%P%x09%D%x09%B%x09%an%x09%ae%x09%at%x00';
      const parseCommits = (rawResult: string) => {
        const entries = rawResult.split('\0');
        return entries.map(entry => entry.trim()).filter(Boolean).map(entry => {
          const parts = entry.split('\t');
          const hash = parts[0] || '';
          const parents = parts[1] || '';
          const refs = parts[2] || '';
          const date = parts.length >= 7 ? parts[parts.length - 1] : '';
          const email = parts.length >= 7 ? parts[parts.length - 2] : '';
          const author = parts.length >= 7 ? parts[parts.length - 3] : '';
          const message = parts.length >= 7 ? parts.slice(3, parts.length - 3).join('\t') : '';
          return {
            hash,
            parents: parents ? parents.split(' ') : [],
            refs: refs || '',
            message: message || '',
            author_name: author || '',
            author_email: email || '',
            date: date || ''
          };
        });
      };

      let refsToFetch = [branch];
      if (branch && branch !== FILTER_ALL) {
        try {
          let localBranchName = branch;
          if (branch === 'HEAD') {
            localBranchName = (await git.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
          }
          if (localBranchName && localBranchName !== 'HEAD') {
            const upstream = (await git.raw(['rev-parse', '--abbrev-ref', `${localBranchName}@{upstream}`])).trim();
            if (upstream) {
              validateBranchName(upstream);
              const behindCountStr = await git.raw(['rev-list', '--count', `${localBranchName}..${upstream}`]);
              const behindCount = parseInt(behindCountStr.trim(), 10);
              if (!isNaN(behindCount) && behindCount > 0) {
                refsToFetch.push(upstream);
              }
            }
          }
        } catch (e) {
          // ignore if no upstream or detached HEAD
        }
      }

      const args = [
        'log'
      ];
      if (skip > 0) {
        args.push(`--skip=${skip}`);
      }
      if (maxCount > 0) {
        args.push(`--max-count=${maxCount}`);
      }
      if (branch === FILTER_ALL) {
        args.push('--all');
      } else if (branch === 'HEAD') {
        args.push(...refsToFetch);
      } else if (branch) {
        args.push(...refsToFetch);
      } else {
        args.push('--all');
      }

      if (author && author !== FILTER_ALL) {
        args.push(`--author=${author}`);
      }

      if (search) {
        args.push(`--grep=${search}`, '-i');
      }

      args.push(formatStr);

      if (filePath) {
        args.push('--', filePath);
      }

      const result = await git.raw(args);
      const commits = parseCommits(result);

      if (search && /^[a-fA-F0-9]{4,40}$/.test(search)) {
        try {
          const hashResult = await git.raw(['log', '-1', formatStr, search]);
          if (hashResult.trim()) {
            const hashCommits = parseCommits(hashResult);
            if (hashCommits.length > 0 && !commits.some(c => c.hash === hashCommits[0].hash)) {
              commits.unshift(hashCommits[0]);
            }
          }
        } catch {
          // ignore if hash not found
        }
      }

      console.log(`GitLogService: Found ${commits.length} commits`);
      return { all: commits };
    } catch (err) {
      console.error('Error fetching git log:', err);
      return undefined;
    }
  }

  public async getAuthors(): Promise<string[]> {
    const git = this.core.git;
    if (!git) return [];
    try {
      const result = await git.raw(['log', '--format=%an', '-n', '1000']);
      const authors = result.trim().split('\n').filter(Boolean);
      return Array.from(new Set(authors)).sort();
    } catch {
      return [];
    }
  }

  public async getTags(): Promise<string[]> {
    const git = this.core.git;
    if (!git) return [];
    try {
      const result = await git.raw(['tag']);
      return result.trim().split('\n').filter(Boolean);
    } catch (err) {
      console.error('Error fetching git tags:', err);
      return [];
    }
  }

  public async getCurrentUser(): Promise<{ name: string, email: string } | null> {
    const git = this.core.git;
    if (!git) return null;
    try {
      const name = await git.getConfig('user.name');
      const email = await git.getConfig('user.email');
      return { name: name.value || '', email: email.value || '' };
    } catch {
      return null;
    }
  }
}
