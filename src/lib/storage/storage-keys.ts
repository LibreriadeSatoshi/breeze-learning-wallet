export const STORAGE_PREFIX = "ismos-wallet:";

const LEGACY_PREFIX = "scholar-wallet:";
// Never carried forward: older builds stored the plaintext mnemonic here.
const DROPPED_KEYS = new Set(["session-mnemonic"]);

export function storageKey(name: string): string {
  return STORAGE_PREFIX + name;
}

function migrate(storage: Storage): void {
  const legacy: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(LEGACY_PREFIX)) legacy.push(key);
  }
  for (const key of legacy) {
    const name = key.slice(LEGACY_PREFIX.length);
    const value = storage.getItem(key);
    if (!DROPPED_KEYS.has(name) && value !== null && storage.getItem(storageKey(name)) === null) {
      storage.setItem(storageKey(name), value);
    }
    storage.removeItem(key);
  }
}

export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;
  try {
    migrate(window.localStorage);
    migrate(window.sessionStorage);
  } catch {
    // Storage can be unavailable (private mode); nothing to migrate then.
  }
}

// Inline in <head> so preferences are renamed before anything reads them.
export const STORAGE_MIGRATION_SCRIPT = `(function(){try{var L=${JSON.stringify(
  LEGACY_PREFIX,
)},N=${JSON.stringify(STORAGE_PREFIX)},D=${JSON.stringify([...DROPPED_KEYS])};[localStorage,sessionStorage].forEach(function(s){var k=[];for(var i=0;i<s.length;i++){var x=s.key(i);if(x&&x.indexOf(L)===0)k.push(x);}k.forEach(function(x){var n=x.slice(L.length),v=s.getItem(x);if(D.indexOf(n)<0&&v!==null&&s.getItem(N+n)===null)s.setItem(N+n,v);s.removeItem(x);});});}catch(e){}})();`;
