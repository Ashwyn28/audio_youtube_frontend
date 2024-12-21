import { browser } from "$app/environment";
import { initialState } from "$lib/data";

export class LocalStorageManager {
  private storageKey: string;
  private storage: null;
  private states: string[];

  constructor(storageKey: string, states: string[]) {
    this.storageKey = storageKey;
    this.storage = this.getInitialStorage();
    this.states = states
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
        if (this.states && this.states in value) {
          const data = initialState;
          for(let i = 0; i < this.states?.length; i++) {
            data[this.states[i]] = value[this.states[i]]
          }
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        }
      });
    }
  }

  public getStorage(): null {
    return this.storage;
  }
}