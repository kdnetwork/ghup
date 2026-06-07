import { Context } from 'hono'
import { apiVar } from '../vars'
import { getConnInfo } from 'hono/cloudflare-workers'
// import { getConnInfo } from '@hono/node-server/conninfo'
// import { getConnInfo } from 'hono/bun'

export interface RepoItem {
  namespace: string
  private?: boolean
  platform: 'github'
  access_token?: string
  rules?: Partial<{
    [p in 'releases' | 'archive' | 'api']: {
      auth?: boolean
      verify?: VerifyRules
      replace?: ReplaceRule[]
    }
  }>
  webhook?: {
    secret: string
  }
}

export interface VerifyRule {
  Field:
    | 'uri'
    | 'uri_full'
    | 'uri_path'
    | 'uri_query_string'
    | 'cookie'
    | 'country'
    | 'host'
    | 'ip'
    | 'referer'
    | 'user_agent'
    | 'x_forwarded_for'
  Operator:
    | '>='
    | '>'
    | '='
    | '<'
    | '<='
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'in'
    | 'regex'
  Not?: boolean
  Value: string
}

export type VerifyRules = (VerifyRule | VerifyRule[])[]

export interface RegexRule {
  Type: 'regex'
  Pattern: string
  Flags?: string
  From?: never
  To: string
}

export interface ReplaceRulex {
  Type: 'replace' | 'replace_all'
  From: string
  To: string
  Pattern?: never
  Flags?: never
}

export type ReplaceRule = RegexRule | ReplaceRulex

export const ApplyRule = (rules: VerifyRules, c: Context<apiVar>): boolean => {
  for (const rule of rules) {
    if (Array.isArray(rule)) {
      if (
        rule.some((r) =>
          RuleOperator(
            r.Operator,
            r.Not || false,
            RuleInput(r.Field, c),
            r.Value,
          ),
        )
      ) {
        continue
      } else {
        return false
      }
    } else {
      if (
        RuleOperator(
          rule.Operator,
          rule.Not || false,
          RuleInput(rule.Field, c),
          rule.Value,
        )
      ) {
        continue
      } else {
        return false
      }
    }
  }

  return true
}

const RuleOperator = (
  Operator: VerifyRule['Operator'],
  Not: boolean,
  InputValue: string,
  Value: string | number,
): boolean => {
  if (typeof Value === 'number') {
    const NumberInputValue = Number(InputValue)
    if (isNaN(NumberInputValue)) {
      return false
    }
    switch (Operator) {
      case '<':
        return Not ? Value < NumberInputValue : NumberInputValue < Value
      case '<=':
        return Not ? Value <= NumberInputValue : NumberInputValue <= Value
      case '=':
        return Not ? Value !== NumberInputValue : NumberInputValue === Value
      case '>':
        return Not ? Value > NumberInputValue : NumberInputValue > Value
      case '>=':
        return Not ? Value >= NumberInputValue : NumberInputValue >= Value
      default:
        return false
    }
  } else {
    switch (Operator) {
      case '<':
        return Not ? Value < InputValue : InputValue < Value
      case '<=':
        return Not ? Value <= InputValue : InputValue <= Value
      case '=':
        return Not ? Value !== InputValue : InputValue === Value
      case '>':
        return Not ? Value > InputValue : InputValue > Value
      case '>=':
        return Not ? Value >= InputValue : InputValue >= Value
      case 'contains':
        return Not ? !InputValue.includes(Value) : InputValue.includes(Value)
      case 'starts_with':
        return Not
          ? !InputValue.startsWith(Value)
          : InputValue.startsWith(Value)
      case 'ends_with':
        return Not ? !InputValue.endsWith(Value) : InputValue.endsWith(Value)
      case 'in':
        return Not
          ? !Value.split(',').includes(InputValue)
          : Value.split(',').includes(InputValue)
      case 'regex':
        try {
          const regex = new RegExp(Value, 'g')
          return Not ? !regex.test(InputValue) : regex.test(InputValue)
        } catch (e) {
          return false
        }
      default:
        return false
    }
  }
}

const RuleInput = (Field: VerifyRule['Field'], c: Context<apiVar>): string => {
  switch (Field) {
    case 'uri':
      return c.req.path
    case 'uri_full':
      return c.req.url
    case 'uri_path':
      return c.req.path
    case 'uri_query_string':
      try {
        return new URL(c.req.url).search.slice(1) || ''
      } catch {
        return ''
      }
    case 'cookie':
      return c.req.header('Cookie') || ''
    case 'country':
      return (
        c.req.raw.cf?.country?.toString() ?? c.req.header('CF-IPCountry') ?? ''
      )
    case 'host':
      return c.req.header('Host') || ''
    case 'ip':
      const conn = getConnInfo(c)
      return conn.remote.address || ''
    case 'referer':
      return c.req.header('Referer') || ''
    case 'user_agent':
      return c.req.header('User-Agent') || ''
    case 'x_forwarded_for':
      return c.req.header('X-Forwarded-For') || ''
    default:
      return ''
  }
}

export const ReplaceValue = (rules: ReplaceRule[], value: string): string => {
  for (const rule of rules) {
    if (rule.Type === 'regex') {
      value = value.replace(new RegExp(rule.Pattern, rule.Flags), rule.To)
    } else {
      if (rule.Type === 'replace_all') {
        value = value.replaceAll(rule.From, rule.To)
      } else {
        value = value.replace(rule.From, rule.To)
      }
    }
  }

  return value
}
