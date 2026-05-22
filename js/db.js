// db.js: Helper wrapper around IndexedDB for RememberMyTabs

const DB_NAME = 'RememberMyTabsDB';
const DB_VERSION = 1;

class DB {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (e) => reject(e.target.error);

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        
        // Workspaces store
        if (!db.objectStoreNames.contains('workspaces')) {
          const store = db.createObjectStore('workspaces', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Offloaded single tabs store (for smart offloading)
        if (!db.objectStoreNames.contains('offloaded_tabs')) {
          const store = db.createObjectStore('offloaded_tabs', { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('offloadedAt', 'offloadedAt', { unique: false });
        }
      };
    });
  }

  async saveWorkspace(workspace) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('workspaces', 'readwrite');
      const store = tx.objectStore('workspaces');
      workspace.id = workspace.id || Date.now().toString();
      workspace.createdAt = workspace.createdAt || Date.now();
      
      const request = store.put(workspace);
      request.onsuccess = () => resolve(workspace.id);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getWorkspaces() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('workspaces', 'readonly');
      const store = tx.objectStore('workspaces');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const workspaces = request.result;
        // Sort descending by creation date
        resolve(workspaces.sort((a, b) => b.createdAt - a.createdAt));
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteWorkspace(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('workspaces', 'readwrite');
      const store = tx.objectStore('workspaces');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

// Export a singleton instance globally for background/popup/workspace scripts
self.dbInstance = new DB();
