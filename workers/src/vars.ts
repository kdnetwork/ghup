import { RepoItem } from './utils/rule'

export const ReleaseListCacheMaxAge = 60 * 30 // 30 mins
export const ReleaseInfoCacheMaxAge = 60 * 60 * 24 * 180 // 180 days

export interface apiVar {
  Variables: {
    repo: RepoItem
  }
}
