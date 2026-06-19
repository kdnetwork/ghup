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

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    return c.newResponse(
      upstream.body,
      upstream.status as ContentfulStatusCode,
      Object.fromEntries(upstream.headers.entries()),
    )
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

release.get('/assets/:asset_id', async (c) => {
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

  const upstream = await fetch(assetURL, {
    headers: {
      'user-agent': c.req.header('user-agent') || '',
      range: c.req.header('range') || '',
      accept: 'application/octet-stream',

      ...(repo.access_token && repo.rules?.api?.auth
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
      Object.fromEntries(upstream.headers.entries()),
    )
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

const archive = new Hono<apiVar>()

archive.get('/:archive{archive|zipball|tarball}/:path{.*}', async (c) => {
  const repo = c.get('repo')

  const { archive, path } = c.req.param()

  if (repo?.rules?.archive?.verify) {
    if (!ApplyRule(repo.rules.archive.verify, c)) {
      return c.text('', 404)
    }
  }

  const fileName = (path || '').trim()

  const archiveObject = {
    type: 'zipball',
    tag: repo.default_branch || 'main',
  }

  if (archive === 'archive') {
    archiveObject.type = fileName.endsWith('.tar.gz') ? 'tarball' : 'zipball'
    archiveObject.tag = fileName
      .replace('refs/heads/', '')
      .replace('refs/tags/', '')
      .replace('.zip', '')
      .replace('.tar.gz', '')
  } else {
    archiveObject.type = archive === 'tarball' ? 'tarball' : 'zipball'
    archiveObject.tag = fileName.replace('.zip', '').replace('.tar.gz', '')
  }

  // 1 https://github.com/{name}/{repo}/    archive/    refs/heads/master.zip
  // 2 https://github.com/{name}/{repo}/    archive/    refs/heads/{branch}.zip
  // 3 https://github.com/{name}/{repo}/    archive/    {tag}.zip->to7 by replace()
  // 4 https://github.com/{name}/{repo}/    archive/    refs/tags/{tag}.zip->to7 by replace()
  // 5 https://github.com/{name}/{repo}/    archive/    refs/tags/{tag}.tar.gz->to6 by replace()
  //
  // 6 https://api.github.com/repos/{name}/{repo}/tarball/{tag}
  // 7 https://api.github.com/repos/{name}/{repo}/zipball/{tag}
  // 8 https://codeload.github.com/{name}/{repo}/legacy.tar.gz/refs/tags/{tag}->not yet support
  // 9 https://codeload.github.com/{name}/{repo}/zip/refs/heads/master->to1 by replace()

  const assetURL = `https://api.github.com/repos/${repo.namespace}/${archiveObject.type}/${archiveObject.tag}`

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

  const accepted = upstream.status >= 200 && upstream.status < 300

  if (accepted) {
    return c.newResponse(
      upstream.body,
      upstream.status as ContentfulStatusCode,
      Object.fromEntries(upstream.headers.entries()),
    )
  } else {
    return c.text('', upstream.status as ContentfulStatusCode)
  }
})

export { release, archive }
