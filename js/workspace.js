document.addEventListener('DOMContentLoaded', async () => {
  const db = document.defaultView.dbInstance || window.dbInstance;
  const gridContainer = document.getElementById('workspaces-grid');
  const createBtn = document.getElementById('create-workspace-btn');

  async function renderWorkspaces() {
    try {
      const workspaces = await db.getWorkspaces();
      gridContainer.innerHTML = '';

      if (workspaces.length === 0) {
        gridContainer.innerHTML = `
          <div class="empty-state">
            <h2>No workspaces saved yet</h2>
            <p>Save your current window to start offloading tabs and preserving RAM.</p>
          </div>
        `;
        return;
      }

      workspaces.forEach(ws => {
        const card = document.createElement('div');
        card.className = 'workspace-card';
        
        const date = new Date(ws.createdAt).toLocaleString();
        
        let tabIconsHtml = '';
        const limit = 8;
        ws.tabs.slice(0, limit).forEach(tab => {
          if (tab.favIconUrl) {
             tabIconsHtml += `<div class="tab-icon" title="${escapeHTML(tab.title)}"><img src="${escapeHTML(tab.favIconUrl)}" /></div>`;
          } else {
             tabIconsHtml += `<div class="tab-icon" title="${escapeHTML(tab.title)}"><span class="fallback">?</span></div>`;
          }
        });

        if (ws.tabs.length > limit) {
          tabIconsHtml += `<div class="more-tabs">+${ws.tabs.length - limit} more</div>`;
        }

        card.innerHTML = `
          <div class="card-header">
            <div>
              <h3 class="card-title">${escapeHTML(ws.name)}</h3>
              <div class="card-date">${date}</div>
            </div>
            <button class="rename-btn" style="background:transparent; padding:4px; font-size:16px;" data-id="${ws.id}" title="Rename Workspace">✏️</button>
          </div>
          <div class="tab-previews">
            ${tabIconsHtml}
          </div>
          <div class="card-actions">
            <button class="primary restore-btn" data-id="${ws.id}">Restore Workspace</button>
            <button class="danger delete-btn" data-id="${ws.id}">Delete</button>
          </div>
        `;

        gridContainer.appendChild(card);
      });

      attachListeners();

    } catch (err) {
      console.error(err);
    }
  }

  function attachListeners() {
    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        chrome.runtime.sendMessage({ action: 'restore_workspace', workspaceId: id }, () => {
          console.log('Restored');
        });
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        await db.deleteWorkspace(id);
        renderWorkspaces();
      });
    });

    document.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const newName = prompt("Enter new workspace name:");
        if (newName && newName.trim() !== '') {
          const workspaces = await db.getWorkspaces();
          const workspace = workspaces.find(w => w.id === id);
          if (workspace) {
            workspace.name = newName.trim();
            await db.saveWorkspace(workspace);
            renderWorkspaces();
          }
        }
      });
    });
  }

  createBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'save_workspace' }, () => {
      renderWorkspaces();
    });
  });

  renderWorkspaces();

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
