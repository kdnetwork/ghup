import { Hono } from 'hono'
import { apiVar } from '../vars'
import { ContentfulStatusCode } from 'hono/utils/http-status'
import { ApplyRule } from '../utils/rule'
import { SafeHeader } from '../utils/github'

// public only

const release = new Hono<apiVar>()

release.get('/download/:tag/:file_name', async (c) => {
  const repo = c.get('repo')
  const cache = caches.default

  if (repo?.rules?.releases?.verify) {
    if (!ApplyRule(repo.rules.releases.verify, c)) {
      return c.text('', 404)
    }
  }

  const { tag, file_name } = c.req.param()
  if (!tag || !file_name) {
    return c.text('', 404)
  }

  // https://github.com/{name}/{repo}/releases/download/{tag}/{file}
  let assetURL = `https://github.com/${repo.namespace}/releases/download/${tag}/${file_name}`
  const cacheKey = assetURL + '#cache-key'
  let cached = false

  try {
    const cachedAssetURL = await cache.match(cacheKey)
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
    },
    method: 'get',
    redirect: 'follow',
  })

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    if (!cached) {
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
                  ), // 30mins
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

const archive = new Hono<apiVar>()

archive.get('/:path{(.*)(.zip|.tar.gz)$}', async (c) => {
  const repo = c.get('repo')

  const { path } = c.req.param()

  if (repo?.rules?.archive?.verify) {
    if (!ApplyRule(repo.rules.archive.verify, c)) {
      return c.text('', 404)
    }
  }

  const fileName = (path || '').trim()

  const archiveType = fileName.endsWith('.tar.gz') ? 'tarball' : 'zipball'
  const archiveTag = fileName.replace(
    new RegExp('^(refs/heads/|refs/tags/|)(.*)(.zip|.tar.gz)$', 'gm'),
    `$2`,
  )

  // 1 https://github.com/{name}/{repo}/    archive/    refs/heads/master.zip
  // 2 https://github.com/{name}/{repo}/    archive/    refs/heads/{branch}.zip
  // 3 https://github.com/{name}/{repo}/    archive/    {tag}.zip
  // 4 https://github.com/{name}/{repo}/    archive/    refs/tags/{tag}.zip
  // 5 https://github.com/{name}/{repo}/    archive/    refs/tags/{tag}.tar.gz

  const assetURL = `https://api.github.com/repos/${repo.namespace}/${archiveType}/${archiveTag}`

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept: c.req.header('accept') || '*/*',
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

export { release, archive }
