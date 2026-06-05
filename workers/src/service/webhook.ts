import { Hono } from "hono"
import { apiVar, ReleaseInfoCacheMaxAge } from "../vars"
import { env } from "cloudflare:workers"
import { VerifySignature } from "../utils/github"
import { ReplaceValue } from "../utils/rule"

const webhook = new Hono<apiVar>()

webhook.get("/:hook_type", async (c) => {
  const repo = c.get("repo")
  const hook_type = c.req.param("hook_type") || ""

  if (hook_type === "github-release") {
    if (c.req.method !== "POST") {
      return c.text("", 405)
    }

    const secret = repo.webhook?.secret || ""
    if (!secret) {
      return c.text("", 500)
    }

    // GitHub Headers
    const signature256 = c.req.header("x-hub-signature-256")
    const event = c.req.header("x-github-event")

    if (!signature256) {
      return c.text("", 401)
    }

    const rawBody = await c.req.text()

    const valid = await VerifySignature(secret, signature256, rawBody)

    if (!valid) {
      return c.text("", 401)
    }

    if (event === "release") {
      try {
        let payload = JSON.parse(rawBody)

        // get tag-name
        const tagName = payload?.release?.tag_name
        if (tagName) {
          const cacheKey = repo.namespace + ":tag:" + tagName

          if (["deleted", "unpublished"].includes(payload.action)) {
            c.executionCtx.waitUntil(env.KV.delete(cacheKey))
          } else {
            let body = JSON.stringify(payload.release)

            if (repo.rules?.api?.replace) {
              body = ReplaceValue(repo.rules.api.replace, body)
            }
            c.executionCtx.waitUntil(
              env.KV.put(cacheKey, body, {
                expirationTtl: ReleaseInfoCacheMaxAge,
              }),
            )
          }
        }
      } catch {
        return c.text("", 400)
      }
    }

    return c.text("", 200)
  }

  return c.text("", 404)
})

export default webhook
