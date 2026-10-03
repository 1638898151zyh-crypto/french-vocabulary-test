(() => {
  'use strict';
  const VERSION = 1;
  const LIMIT = 50;
  const GROUP_SIZE = 10;
  const usable = entry => entry && typeof entry.id === 'string' && typeof entry.fr === 'string' && typeof entry.zh === 'string' && typeof entry.ipa === 'string';
  function selectRound(bank, cycle = 0) {
    const parts = [1, 2].map(part => bank.filter(e => usable(e) && Number(e.partie) === part));
    if (parts.some(part => part.length < 25)) throw new Error('两个部分各需至少 25 条不同词汇。');
    if (new Set(bank.map(e => e.id)).size !== bank.length) throw new Error('词库编号重复。');
    const picked = parts.map(part => Array.from({length: 25}, (_, index) => part[(cycle * 25 + index) % part.length].id));
    return Array.from({length: 5}, (_, group) => [...picked[0].slice(group * 5, group * 5 + 5), ...picked[1].slice(group * 5, group * 5 + 5)]).flat();
  }
  function create(bank, cycle = 0, stats = {}, round = 1) {
    return {version: VERSION, round, cycle, group: 0, ids: selectRound(bank, cycle), opened: {}, votes: {}, showCounts: {}, stats: structuredClone(stats)};
  }
  function restore(raw, bank) {
    try {
      const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const known = new Set(bank.map(e => e.id));
      if (!s || s.version !== VERSION || !Number.isSafeInteger(s.round) || s.round < 1 || !Number.isSafeInteger(s.cycle) || s.cycle < 0 || !Number.isInteger(s.group) || s.group < 0 || s.group >= 5 || !Array.isArray(s.ids) || s.ids.length !== LIMIT || new Set(s.ids).size !== LIMIT || s.ids.some(id => !known.has(id))) return null;
      const state = create(bank, s.cycle, {}, s.round);
      state.ids = s.ids.slice(); state.group = s.group;
      const current = new Set(state.ids);
      for (const id of known) {
        const counts = s.stats?.[id];
        if (counts && Number.isSafeInteger(counts.good) && counts.good >= 0 && Number.isSafeInteger(counts.bad) && counts.bad >= 0) state.stats[id] = {good: counts.good, bad: counts.bad};
        if (current.has(id)) {
          state.opened[id] = s.opened?.[id] === true;
          const vote = s.votes?.[id];
          if (vote === 'good' || vote === 'bad') {
            if (!state.stats[id] || state.stats[id][vote] < 1) return null;
            state.votes[id] = vote;
          }
          state.showCounts[id] = s.showCounts?.[id] === true || !!state.votes[id];
        }
      }
      return state;
    } catch { return null; }
  }
  function toggle(state, id) {
    if (!state.ids.includes(id)) return false;
    state.opened[id] = !state.opened[id];
    return true;
  }
  function vote(state, id, kind) {
    if (!state.ids.includes(id) || !state.opened[id] || !['good', 'bad'].includes(kind)) return false;
    const previous = state.votes[id];
    if (previous === kind) return false;
    const counts = state.stats[id] || {good: 0, bad: 0};
    if (counts[kind] >= Number.MAX_SAFE_INTEGER || previous && counts[previous] < 1) return false;
    state.stats[id] = {...counts, [kind]: counts[kind] + 1};
    if (previous) state.stats[id][previous] -= 1;
    state.votes[id] = kind; state.showCounts[id] = true;
    return true;
  }
  function restart(state, bank, next = false) {
    return create(bank, state.cycle + (next ? 1 : 0), state.stats, state.round + 1);
  }
  function totals(state) {
    const votes = state.ids.map(id => state.votes[id]);
    return {done: votes.filter(Boolean).length, good: votes.filter(v => v === 'good').length, bad: votes.filter(v => v === 'bad').length, opened: state.ids.filter(id => state.opened[id]).length};
  }
  globalThis.VocabCore = Object.freeze({VERSION, LIMIT, GROUP_SIZE, selectRound, create, restore, toggle, vote, restart, totals});
})();
