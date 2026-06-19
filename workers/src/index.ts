import { Hono } from 'hono'
// import { showRoutes } from 'hono/dev'
import { env } from 'cloudflare:workers'
import type { apiVar } from './vars'
import apiHandle from './service/api'
import webhook from './service/webhook'
import { archive, release } from './service/download'
import { RepoItem } from './utils/rule'

const prefix = env.SECRET_PATH || ''

const app = new Hono()

const ghup = new Hono<apiVar>()

ghup.use(async (c, next) => {
  const name = c.req.param('name') || ''
  const repo = c.req.param('repo') || ''

  try {
    const repoItem = (JSON.parse(env.REPOS || '[]') as RepoItem[]).find(
      (x) => x.namespace.toLowerCase() === (name + '/' + repo).toLowerCase(),
    )

    if (!repoItem) {
      return c.text('', 404)
    }

    c.set('repo', repoItem)
  } catch {
    return c.text('', 404)
  }

  await next()
})

ghup.route('/releases/', release)

ghup.route('/archive/', archive)

ghup.route('/api/', apiHandle)

ghup.route('/webhook/', webhook)

if (prefix) {
  app.route(`/${prefix}/:name/:repo/`, ghup)
} else {
  app.route(`/:name/:repo/`, ghup)
}

app.get('*', (c) => {
  return c.text('', 404)
})

// showRoutes(app)

export default app
