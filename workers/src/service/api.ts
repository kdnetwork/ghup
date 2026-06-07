import { Hono } from 'hono'
import { apiVar, ReleaseInfoCacheMaxAge, ReleaseListCacheMaxAge } from '../vars'
import { env } from 'cloudflare:workers'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ReplaceValue } from '../utils/rule'

const apiHandle = new Hono<apiVar>()

apiHandle.get('/releases', async (c) => {
  const repo = c.get('repo')
  // ReleaseApiBase https://api.github.com/repos/{owner}/{repo}/releases?per_page=<count> // <-
  // see also: https://docs.github.com/zh/rest/releases/releases?apiVersion=2022-11-28#get-a-release

  let count = Number(c.req.query('per_page')) || 6
  if (count > 30) {
    count = 30
  } else if (count < 1) {
    count = 1
  }

  const cacheKey = repo.namespace + ':releaseslist'

  const value = await env.KV.get(cacheKey)
  if (value) {
    return c.json(JSON.parse(value).slice(0, count), 200, {
      'x-cache': 'HIT',
      'content-type': 'application/json; charset=utf-8',
    })
  }

  const upstream = await fetch(
    'https://api.github.com/repos/' +
      repo.namespace +
      '/releases?per_page=' +
      100,
    {
      headers: {
        'user-agent': c.req.header('user-agent') || '',
        range: c.req.header('range') || '',
        accept: c.req.header('accept') || '*/*',

        ...(repo.access_token && repo.rules?.api?.auth
          ? { Authorization: 'Bearer ' + repo.access_token }
          : {}),
      },
      redirect: 'follow',
    },
  )

  let body = await upstream.text()

  if (repo.rules?.api?.replace) {
    body = ReplaceValue(repo.rules.api.replace, body)
  }

  if (upstream.status === 200) {
    c.executionCtx.waitUntil(
      env.KV.put(cacheKey, body, {
        expirationTtl: ReleaseListCacheMaxAge,
      }),
    )
  }

  return c.json(
    JSON.parse(body).slice(0, count),
    upstream.status as ContentfulStatusCode,
    {
      'x-cache': 'MISS',
      'content-type': 'application/json; charset=utf-8',
    },
  )
})

apiHandle.get('/releases/tags/:tag', async (c) => {
  const repo = c.get('repo')
  const tag = c.req.param('tag')

  if (!tag) {
    return c.json({}, 404)
  }

  const cacheKey = repo.namespace + ':tag:' + tag

  const value = await env.KV.get(cacheKey)
  if (value) {
    return c.json(JSON.parse(value), 200, {
      'x-cache': 'HIT',
      'content-type': 'application/json; charset=utf-8',
    })
  }

  const upstream = await fetch(
    'https://api.github.com/repos/' + repo.namespace + '/releases/tags/' + tag,
    {
      headers: {
        'user-agent': c.req.header('user-agent') || '',
        range: c.req.header('range') || '',
        accept: c.req.header('accept') || '*/*',

        ...(repo.access_token && repo.rules?.api?.auth
          ? { Authorization: 'Bearer ' + repo.access_token }
          : {}),
      },
      redirect: 'follow',
    },
  )

  let body = await upstream.text()

  if (repo.rules?.api?.replace) {
    body = ReplaceValue(repo.rules.api.replace, body)
  }

  if (upstream.status === 200) {
    c.executionCtx.waitUntil(
      env.KV.put(cacheKey, body, {
        expirationTtl: ReleaseInfoCacheMaxAge,
      }),
    )
  }

  return c.json(JSON.parse(body), upstream.status as ContentfulStatusCode, {
    'x-cache': 'MISS',
    'content-type': 'application/json; charset=utf-8',
  })
})

export default apiHandle
