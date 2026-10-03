(() => {
  'use strict';
  const KEY = 'french-vocabulary-test:outbox:v1';
  function create({core, bank, host, onChange, onError, storage}) {
    let base, queue = [], flight = null, failure = '', deferred, started = false, cache;
    try { cache = JSON.parse(storage?.getItem(KEY) || 'null'); } catch {}
    const clone = value => structuredClone(value);
    function apply(state, op) {
      if (op.roundId !== state.roundId) return false;
      if (op.action === 'toggle') return core.toggle(state, op.args.id);
      if (op.action === 'vote') return core.vote(state, op.args.id, op.args.kind);
      if (op.action === 'group') { state.group = op.args.group; return true; }
      if (op.action === 'repeat' || op.action === 'next') {
        const next = core.restart(state, bank, op.action === 'next');
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, next, {roundId:op.targetRoundId});
        return true;
      }
      return false;
    }
    function project() {
      if (!base) return null;
      const state = clone(base.state);
      for (const op of queue) apply(state, op);
      return state;
    }
    function persist() {
      if (!base) return;
      try {
        if (queue.length) storage?.setItem(KEY, JSON.stringify({rootRoundId:base.state.roundId, queue}));
        else storage?.removeItem(KEY);
      } catch {}
    }
    function emit() {
      persist();
      if (base) onChange({state:project(),revision:base.revision,pending:queue.length,error:failure});
    }
    function mapRound(from, to) {
      if (!from) return;
      for (const op of queue) if (op.roundId === from) op.roundId = to;
    }
    function valid(snapshot) {
      if (!snapshot || !Number.isSafeInteger(snapshot.revision)) return null;
      const state = core.restore(snapshot.state, bank);
      if (!state || typeof snapshot.state.roundId !== 'string') return null;
      return {...snapshot,state:{...state,roundId:snapshot.state.roundId,recentRequests:snapshot.state.recentRequests || []}};
    }
    function adopt(snapshot) {
      const incoming = valid(snapshot);
      if (!incoming || (base && incoming.revision < base.revision)) return false;
      base = incoming;
      const recent = new Set(base.state.recentRequests);
      while (queue.length && recent.has(queue[0].requestId)) {
        const done = queue.shift();
        if (done.targetRoundId) mapRound(done.targetRoundId, base.state.roundId);
      }
      if (queue.length && queue[0].roundId !== base.state.roundId) {
        queue = []; failure = '';
        onError('本轮已在其他界面更新，已恢复云端记录。');
      }
      emit();
      return true;
    }
    function receive(snapshot) {
      if (flight) {
        if (!deferred || snapshot.revision >= deferred.revision) deferred = snapshot;
        return;
      }
      if (!started) {
        started = true;
        const incoming = valid(snapshot);
        if (!incoming) { onError('检测记录格式异常，请重新打开。'); return; }
        const recent = new Set(incoming.state.recentRequests);
        if (cache && Array.isArray(cache.queue) && cache.queue.length <= 500 &&
            (cache.rootRoundId === incoming.state.roundId || cache.queue.some(op => op.targetRoundId && recent.has(op.requestId)))) {
          queue = cache.queue.filter(op => op && ['toggle','vote','group','repeat','next'].includes(op.action) &&
            typeof op.requestId === 'string' && typeof op.roundId === 'string' && op.args &&
            (!['toggle','vote'].includes(op.action) || incoming.state.ids.includes(op.args.id) || bank.some(e => e.id === op.args.id)) &&
            (op.action !== 'group' || Number.isInteger(op.args.group) && op.args.group >= 0 && op.args.group < 5) &&
            (op.action !== 'vote' || ['good','bad'].includes(op.args.kind)) &&
            (!['repeat','next'].includes(op.action) || typeof op.targetRoundId === 'string'));
        }
        cache = null;
      }
      adopt(snapshot); pump();
    }
    async function pump() {
      if (!base || flight || failure || !queue.length) return;
      const op = queue[0]; flight = op;
      try {
        const snapshot = await host.action(op.action, {...op.args,roundId:op.roundId,requestId:op.requestId});
        const incoming = valid(snapshot);
        if (!incoming) throw new Error('保存返回的记录无效，请重试。');
        queue = queue.filter(item => item.requestId !== op.requestId);
        if (op.targetRoundId) mapRound(op.targetRoundId, incoming.state.roundId);
        adopt(incoming);
      } catch (error) {
        failure = error.message || '连接中断';
        if (error.definitive && host.refresh) {
          try {
            const snapshot = await host.refresh();
            queue = queue.filter(item => item.requestId !== op.requestId);
            failure = '';
            adopt(snapshot);
            onError(error.message);
          } catch {}
        }
        if (failure) onError('尚未保存，点击重试即可继续。');
      } finally {
        flight = null;
        if (deferred) { const snapshot = deferred; deferred = null; adopt(snapshot); }
        emit();
        if (!failure) pump();
      }
    }
    function dispatch(action, args = {}) {
      if (!base || queue.length >= 500) return false;
      const state = project();
      const op = {action,args:{...args},roundId:state.roundId,requestId:crypto.randomUUID()};
      if (action === 'repeat' || action === 'next') op.targetRoundId = 'pending:' + op.requestId;
      if (!apply(state, op)) return false;
      const last = queue.at(-1);
      if (action === 'group' && last?.action === 'group' && last !== flight && last.roundId === op.roundId) queue.pop();
      else if (action === 'toggle' && last?.action === 'toggle' && last !== flight && last.roundId === op.roundId && last.args.id === args.id) {
        queue.pop(); emit(); return true;
      }
      queue.push(op); emit(); pump(); return true;
    }
    return {receive,dispatch,retry(){failure = '';emit();pump();},get pending(){return queue.length;}};
  }
  globalThis.VocabSync = Object.freeze({create});
})();
