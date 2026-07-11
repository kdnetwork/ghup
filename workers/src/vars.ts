import { RepoItem } from './utils/rule'

export const ReleaseListCacheMaxAge = 60 * 60 // 1 hour
export const ReleaseInfoCacheMaxAge = 60 * 60 * 24 * 180 // 180 days

export interface apiVar {
  Variables: {
    repo: RepoItem
  }
}
