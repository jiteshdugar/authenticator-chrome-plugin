/**
 * Storage Manager for Authenticator Extension
 * Uses chrome.storage.local for data persistence
 */

const StorageManager = {
  /**
   * Get all accounts from storage
   * @returns {Promise<Array>}
   */
  async getAccounts() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['accounts'], (result) => {
        resolve(result.accounts || []);
      });
    });
  },

  /**
   * Save all accounts to storage
   * @param {Array} accounts 
   */
  async saveAccounts(accounts) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ accounts }, () => {
        resolve();
      });
    });
  },

  /**
   * Add a single account
   * @param {Object} account { name, secret, type, issuer, period, digits }
   */
  async addAccount(account) {
    const accounts = await this.getAccounts();
    // Unique ID for each account
    account.id = Date.now().toString();
    accounts.push(account);
    await this.saveAccounts(accounts);
    return account;
  },

  /**
   * Remove an account by ID
   * @param {string} id 
   */
  async removeAccount(id) {
    let accounts = await this.getAccounts();
    accounts = accounts.filter(acc => acc.id !== id);
    await this.saveAccounts(accounts);
  },

  /**
   * Export accounts as a JSON string
   */
  async exportData() {
    const accounts = await this.getAccounts();
    return JSON.stringify(accounts, null, 2);
  },

  /**
   * Import accounts from a JSON string
   * @param {string} jsonString 
   */
  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data)) {
        await this.saveAccounts(data);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }
};
