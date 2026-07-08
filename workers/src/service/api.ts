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
      'cache-control':
        'public, max-age=' +
        ReleaseListCacheMaxAge +
        ', stale-while-revalidate=60',
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
    let releases = JSON.parse(body)
    if (Array.isArray(releases)) {
      releases.sort((a: any, b: any) => {
        return b.id - a.id
      })
    }

    c.executionCtx.waitUntil(
      env.KV.put(cacheKey, JSON.stringify(releases), {
        expirationTtl: ReleaseListCacheMaxAge,
      }),
    )

    return c.json(
      releases.slice(0, count),
      upstream.status as ContentfulStatusCode,
      {
        ...Object.fromEntries(SafeHeader(upstream.headers).entries()),
        ...{
          'cache-control':
            'public, max-age=' +
            ReleaseListCacheMaxAge +
            ', stale-while-revalidate=60',
          'x-cache': 'MISS',
        },
      },
    )
  } else {
    return c.json([], upstream.status as ContentfulStatusCode, {
      ...Object.fromEntries(SafeHeader(upstream.headers).entries()),
      ...{
        'cache-control':
          'public, max-age=' +
          ReleaseListCacheMaxAge +
          ', stale-while-revalidate=60',
        'x-cache': 'MISS',
      },
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
    ...Object.fromEntries(SafeHeader(upstream.headers).entries()),
    ...{
      'cache-control':
        'public, max-age=' +
        ReleaseInfoCacheMaxAge +
        ', stale-while-revalidate=60',
      'x-cache': 'MISS',
    },
  })
})

apiHandle.get('/releases/assets/:asset_id', async (c) => {
  const repo = c.get('repo')
  const cache = caches.default

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
  let assetURL = `https://api.github.com/repos/${repo.namespace}/releases/assets/${asset_id}`
  const cacheKey = assetURL + '#cache-key'

  const accept = 'application/octet-stream' //c.req.header('accept') || 'application/octet-stream'

  const isAsset = accept === 'application/octet-stream'
  let cached = false

  // file mode
  if (isAsset) {
    try {
      const cachedAssetURL = await cache.match(cacheKey)
      if (cachedAssetURL) {
        assetURL = await cachedAssetURL.text()
        cached = true
      }
    } catch {}
  }

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept,

      ...(!cached &&
      repo.access_token &&
      (isAsset ? repo.rules?.releases?.auth : repo.rules?.api?.auth)
        ? { Authorization: 'Bearer ' + repo.access_token }
        : {}),
    },
    method: 'get',
    redirect: 'follow',
  })

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    if (!cached && isAsset) {
      try {
        const parsedURL = new URL(upstream.url)

        // parse jwt
        const jwtData = JSON.parse(
          atob(
            ((parsedURL.searchParams.get('jwt') || '').split('.')?.[1] || '')
              .replaceAll('_', '/')
              .replaceAll('-', '+'),
          ),
        )

        c.executionCtx.waitUntil(
          cache.put(
            cacheKey,
            new Response(upstream.url, {
              headers: {
                'Cache-Control':
                  'max-age=' +
                  Math.max(
                    0,
                    (jwtData.exp ?? 0) - Math.floor(Date.now() / 1000) - 10,
                  ), // 5mins
              },
            }),
          ),
        )
      } catch {}
    }

    return c.newResponse(
      upstream.body,
      upstream.status as ContentfulStatusCode,
      {
        ...Object.fromEntries(SafeHeader(upstream.headers).entries()),
        ...{ 'x-link-cache': cached ? 'HIT' : 'MISS' },
      },
    )
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

apiHandle.get('/:archiveType{zipball|tarball}/:archiveTag', async (c) => {
  const repo = c.get('repo')
  const cache = caches.default

  const { archiveType, archiveTag } = c.req.param()

  if (repo?.rules?.archive?.verify) {
    if (!ApplyRule(repo.rules.archive.verify, c)) {
      return c.text('', 404)
    }
  }

  // 6 https://api.github.com/repos/{name}/{repo}/tarball/{tag|branch}
  // 7 https://api.github.com/repos/{name}/{repo}/zipball/{tag|branch}

  let assetURL = `https://api.github.com/repos/${repo.namespace}/${archiveType}/${archiveTag}`
  const cacheKey = assetURL
  let cached = false
  const privateRepo = repo.access_token && repo.rules?.archive?.auth

  try {
    const cachedAssetURL = await cache.match(assetURL)
    if (cachedAssetURL) {
      assetURL = await cachedAssetURL.text()
      cached = true
    }
  } catch {}

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept: c.req.header('accept') || '*/*',

      ...(privateRepo ? { Authorization: 'Bearer ' + repo.access_token } : {}),
    },
    method: 'get',
    redirect: 'follow',
  })

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    if (!cached) {
      c.executionCtx.waitUntil(
        cache.put(
          cacheKey,
          new Response(upstream.url, {
            headers: {
              'Cache-Control': 'max-age=290', // 5mins
            },
          }),
        ),
      )
    }

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
