# @vercel/firewall

## Table of contents

### Functions

- [checkRateLimit](README.md#checkratelimit)

## Functions

### checkRateLimit

▸ **checkRateLimit**(`rateLimitId`, `options?`): [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<{ `error?`: `"not-found"` \| `"blocked"` ; `rateLimited`: `boolean` }\>

Check rate-limits defined through the Vercel Firewall.

**`Example`**

```js
import { checkRateLimit } from '@vercel/firewall';

async function handler() {
  const { rateLimited } = await checkRateLimit('my-rate-limit-id');
}
```

#### Parameters

| Name                    | Type                                                                                                                                                                                                                                                            | Description                                                                                                                 |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `rateLimitId`           | `string`                                                                                                                                                                                                                                                        | The ID of the rate limit to check. The same ID must be defined in the Vercel Firewall as a @vercel/firewall rule condition. |
| `options?`              | `Object`                                                                                                                                                                                                                                                        |                                                                                                                             |
| `options.firewallHost?` | `string`                                                                                                                                                                                                                                                        | The host name on which the rate limit rules are defined                                                                     |
| `options.headers?`      | `Headers` \| [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, `string`\> \| [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, `string` \| `string`[]\> | The headers for the current request. Optional if `rateLimitKey` or `request` are provided.                                  |
| `options.rateLimitKey?` | `string`                                                                                                                                                                                                                                                        | The key to use for rate-limiting. If not defined, defaults to the user's IP address.                                        |
| `options.request?`      | `Request`                                                                                                                                                                                                                                                       | The current request object. Optional if `rateLimitKey` or `headers` are provided                                            |

#### Returns

[`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<{ `error?`: `"not-found"` \| `"blocked"` ; `rateLimited`: `boolean` }\>

A promise that resolves to an object with a `rateLimited` property that is `true` if the request is rate-limited, and `false` otherwise. The
`error` property is defined if the request was blocked by the firewall or the rate limit ID was not found.

#### Defined in

rate-limit.ts:20
