import { Hono } from 'hono'
import { apiVar, ReleaseInfoCacheMaxAge, ReleaseListCacheMaxAge } from '../vars'
import { env } from 'cloudflare:workers'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ApplyRule, ReplaceValue } from '../utils/rule'
import { SafeHeader } from '../utils/github'
import { cors } from 'hono/cors'

const apiHandle = new Hono<apiVar>()

apiHandle.use('*', cors())

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

    return c.json(
      JSON.parse(body).slice(0, count),
      upstream.status as ContentfulStatusCode,
      {
        'x-cache': 'MISS',
        'content-type': 'application/json; charset=utf-8',
      },
    )
  } else {
    return c.json([], upstream.status as ContentfulStatusCode, {
      'x-cache': 'MISS',
      'content-type': 'application/json; charset=utf-8',
    })
  }
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

apiHandle.get('/releases/assets/:asset_id', async (c) => {
  const repo = c.get('repo')

  if (repo?.rules?.releases?.verify) {
    if (!ApplyRule(repo.rules.releases.verify, c)) {
      return c.text('', 404)
    }
  }

  const { asset_id } = c.req.param()
  if (!asset_id || !/^[1-9][0-9]*$/g.test(asset_id)) {
    return c.text('', 404)
  }

  // // https://api.github.com/repos/OWNER/REPO/releases/assets/ASSET_ID
  const assetURL = `https://api.github.com/repos/${repo.namespace}/releases/assets/${asset_id}`

  const accept = 'application/octet-stream' //c.req.header('accept') || 'application/octet-stream'

  const isAsset = accept === 'application/octet-stream'

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept,

      ...(repo.access_token &&
      (isAsset ? repo.rules?.releases?.auth : repo.rules?.api?.auth)
        ? { Authorization: 'Bearer ' + repo.access_token }
        : {}),
    },
    method: 'get',
    redirect: 'follow',
  })

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    return c.newResponse(
      upstream.body,
      upstream.status as ContentfulStatusCode,
      Object.fromEntries(SafeHeader(upstream.headers).entries()),
    )
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

apiHandle.get('/:archiveType{zipball|tarball}/:archiveTag', async (c) => {
  const repo = c.get('repo')

  const { archiveType, archiveTag } = c.req.param()

  if (repo?.rules?.archive?.verify) {
    if (!ApplyRule(repo.rules.archive.verify, c)) {
      return c.text('', 404)
    }
  }

  // 6 https://api.github.com/repos/{name}/{repo}/tarball/{tag|branch}
  // 7 https://api.github.com/repos/{name}/{repo}/zipball/{tag|branch}

  const assetURL = `https://api.github.com/repos/${repo.namespace}/${archiveType}/${archiveTag}`

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept: c.req.header('accept') || '*/*',

      ...(repo.access_token && repo.rules?.archive?.auth
        ? { Authorization: 'Bearer ' + repo.access_token }
        : {}),
    },
    method: 'get',
    redirect: 'follow',
  })

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    return c.newResponse(
      upstream.body,
      upstream.status as ContentfulStatusCode,
      Object.fromEntries(SafeHeader(upstream.headers).entries()),
    )
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

export default apiHandle
