export interface SnapshotProtocol {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot {
  as_of: string; source: string; floor_usd: number;
  protocols: SnapshotProtocol[]; watchlist: string[];
}
export interface BoardRow extends SnapshotProtocol {
  rank: number; age_years: number; multiple: number; growth_factor: number;
  age_factor: number; breadth_factor: number; implied_value_usd: number;
  watchlist: boolean; farm_steps: string[];
}

const dateValid = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const nullableNumber = (n: unknown) => n === null || (typeof n === 'number' && Number.isFinite(n));

export function parseSnapshot(text: string): Snapshot {
  let s: Snapshot;
  try { s = JSON.parse(text); } catch { throw new Error('snapshot.json is not JSON'); }
  if (!s || typeof s !== 'object' || !dateValid(s.as_of) || typeof s.source !== 'string' || !Number.isSafeInteger(s.floor_usd) || s.floor_usd <= 0 || !Array.isArray(s.protocols) || !Array.isArray(s.watchlist)) throw new Error('snapshot.json has invalid metadata or arrays');
  const seen = new Set<string>();
  for (const p of s.protocols) {
    if (!p || typeof p.slug !== 'string' || !/^[^\s]{1,128}$/.test(p.slug) || seen.has(p.slug) || typeof p.name !== 'string' || !p.name.trim() || (p.category !== null && typeof p.category !== 'string') || !Array.isArray(p.chains) || p.chains.some(c => typeof c !== 'string') || !Number.isFinite(p.tvl_usd) || p.tvl_usd < 0 || !nullableNumber(p.change_7d) || !nullableNumber(p.mcap_usd) || (p.listed_at !== null && !dateValid(p.listed_at)) || [p.gecko_id, p.symbol].some(v => v !== null && typeof v !== 'string')) throw new Error(`snapshot.json has an invalid or duplicate protocol: ${p?.slug ?? 'unknown'}`);
    seen.add(p.slug);
  }
  if (new Set(s.watchlist).size !== s.watchlist.length || s.watchlist.some(slug => typeof slug !== 'string' || !seen.has(slug))) throw new Error('snapshot.json watchlist contains missing or duplicate slugs');
  return s;
}

function median(values: number[]): number {
  if (!values.length) throw new Error('snapshot has no positive token market-cap/TVL comparables');
  const v = [...values].sort((a, b) => a - b);
  const middle = Math.floor(v.length / 2);
  return v.length % 2 ? v[middle] : (v[middle - 1] + v[middle]) / 2;
}
const preToken = (p: SnapshotProtocol) => p.gecko_id === null && p.symbol === null;
const excluded = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
function eligible(p: SnapshotProtocol): boolean {
  return preToken(p) && !excluded.has(p.category ?? '') && !/\s(?:v\d+(?:\.\d+)*|\d+\.\d+)$/i.test(p.name) && !/\b(?:wrapped|staked|staking)\b/i.test(p.name) && !/^(?:Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name);
}
const slugOrder = (a: SnapshotProtocol, b: SnapshotProtocol) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;

// Actions describe category workflows; eligibility and available products must be checked in the app.
const workflows: Record<string, [string, string, string]> = {
  'Risk Curators': ['deposit into a curator-managed lending vault after comparing collateral limits', 'review the vault allocation and vote on a curator proposal if voting is available', 'redeem a small portion of vault shares'],
  RWA: ['complete eligibility checks and subscribe to an available tokenized asset only if qualified', 'review issuer reports and the asset redemption window', 'request a small redemption through the issuer interface'],
  Lending: ['supply an accepted stablecoin to a lending market with available withdrawal liquidity', 'add a small supply after checking utilization and collateral settings', 'withdraw a small part of the supplied balance'],
  Chain: ['bridge a small supported asset balance through the chain’s official bridge', 'swap a small amount in an established app on the destination chain', 'send a small transfer and bridge back a test amount'],
  Yield: ['deposit into an unleveraged yield vault after reading its strategy', 'review realized yield and add a small deposit if the strategy still fits', 'redeem a small portion of the vault shares'],
  Restaking: ['deposit an accepted asset into a restaking vault after reviewing slashing and withdrawal rules', 'review operator allocations and delegate only where supported', 'start a small withdrawal through the documented queue'],
  Dexs: ['provide balanced liquidity to a liquid stablecoin pair after checking pool fees', 'swap a small amount through the pool and inspect earned fees', 'remove a small part of the liquidity position'],
  Payments: ['fund the payment account with a supported stablecoin', 'make a small payment to another wallet you control and inspect its receipt', 'withdraw the remaining test balance'],
  CDP: ['supply accepted collateral and mint a small stablecoin balance below a conservative loan-to-value limit', 'check collateral health and repay part of the minted balance', 'repay remaining debt before withdrawing collateral'],
  'Onchain Capital Allocator': ['deposit into an allocator vault after reviewing strategy exposures', 'review allocation changes and vote if the vault supports governance', 'redeem a small amount to test exit liquidity'],
  'Basis Trading': ['deposit into an available basis strategy after reviewing funding exposure and custody', 'review the hedge and funding reports without adding leverage', 'redeem a small part of the strategy shares'],
  default: ['inspect the documented product and deposit a small amount into a supported unleveraged pool if available', 'review the position and add a small deposit only if the documented workflow supports it', 'withdraw a small amount through the documented exit flow'],
};
function farmPlan(p: SnapshotProtocol): string[] {
  const chain = p.chains[0] ?? 'the supported main chain';
  const tier = p.tvl_usd >= 1e9 ? 'large' : p.tvl_usd >= 1e8 ? 'established' : 'smaller';
  const capital = tier === 'large' ? 150 : tier === 'established' ? 75 : 25;
  const weeks = tier === 'smaller' ? 2 : 4;
  const gas = chain === 'Ethereum' ? 8 : 2;
  const actions = workflows[p.category ?? 'default'] ?? workflows.default;
  return [
    `Open ${p.name}’s official documentation and verify its ${chain} deployment, supported assets and eligibility. For this ${tier} TVL venue, cap the trial at $${capital}; skip unavailable products. Cost: no capital, gas only ~$0. Time: 15 minutes.`,
    `On ${p.name} on ${chain}, ${actions[0]}. Cost: $${capital} trial capital plus ~$${gas} gas; verify any product minimum before signing. Time: 20 minutes, or defer if eligibility is pending.`,
    `For ${p.name} on ${chain}, ${actions[1]}. Use the existing trial balance and record transaction receipts; no reward is assumed. Cost: $5 from trial capital plus ~$${gas} gas. Time: 10 minutes each week for ${weeks} weeks.`,
    `Monitor ${p.name} on ${chain}: inspect position health, fees and exit terms; keep the trial open only while those terms remain acceptable. Cost: $${capital} stays exposed, gas only ~$0 to inspect. Time: 10 minutes each week for ${weeks} weeks.`,
    `On ${p.name} on ${chain}, ${actions[2]}. Record the exit cost and check the official rewards page for published eligibility; token issuance is uncertain. Cost: existing trial capital plus ~$${gas} gas, product exit fees extra. Time: 20 minutes; allow the documented exit queue in weeks.`,
  ];
}

export function buildRadar(snapshot: Snapshot) {
  const samples = snapshot.protocols.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= 1_000_000);
  const globalMedian = median(samples.map(p => p.mcap_usd! / p.tvl_usd));
  const categorySamples = new Map<string | null, number[]>();
  for (const p of samples) {
    const values = categorySamples.get(p.category) ?? [];
    values.push(p.mcap_usd! / p.tvl_usd);
    categorySamples.set(p.category, values);
  }
  const categoryMultiples = [...new Set(snapshot.protocols.map(p => p.category))].map(category => {
    const values = categorySamples.get(category) ?? [];
    const weight = values.length / (values.length + 4);
    const blended = values.length ? median(values) * weight + globalMedian * (1 - weight) : globalMedian;
    // Cap after blending so a thin category with extreme peers cannot dominate the board.
    return { category, sample_count: values.length, median: values.length ? median(values) : null, multiple: Math.min(blended, 5 * globalMedian) };
  });
  const multiples = new Map(categoryMultiples.map(c => [c.category, c.multiple]));
  const watchlist = new Set(snapshot.watchlist);
  const selected = snapshot.protocols.filter(p => watchlist.has(p.slug));
  const additions = snapshot.protocols.filter(p => !watchlist.has(p.slug) && eligible(p)).sort((a, b) => b.tvl_usd - a.tvl_usd || slugOrder(a, b));
  selected.push(...additions.slice(0, Math.max(0, 220 - selected.length)));
  const board: BoardRow[] = selected.map(p => {
    const age_years = p.listed_at === null ? 1.5 : Math.max(0, (Date.parse(snapshot.as_of) - Date.parse(p.listed_at)) / (365.25 * 86400000));
    const multiple = multiples.get(p.category) ?? globalMedian;
    const growth_factor = 1 + Math.max(-30, Math.min(30, p.change_7d ?? 0)) * 0.015;
    const age_factor = 1 + Math.min(age_years, 5) * 0.06;
    const breadth_factor = 1 + Math.min(p.chains.length - 1, 9) * 0.01;
    return { ...p, rank: 0, age_years, multiple, growth_factor, age_factor, breadth_factor, implied_value_usd: Math.max(1, Math.round(p.tvl_usd * multiple * growth_factor * age_factor * breadth_factor)), watchlist: watchlist.has(p.slug), farm_steps: farmPlan(p) };
  }).sort((a, b) => b.implied_value_usd - a.implied_value_usd || slugOrder(a, b));
  board.forEach((row, index) => { row.rank = index + 1; });
  const radar = {
    as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
    stats: { protocol_count: snapshot.protocols.length, watchlist_count: snapshot.watchlist.length, board_size: board.length, tokenised_count: snapshot.protocols.filter(p => p.mcap_usd !== null).length, total_tvl_covered: board.reduce((sum, p) => sum + p.tvl_usd, 0), median_multiple: globalMedian },
    model: {
      summary: 'A hypothetical token value based on snapshot TVL and token-recording peers, adjusted for seven-day growth, tracked age and chain breadth. Records with no token identifiers are candidates; this is neither a launch prediction nor a reward guarantee.',
      formula: 'max(1, round(TVL × category multiple × growth factor × age factor × breadth factor))',
      components: {
        multiple: 'Median market cap / TVL of token-recording peers with TVL ≥ $1m and positive market cap; category weight n/(n+4), remainder global median. No category peers uses the global median. After blending, a category multiple is capped at 5x the global median so one thin, extreme category cannot dominate the board.',
        growth_factor: '1 + clamp(change_7d, -30, 30) × 0.015; missing growth = 0.',
        age_factor: '1 + min(years tracked, 5) × 0.06; missing listing date = 1.5 years. Years use 365.25 days from snapshot.as_of; future dates clamp to zero.',
        breadth_factor: '1 + min(number of chains - 1, 9) × 0.01.',
      },
      category_multiples: categoryMultiples,
    },
    rows: board,
  };
  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (!Array.isArray(board) || board.length < 100 || board.length > 4000) return 'board must contain 100–4000 rows';
  const valid = new Set(snapshot.protocols.map(p => p.slug));
  const seen = new Set<string>();
  const sorted = [...board].sort((a, b) => a.rank - b.rank);
  for (const [i, row] of sorted.entries()) {
    if (!valid.has(row.slug) || seen.has(row.slug)) return `unknown or duplicate slug: ${row.slug}`;
    seen.add(row.slug);
    if (!row.name?.trim() || row.rank !== i + 1) return `invalid name or rank for ${row.slug}`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd < 1 || row.implied_value_usd > 100_000_000_000_000) return `invalid value for ${row.slug}`;
    if (i && row.implied_value_usd > sorted[i - 1].implied_value_usd) return `value rises at rank ${row.rank}`;
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12 || row.farm_steps.some(s => typeof s !== 'string' || s.trim().length < 20 || s.trim().length > 600)) return `invalid farm steps for ${row.slug}`;
  }
  if (sorted[0].implied_value_usd === sorted.at(-1)!.implied_value_usd) return 'all implied values are equal';
  const missing = snapshot.watchlist.filter(slug => !seen.has(slug));
  return missing.length ? `missing watchlist slugs: ${missing.join(', ')}` : null;
}
export function dataScript(radar: ReturnType<typeof buildRadar>['radar']): string {
  return `window.RADAR = ${JSON.stringify(radar).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};\n`;
}
