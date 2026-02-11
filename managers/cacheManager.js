const DB_NAME = 'VRM_Assets_Cache'
const DB_VERSION = 1
const STORES = {
  models: 'models',
  animations: 'animations',
}

export class CacheManager {
  db = null

  async openDB() {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (event) => {
        console.error('CacheManager: OpenDB error', event)
        reject('Error opening database')
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(STORES.models)) {
          db.createObjectStore(STORES.models)
        }
        if (!db.objectStoreNames.contains(STORES.animations)) {
          db.createObjectStore(STORES.animations)
        }
      }
    })
  }

  async getCached(storeName, key) {
    try {
      const db = await this.openDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.get(key)

        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => {
          reject(request.error)
        }
      })
    } catch (error) {
      console.warn('CacheManager: getCached failed', error)
      return null
    }
  }

  async setCached(storeName, key, data) {
    try {
      const db = await this.openDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.put(data, key)

        request.onsuccess = () => {
          resolve()
        }
        request.onerror = () => {
          reject(request.error)
        }
      })
    } catch (error) {
      console.warn('CacheManager: setCached failed', error)
    }
  }

  async clearCache() {
    try {
      const db = await this.openDB()
      const transaction = db.transaction([STORES.models, STORES.animations], 'readwrite')
      transaction.objectStore(STORES.models).clear()
      transaction.objectStore(STORES.animations).clear()
      console.log('CacheManager: Cache cleared')
    } catch (error) {
      console.error('CacheManager: Failed to clear cache', error)
    }
  }
}

export const cacheManager = new CacheManager()
