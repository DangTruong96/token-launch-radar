'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const radar = window.RADAR;
  if (!radar || !Array.isArray(radar.rows)) {
    $('error').hidden = false;
    $('error').textContent = 'Snapshot unavailable. Keep this dashboard beside its generated ../data.js file.';
    return;
  }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(value);
  const money = value => '$' + (Math.abs(value) >= 1e12 ? (value / 1e12).toFixed(2) + 'T' : Math.abs(value) >= 1e9 ? (value / 1e9).toFixed(2) + 'B' : Math.abs(value) >= 1e6 ? (value / 1e6).toFixed(2) + 'M' : Math.abs(value) >= 1e3 ? (value / 1e3).toFixed(1) + 'K' : num(value));
  const fullMoney = value => '$' + num(value);
  const change = value => value === null ? '—' : (value > 0 ? '+' : '') + value.toFixed(2) + '%';
  const changeClass = value => value === null || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative';
  const category = row => row.category ?? 'Uncategorised';
  const badge = row => row.watchlist ? '<span class="badge">WATCHLIST</span>' : '';
  const rows = radar.rows;
  let sortKey = 'implied_value_usd', direction = -1, limit = 50;
  let filtered = [];
  $('as-of').textContent = radar.as_of;
  $('as-of').dateTime = radar.as_of;
  $('footer-date').textContent = radar.as_of;
  $('board-count').textContent = String(radar.stats.board_size).padStart(3, '0');
  $('stats').innerHTML = [
    ['Protocols scanned', num(radar.stats.protocol_count)],
    ['Watchlist covered', num(radar.stats.watchlist_count)],
    ['Board size', num(radar.stats.board_size)],
    ['Tokenised / set aside', num(radar.stats.tokenised_count)],
    ['Total TVL covered', money(radar.stats.total_tvl_covered)]
  ].map(([label, value]) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`).join('');
  $('factor-rules').innerHTML = Object.entries(radar.model.components).map(([key, value]) => `<p><strong>${esc(key.replaceAll('_', ' '))}:</strong> ${esc(value)}</p>`).join('');
  function options(id, values) {
    for (const value of [...new Set(values)].sort((a, b) => a.localeCompare(b))) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      $(id).append(option);
    }
  }
  options('category', rows.map(category));
  options('chain', rows.flatMap(row => row.chains));
  function render() {
    const query = $('search').value.trim().toLocaleLowerCase();
    filtered = rows.filter(row => row.name.toLocaleLowerCase().includes(query) && (!$('category').value || category(row) === $('category').value) && (!$('chain').value || row.chains.includes($('chain').value)) && (!$('watchlist').checked || row.watchlist));
    filtered.sort((a, b) => {
      // Missing 7-day observations always sit below measured values in either direction.
      if (a[sortKey] === null && b[sortKey] !== null) return 1;
      if (b[sortKey] === null && a[sortKey] !== null) return -1;
      return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * direction || a.rank - b.rank;
    });
    // Render at most 50 initially; each show-more action adds 50 to keep large boards responsive.
    $('rows').innerHTML = filtered.slice(0, limit).map(row => `<tr data-slug="${esc(row.slug)}"><td>${String(row.rank).padStart(2, '0')}</td><td class="protocol"><button type="button" aria-label="Inspect ${esc(row.name)}">${esc(row.name)}</button>${badge(row)}<span class="category-label">${esc(category(row))}</span></td><td class="numeric" title="${esc(row.chains.join(', '))}">${row.chains.length}</td><td class="numeric">${money(row.tvl_usd)}</td><td class="numeric ${changeClass(row.change_7d)}">${change(row.change_7d)}</td><td class="numeric">${row.age_years.toFixed(2)}</td><td class="numeric">${row.multiple.toFixed(2)}×</td><td class="numeric value">${money(row.implied_value_usd)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No protocols match these filters. Try another name or broaden your selection.</td></tr>';
    $('results').textContent = `${num(filtered.length)} matching protocols · ${num(Math.min(limit, filtered.length))} displayed · ranks reflect the original value board`;
    $('show-more').hidden = filtered.length <= limit;
    document.querySelectorAll('th[data-sort]').forEach(th => {
      const active = th.dataset.sort === sortKey;
      if (active) th.setAttribute('aria-sort', direction === -1 ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
      th.querySelector('span').textContent = active ? (direction === -1 ? '↓' : '↑') : '↕';
    });
  }
  ['search', 'category', 'chain', 'watchlist'].forEach(id => $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { limit = 50; render(); }));
  document.querySelectorAll('th[data-sort] button').forEach(button => button.addEventListener('click', () => {
    const key = button.parentElement.dataset.sort;
    direction = key === sortKey ? -direction : -1;
    sortKey = key;
    render();
  }));
  $('show-more').addEventListener('click', () => { limit += 50; render(); });
  let opener;
  function openDetail(row, trigger) {
    opener = trigger;
    const factors = [['TVL', fullMoney(row.tvl_usd)], ['× Category multiple', row.multiple.toFixed(6) + '×'], ['× Growth factor', row.growth_factor.toFixed(6) + '×'], ['× Age factor', row.age_factor.toFixed(6) + '×'], ['× Breadth factor', row.breadth_factor.toFixed(6) + '×'], ['= Implied value', fullMoney(row.implied_value_usd)]];
    $('detail-content').innerHTML = `<h2 id="detail-title">${esc(row.name)}</h2><p class="detail-meta">Rank ${row.rank} · ${esc(category(row))} ${badge(row)}<br>${esc(row.chains.join(' · ') || 'No chains recorded')}<br>Listed: ${esc(row.listed_at ?? 'Unknown; model uses 1.5 years')}</p><div class="detail-value"><span class="eyebrow">Estimated implied value</span><strong>${fullMoney(row.implied_value_usd)}</strong></div><dl class="figures"><div><dt>TVL</dt><dd>${fullMoney(row.tvl_usd)}</dd></div><div><dt>7-day TVL change</dt><dd class="${changeClass(row.change_7d)}">${change(row.change_7d)}</dd></div><div><dt>Tracked age</dt><dd>${row.age_years.toFixed(2)} years</dd></div><div><dt>Chain breadth</dt><dd>${row.chains.length} chains</dd></div></dl><h3>The value breakdown</h3><dl class="breakdown">${factors.map(([label, value], i) => `<div${i === 5 ? ' class="total"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="detail-formula">TVL × multiple × growth × age × breadth = implied value. Factors above are rounded for display; the result uses full precision, rounds to the nearest dollar and has a $1 minimum.</p><h3>Farm plan / numbered workflow</h3><ol>${row.farm_steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol><p class="detail-meta">This entry’s own estimate, not a token launch prediction. Verify current product terms and eligibility before acting.</p>`;
    $('detail').showModal();
    $('detail').scrollTop = 0;
  }
  $('rows').addEventListener('click', event => {
    const tr = event.target.closest('tr[data-slug]');
    if (tr) openDetail(rows.find(row => row.slug === tr.dataset.slug), tr.querySelector('button'));
  });
  $('close-detail').addEventListener('click', () => $('detail').close());
  $('detail').addEventListener('click', event => { if (event.target === $('detail') && event.clientX < $('detail').getBoundingClientRect().left) $('detail').close(); });
  $('detail').addEventListener('close', () => { if (opener && opener.isConnected) opener.focus(); });
  render();
})();
