import { Hono } from 'hono'
import { apiVar } from '../vars'
import { ContentfulStatusCode } from 'hono/utils/http-status'
import { ApplyRule } from '../utils/rule'

const release = new Hono<apiVar>()

release.get('/download/:tag/:file_name', async (c) => {
  const repo = c.get('repo')

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
  const assetURL = `https://github.com/${repo.namespace}/releases/download/${tag}/${file_name}`

  // const cacheKey = 'asseturl:' + assetPath
  //
  // let cachedURL = await env.KV.get(cacheKey)
  //
  // if (cachedURL) {
  //     assetURL = cachedURL
  // }

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept: c.req.header('accept') || '*/*',

      ...(repo.access_token && repo.rules?.api?.auth
        ? { Authorization: 'Bearer ' + repo.access_token }
        : {}),
    },
    method: 'get',
    redirect: 'follow',
  })

  // if (!cachedURL) {
  //     ctx.waitUntil(
  //         env.KV.put(cacheKey, upstream.url, {
  //             expirationTtl: 60 * 15, // 15 minutes // up to 30 mins
  //         }),
  //     )
  // }

  if (upstream.status === 200) {
    return c.newResponse(upstream.body, 200, { ...upstream.headers })
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

const archive = new Hono<apiVar>()

archive.get('/:path{.*}', async (c) => {
  const repo = c.get('repo')

  if (repo?.rules?.archive?.verify) {
    if (!ApplyRule(repo.rules.archive.verify, c)) {
      return c.text('', 404)
    }
  }

  const fileName = c.req.param('path') || ''

  const splitedPath = fileName.split('/')

  // 1 https://github.com/{name}/{repo}/    archive/    refs/heads/master.zip
  // 2 https://github.com/{name}/{repo}/    archive/    refs/heads/{branch}.zip
  // 3 https://github.com/{name}/{repo}/    archive/    {tag}.zip
  // 4 https://github.com/{name}/{repo}/    archive/    refs/tags/{tag}.zip
  // 5 https://github.com/{name}/{repo}/    archive/    refs/tags/{tag}.tar.gz
  //
  // https://api.github.com/repos/{name}/{repo}/tarball/{tag}->to5 by replace()
  // https://api.github.com/repos/{name}/{repo}/zipball/{tag}->to4 by replace()
  // https://codeload.github.com/{name}/{repo}/legacy.tar.gz/refs/tags/{tag}->not yet support
  // https://codeload.github.com/{name}/{repo}/zip/refs/heads/master->to1 by replace()

  let assetURL = ''
  if (
    (splitedPath.length === 3 &&
      (fileName.startsWith('refs/heads/') ||
        fileName.startsWith('refs/tags/'))) ||
    (splitedPath.length === 1 && /^[0-9a-fA-F]+\.zip$/g.test(fileName))
  ) {
    assetURL = 'https://github.com/' + repo.namespace + '/archive/' + fileName
  } else if (splitedPath.length === 0) {
    assetURL =
      'https://github.com/' + repo.namespace + '/archive/refs/heads/master.zip'
  }

  if (!assetURL) {
    return new Response('', { status: 404 })
  }

  // const cacheKey = 'asseturl:' + assetPath
  //
  // let cachedURL = await env.KV.get(cacheKey)
  //
  // if (cachedURL) {
  //     assetURL = cachedURL
  // }

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept: c.req.header('accept') || '*/*',

      ...(repo.access_token && repo.rules?.api?.auth
        ? { Authorization: 'Bearer ' + repo.access_token }
        : {}),
    },
    method: 'get',
    redirect: 'follow',
  })

  // if (!cachedURL) {
  //     ctx.waitUntil(
  //         env.KV.put(cacheKey, upstream.url, {
  //             expirationTtl: 60 * 15, // 15 minutes // up to 30 mins
  //         }),
  //     )
  // }

  if (upstream.status === 200) {
    return c.newResponse(upstream.body, 200, { ...upstream.headers })
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

export { release, archive }
