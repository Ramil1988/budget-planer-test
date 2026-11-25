const digest = /^[a-f\d]{64}$/i;

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createCompanyReviewStore(userId, storage = browserStorage()) {
  const memory = new Map();
  const unsaved = new Set();

  function storageKey(row) {
    if (typeof userId !== 'string' || !userId.trim() || !digest.test(row?.reviewKey ?? '')
      || !Array.isArray(row.companyCandidates) || !row.companyCandidates.length) return null;
    return `budgetwise:company-review:v1:${encodeURIComponent(userId)}:${row.reviewKey}`;
  }

  function offered(row, decision) {
    return decision === null || (typeof decision === 'string' && decision.length > 0
      && row.companyCandidates.some((candidate) => candidate?.scheduleId === decision));
  }

  return {
    read(row) {
      const key = storageKey(row);
      if (!key) return undefined;
      if (storage && !unsaved.has(key)) {
        try {
          const saved = storage.getItem(key);
          if (saved === null) memory.delete(key);
          else memory.set(key, JSON.parse(saved));
        } catch {
          // Browser storage can become unavailable while the chat is open.
        }
      }
      const decision = memory.get(key);
      return offered(row, decision) ? decision : undefined;
    },
    write(row, decision) {
      const key = storageKey(row);
      if (!key || (decision !== undefined && !offered(row, decision))) return false;
      if (decision === undefined) memory.delete(key);
      else memory.set(key, decision);
      if (storage) {
        try {
          if (decision === undefined) storage.removeItem(key);
          else storage.setItem(key, JSON.stringify(decision));
          unsaved.delete(key);
        } catch {
          // A full or read-only store may still return the previous decision.
          unsaved.add(key);
        }
      }
      return true;
    },
  };
}
