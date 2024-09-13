import { browser } from "$app/environment";

export class LocalStorageManager {
  private storageKey: string;
  private storage: null;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.storage = this.getInitialStorage();
  }

  private getInitialStorage(): null {
    if (browser) {
      const storedData = localStorage.getItem(this.storageKey);
      return storedData ? JSON.parse(storedData) : null;
    }
    return null;
  }

  public subscribeToChanges(subscribe): void {
    if (browser) {
      subscribe((value) => {
        localStorage.setItem(this.storageKey, JSON.stringify(value));
      });
    }
  }

  public getStorage(): null {
    return this.storage;
  }
}