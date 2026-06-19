# server

use Cloudflare workers

## ⚠️ Warning

**Never** use Cloudflare workers to run **public** GitHub proxy instances

Your domain and Cloudflare account will be **reported and suspended** by relevant individuals or companies

## Vars

| Var         | Default | Description                               |
| :---------- | :------ | :---------------------------------------- |
| SECRET_PATH | `''`    | A path between host and real path         |
| REPOS       | `[]`    | An array json, find more from `~/rule.ts` |

- Domains -> Add Domain -> select a domain -> Route pattern, example:
  - Domain: `example.com`
  - Route pattern: `ghup.example.com/secretpath/*` or `ghup.example.com/secret/path/*` or `*.example.com/secretpath/*`
  - SECRET_PATH: `secretpath` or `secret/path` or `secretpath`
- edit `REPOS` in the [online editor](https://www.typescriptlang.org/play/?#code/PTAEGsBMDsFMBcDuB7ATuYBzAFgVwA6iq4A2sosAHgIYC2+ZAUCKAMbL1nzkBu1qAS2oAjMqAAGqWPmQBncaHjZY0NiQGtwEgEq5o4gDRtk+AJ6LlRWLNLxQAK1nJV1WRJU8AdNoCiABQB5AGVxRj5UKxlZAC5QbWlkAEluWgBtAF1QAF5QVMZQUABvfILQaDprfGpWWFiAcig4JDQMHAI6gxKChmp4ADM0WnrMASVcYQ6u0HxBPm5YvuoSWVhO0tBIWEXbAH1hVGpoVmx62lduVEn14jIYoqmC6nwBWOL19epcJQWllbX3go8WCCPqmWKpN4A0oAMQEsBIkHquBWqB21EwKngVyhBQC+GBvTQ9Vk8H48FkO0Qo2w2JxADUlrhaqAGjAECh0Fg8PgALQETAHTaXB6lAC+6RFoqmUoKUoljHY0CcZE8JGQmAAFHUAMIBPwATR5PIAfAAdaDmuqgADUoAAUkEAgA5TwkwTQEagjVSKIAShtLPN5oAPEbdQa6r7GIwBNALosanEEslYLR7gVyrRKtVmW7Y5gSjMBHNYAB+WLCZDIMiHQskXoDVBDFkjMYTEqbbYkeB7A5HbDlllnEnAq0AHyH1Fj49AeY9JWqNVkFPgyHAKkHc4LBRu1kHfjJQhIwchBVShFjLKkNZWshndX4x2LsHvTwEdXSrxFnyUg8r1dgWsASBEFTEHOlgQEUFdFuEUfXrGpB3iHoahg2AMmlEpRWNEpEFgYRsCrcBB1PWdYFYKR4FiLcsMYKUYzjYEE3ICDQLQ9NQFheFESmCc6lwQQ6l4lkBIEHY+lIEghPWPjRJ2KolGk0pZMEHYAEcmVQUwdi3JSCj49g1zhPTQAM5A9HgLSTL4wiSWslkBHwey6ikPpgVHYT+JRNEMTjZzKHEtBEH4TZIEC4VcXxA5V1QaJPONLJnONZzEs84NnODVKZJZRVSVjO9PJJMkKSpRTPJUSASupZzp08qQMUoJSnWQeA-yrGtoBKBkSCZajLPzOjo3gUx8VAVioNMNC3ByDVxug0hyAnObJoWjJfQwhj4xzJMGvYyEABURuZFzYAapSD3gC5oD691t04+tMFkTd+vnApoVQDhBzgECSn25AboG+jYy2xNkIQ2A0MoDjDvxep4Jze94ZqNESCkkp3o4AHXtAP6sbui6rq+2Afreh6ntib7gUGxhhtGsGc3YnJ4l2hbTKTFCIYWyggA)
