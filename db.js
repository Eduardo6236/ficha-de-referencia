const DB = (() => {
  const NAME = 'ficha-referencia', VERSION = 1;
  let promise;
  function open() {
    if (promise) return promise;
    promise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('fichas')) db.createObjectStore('fichas', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return promise;
  }
  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), s = tx.objectStore(store);
      let result;
      try { result = fn(s); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const all = s => run(s, 'readonly', x => x.getAll());
  const put = (s, v) => run(s, 'readwrite', x => x.put(v));
  const del = (s, id) => run(s, 'readwrite', x => x.delete(id));
  const get = (s, id) => run(s, 'readonly', x => x.get(id));
  return { open, all, put, del, get };
})();
