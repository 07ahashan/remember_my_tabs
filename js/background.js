// Import the DB wrapper
importScripts('db.js');

// Track tab activity
const tabsLastActive = {};

// Listener for Tab Activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  tabsLastActive[activeInfo.tabId] = Date.now();
});

// Alarm for memory management: Check inactive tabs
chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 15 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    offloadInactiveTabs();
  }
});

async function offloadInactiveTabs() {
  const settings = await chrome.storage.local.get({ autoOffloadMinutes: 60 });
  const threshold = settings.autoOffloadMinutes * 60 * 1000;
  const now = Date.now();

  chrome.tabs.query({ active: false, pinned: false, audible: false }, async (tabs) => {
    for (let tab of tabs) {
      const lastActive = tabsLastActive[tab.id] || now;
      if (now - lastActive > threshold) {
        // We can discard them or fully offload them to DB
        // Manifest V3 allows chrome.tabs.discard for zero RAM usage while keeping it visually in the tab strip
        try {
          await chrome.tabs.discard(tab.id);
          console.log(`Discarded inactive tab: ${tab.id}`);
        } catch (err) {
          console.error("Error discarding tab", err);
        }
      }
    }
  });
}

// Handle messages from the UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_workspace') {
    handleSaveWorkspace(request.name).then(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'restore_workspace') {
    handleRestoreWorkspace(request.workspaceId).then(sendResponse);
    return true;
  }
});

async function handleSaveWorkspace(name) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      const tabData = tabs.map(t => ({
        url: t.url,
        title: t.title,
        favIconUrl: t.favIconUrl,
        pinned: t.pinned,
        active: t.active,
        groupId: t.groupId
      }));

      const workspace = {
        name: name || `Workspace ${new Date().toLocaleString()}`,
        tabs: tabData,
        windowId: tabs[0].windowId
      };

      const id = await self.dbInstance.saveWorkspace(workspace);
      
      resolve({ success: true, id });

      // Close the entire window after saving is complete
      chrome.windows.remove(tabs[0].windowId);
    });
  });
}

async function handleRestoreWorkspace(id) {
  const workspaces = await self.dbInstance.getWorkspaces();
  const workspace = workspaces.find(w => w.id === id);
  if (!workspace) return { success: false, error: 'Workspace not found' };

  // Restore tabs into the current active window
  const currentWin = await chrome.windows.getCurrent();
  const winTabs = await chrome.tabs.query({ windowId: currentWin.id });

  for (let t of workspace.tabs) {
    await chrome.tabs.create({
      windowId: currentWin.id,
      url: t.url,
      active: false,
      pinned: t.pinned
    });
  }

  // If the window only had a single new/blank tab, close it to keep it clean
  if (winTabs.length === 1 && (winTabs[0].url === 'chrome://newtab/' || winTabs[0].url === 'about:blank' || winTabs[0].url === '')) {
    chrome.tabs.remove(winTabs[0].id);
  }

  return { success: true };
}
