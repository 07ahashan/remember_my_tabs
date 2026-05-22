document.addEventListener('DOMContentLoaded', async () => {
  const db = document.defaultView.dbInstance || window.dbInstance;
  
  const saveAllBtn = document.getElementById('save-all-btn');
  const offloadBtn = document.getElementById('offload-inactive-btn');
  const openDashboardBtn = document.getElementById('open-dashboard');
  const recentWorkspacesDiv = document.getElementById('recent-workspaces');

  // Load recent workspaces
  async function loadRecentWorkspaces() {
    try {
      const workspaces = await db.getWorkspaces();
      if (workspaces.length === 0) {
        recentWorkspacesDiv.innerHTML = '<div class="empty-state">No saved workspaces.</div>';
        return;
      }

      // Show top 3
      recentWorkspacesDiv.innerHTML = '';
      workspaces.slice(0, 3).forEach(ws => {
        const item = document.createElement('div');
        item.className = 'workspace-item';
        
        const tabCount = ws.tabs.length;
        
        item.innerHTML = `
          <div class="workspace-header">
            <span class="workspace-name">${escapeHTML(ws.name)}</span>
            <span class="workspace-meta">${tabCount} tabs</span>
          </div>
          <div class="workspace-actions">
            <button class="primary restore-btn" data-id="${ws.id}">Restore</button>
          </div>
        `;
        recentWorkspacesDiv.appendChild(item);
      });
      
      // Attach restore listeners
      document.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.getAttribute('data-id');
          chrome.runtime.sendMessage({ action: 'restore_workspace', workspaceId: id }, (res) => {
            if (res && res.success) window.close();
          });
        });
      });

    } catch (err) {
      console.error(err);
    }
  }

  loadRecentWorkspaces();

  saveAllBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'save_workspace' }, () => {
      loadRecentWorkspaces();
    });
  });

  offloadBtn.addEventListener('click', () => {
    // Query inactive tabs and discard them immediately
    chrome.tabs.query({ active: false, currentWindow: true }, (tabs) => {
      tabs.forEach(t => chrome.tabs.discard(t.id));
      offloadBtn.textContent = 'Offloaded!';
      setTimeout(() => offloadBtn.textContent = 'Offload Inactive Tabs Now', 2000);
    });
  });

  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('html/workspace.html') });
  });

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag]));
  }
});
