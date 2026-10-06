import { isIP } from 'node:net';

// Named ranges Express (proxy-addr) understands.
const NAMED_RANGES = new Set(['loopback', 'linklocal', 'uniquelocal']);
const HOP_COUNT_PATTERN = /^\d+$/;
const PREFIX_PATTERN = /^\d+$/;
const MAX_IPV4_PREFIX = 32;
const MAX_IPV6_PREFIX = 128;
const IPV4 = 4;

/** Express `trust proxy` value: a hop count, or the list of trusted proxy addresses/ranges. */
export type TrustProxySetting = number | string[];

/**
 * Parses `TRUST_PROXY` into the value given to Express' `trust proxy` setting, or `null` when it is
 * invalid. Accepted: a hop count (`1`), or a comma-separated list of named ranges (`loopback`,
 * `linklocal`, `uniquelocal`), IPs and CIDRs (`10.0.0.5`, `10.0.0.0/8`). `true`/`*` ("trust any
 * proxy") is rejected on purpose: it lets any client spoof its IP through `X-Forwarded-For`.
 */
export function parseTrustProxy(value: string): TrustProxySetting | null {
  const trimmed = value.trim();
  if (HOP_COUNT_PATTERN.test(trimmed)) {
    return Number(trimmed);
  }
  const entries = trimmed.split(',').map((entry) => entry.trim());
  if (entries.length === 0 || !entries.every(isTrustedProxyEntry)) {
    return null;
  }
  return entries;
}

function isTrustedProxyEntry(entry: string): boolean {
  if (NAMED_RANGES.has(entry)) {
    return true;
  }
  const [address, prefix, ...rest] = entry.split('/');
  const version = isIP(address);
  if (version === 0 || rest.length > 0) {
    return false;
  }
  if (prefix === undefined) {
    return true;
  }
  const maxPrefix = version === IPV4 ? MAX_IPV4_PREFIX : MAX_IPV6_PREFIX;
  return PREFIX_PATTERN.test(prefix) && Number(prefix) <= maxPrefix;
}
