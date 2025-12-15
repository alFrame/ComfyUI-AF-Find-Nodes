// ****** ComfyUI-AF-Find Nodes ******
//
// Creator: Alex Furer - Co-Creator(s): Claude AI & QWEN3 Coder & DeepSeek
//
// Description: A ComfyUI utility extension for finding nodes by ID, title, pack, or type in workflows.
//
// Repo: https://github.com/alFrame/ComfyUI-AF-Find-Nodes/
//
// Issues, praise, comment, bugs, improvements: https://github.com/alFrame/ComfyUI-AF-Find-Nodes/issues
//
// LICENSE: MIT License
//
// Usage: https://github.com/alFrame/ComfyUI-AF-Find-Nodes/blob/main/README.md
//
// Feature Requests / Wet Dreams
// - 

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

// Prevent double initialization
if (window.AF_Find_Nodes_Widget) {
    console.log("AF - Find Nodes already loaded, skipping initialization");
} else {

class AF_Find_Nodes_Widget {
    constructor() {
        this.searchPanel = null;
        this.isVisible = false;
        this.highlightedNode = null;
        this.originalNodeColors = new Map();
        this.searchHistory = [];
        this.maxHistory = 10;
        this.inspectorMode = false;
        this.searchTimeout = null;
        this.experimentalEnabled = localStorage.getItem('af-find-node-experimental') === 'true';

        this.workflowPackIndex = {};
        this.workflowTypeIndex = {};
        this.lastWorkflowSignature = null;
        this.scanCompleted = false;

        this.currentTab = localStorage.getItem('af-find-node-last-tab') || 'id';
        this.tabInputs = {};
        this.tabHistory = {
            id: JSON.parse(localStorage.getItem('af-find-node-history-id') || '[]'),
            title: JSON.parse(localStorage.getItem('af-find-node-history-title') || '[]'),
            pack: JSON.parse(localStorage.getItem('af-find-node-history-pack') || '[]'),
            type: JSON.parse(localStorage.getItem('af-find-node-history-type') || '[]')
        };

        // Add workflow change monitoring WITHOUT overriding anything
        this.workflowMonitorInterval = null;
        this.lastNodeCount = 0;
        this.selectionInterval = null;
        this.lastSelectedNodes = [];
    }


    setupSelectionMonitor() {
        if (this.inspectorMode && !this.selectionInterval) {
            this.selectionInterval = setInterval(() => {
                this.checkNodeSelection();
            }, 300);
        } else if (!this.inspectorMode && this.selectionInterval) {
            clearInterval(this.selectionInterval);
            this.selectionInterval = null;
            this.lastSelectedNodes = [];
        }
    }

    checkNodeSelection() {
        if (!this.inspectorMode || !app.canvas || !app.canvas.selected_nodes) return;

        const currentSelected = app.canvas.selected_nodes;
        if (!currentSelected || Object.keys(currentSelected).length === 0) return;

        // Get the first selected node
        const nodeId = Object.keys(currentSelected)[0];
        const node = currentSelected[nodeId];

        if (node && !this.lastSelectedNodes.includes(node.id)) {
            this.AF_Find_Nodes_HandleNodeClick(node);
            this.lastSelectedNodes = [node.id];
        }
    }

    // SAFE: Monitor workflow changes without overriding ComfyUI functions
    startWorkflowMonitor() {
        if (this.workflowMonitorInterval) return;

        this.workflowMonitorInterval = setInterval(() => {
            if (!app.graph || !app.graph.nodes) return;

            const currentCount = app.graph.nodes.length;
            // Check if workflow changed significantly (more than just selection changes)
            if (Math.abs(currentCount - this.lastNodeCount) > 0) {
                this.lastNodeCount = currentCount;
                // Debounce the scan
                clearTimeout(this.workflowScanTimeout);
                this.workflowScanTimeout = setTimeout(() => {
                    this.scanWorkflowForPacks();
                }, 1000);
            }
        }, 2000); // Check every 2 seconds - very conservative
    }

    stopWorkflowMonitor() {
        if (this.workflowMonitorInterval) {
            clearInterval(this.workflowMonitorInterval);
            this.workflowMonitorInterval = null;
        }
        if (this.workflowScanTimeout) {
            clearTimeout(this.workflowScanTimeout);
            this.workflowScanTimeout = null;
        }
    }

    createSearchPanel() {
        // Create main container
        const panel = document.createElement('div');
        panel.id = 'af-find-nodes-panel';
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #2a2a2a;
            border: 1px solid #555;
            border-radius: 8px;
            padding: 15px;
            z-index: 10000;
            font-family: monospace;
            font-size: 12px;
            color: #fff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            width: 460px;  /* Fixed width */
            display: none;
        `;

        // Title bar
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #555;
            padding-bottom: 8px;
        `;

        const title = document.createElement('div');
        title.textContent = 'AF - Find Nodes';
        title.style.fontWeight = 'bold';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: #ff4444;
            border: none;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
        `;
        closeBtn.onclick = () => this.AF_Find_Nodes_HidePanel();

        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);

		// Create tab container
		const tabContainer = document.createElement('div');
		tabContainer.style.cssText = `
			display: flex;
			margin-bottom: 10px;
			border-bottom: 1px solid #555;
		`;
		
		// Define tabs
		this.tabs = [
			{ id: 'id', name: '🔍 By ID', placeholder: 'Enter node ID (e.g., 42)' },
			{ id: 'title', name: '📛 By Title', placeholder: 'Search node titles, colors, cnr_id, aux_id...' },
			{ id: 'pack', name: '📦 By Pack', placeholder: 'Search node packs (e.g., rgthree, WAS, efficiency)' },
		    { id: 'type', name: '🔎 By Type', placeholder: 'Search node types (e.g., KSampler, CLIPTextEncode)' },
		    { id: 'stats', name: '📊 Stats', placeholder: 'Workflow statistics and pack overview' }
			];
		
		this.tabInputs = {};
				
		// Create tab buttons
		this.tabs.forEach(tab => {
			const tabBtn = document.createElement('button');
			tabBtn.textContent = tab.name;
			tabBtn.dataset.tab = tab.id;
			
			const isExperimental = tab.id === 'pack' || tab.id === 'type';
			const isActive = tab.id === this.currentTab;
			
			tabBtn.style.cssText = `
				flex: 1;
				padding: 6px 4px;
				background: ${isActive ? (isExperimental ? '#7a4a1a' : '#555') : (isExperimental ? '#5a2a0a' : '#333')};
				border: none;
				border-bottom: ${isActive ? (isExperimental ? '2px solid #ff9800' : '2px solid #4CAF50') : 'none'};
				border-right: 1px solid #666;
				color: white;
				cursor: pointer;
				font-size: 10px;
				border-radius: 0;
				opacity: ${isExperimental && !this.experimentalEnabled ? '0.6' : '1'};
			`;
			
			// Remove right border from last tab
			if (tab.id === 'type') {
				tabBtn.style.borderRight = 'none';
			}
			
			tabBtn.onclick = () => {
				if ((tab.id === 'pack' || tab.id === 'type') && !this.experimentalEnabled) {
					this.AF_Find_Nodes_UpdateResults('Experimental features are disabled. Enable them in settings below.', true);
					return;
				}
				this.switchTab(tab.id);
			};
			
			tabContainer.appendChild(tabBtn);
		});

		// Add experimental features toggle section
		const experimentalSection = document.createElement('div');
		experimentalSection.style.cssText = `
			border-top: 1px solid #555;
			padding: 12px 0;
			font-size: 10px;
		`;

		const experimentalLabel = document.createElement('label');
		experimentalLabel.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			color: #ff9800;
			cursor: pointer;
		`;

		const experimentalCheckbox = document.createElement('input');
		experimentalCheckbox.type = 'checkbox';
		experimentalCheckbox.checked = this.experimentalEnabled;
		experimentalCheckbox.style.cssText = `
			margin: 0;
		`;

		const experimentalText = document.createElement('span');
		experimentalText.innerHTML = 'Enable experimental features <span style="color: #ff6b6b;">(may not work consistently)</span>';

		experimentalCheckbox.onchange = (e) => {
			this.experimentalEnabled = e.target.checked;
			localStorage.setItem('af-find-node-experimental', this.experimentalEnabled.toString());
			
			// Update tab appearances
			this.updateTabAppearance();
			
			if (!this.experimentalEnabled && (this.currentTab === 'pack' || this.currentTab === 'type')) {
				this.switchTab('id'); // Switch to safe tab if experimental was active
			}
			
			this.AF_Find_Nodes_UpdateResults(
				this.experimentalEnabled ? 
				'Experimental features enabled. <span style="color: #ff6b6b;">Use with caution!</span>' : 
				'Experimental features disabled.'
			);
		};

		experimentalLabel.appendChild(experimentalCheckbox);
		experimentalLabel.appendChild(experimentalText);
		experimentalSection.appendChild(experimentalLabel);
		
		// Create tab-specific input
		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.placeholder = this.tabs[0].placeholder;
		searchInput.id = 'af-find-nodes-input';
		searchInput.style.cssText = `
			width: 100%;
			padding: 6px;
			margin-bottom: 8px;
			background: #1a1a1a;
			border: 1px solid #555;
			border-radius: 4px;
			color: #fff;
			font-family: monospace;
		`;
		
		// Store reference to main input
		this.tabInputs.main = searchInput;

        // Search input section
        const searchSection = document.createElement('div');
        searchSection.style.marginBottom = '10px';

        searchInput.placeholder = this.tabs[0].placeholder;
        searchInput.id = 'af-find-nodes-input';
		;

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        `;

        const searchBtn = document.createElement('button');
        searchBtn.textContent = 'Find';
        searchBtn.style.cssText = `
            flex: 1;
            padding: 6px;
            background: #4CAF50;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 11px;
        `;

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            flex: 1;
            padding: 6px;
            background: #666;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 11px;
        `;

        const inspectorBtn = document.createElement('button');
        inspectorBtn.textContent = 'Inspector';
        inspectorBtn.id = 'af-find-nodes-inspector-toggle';
        inspectorBtn.style.cssText = `
            flex: 1;
            padding: 6px;
            background: #2196F3;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 11px;
			display: ${this.currentTab === 'id' ? 'block' : 'none'};
        `;

        // Results section
		const resultsSection = document.createElement('div');
		resultsSection.id = 'af-find-nodes-results';
		resultsSection.style.cssText = `
		    max-height: 70vh; /* Use viewport height instead of fixed calculation */
		    overflow-y: auto;
		    background: #1a1a1a;
		    border: 1px solid #555;
		    border-radius: 4px;
		    padding: 8px;
		    margin-bottom: 10px;
		`;
		
		const statusSection = document.createElement('div');
		statusSection.id = 'af-find-nodes-status';
		statusSection.style.cssText = `
			font-size: 11px;
			color: #aaa;
			margin-bottom: 8px;
			min-height: 14px;
		`;
		
        // History section
        const historySection = document.createElement('div');
        historySection.style.cssText = `
            border-top: 1px solid #555;
            padding-top: 8px;
        `;

        const historyTitle = document.createElement('div');
        historyTitle.textContent = 'Recent Searches:';
        historyTitle.style.cssText = `
            font-size: 10px;
            color: #aaa;
            margin-bottom: 5px;
        `;

        const historyList = document.createElement('div');
        historyList.id = 'af-find-nodes-history';
        historyList.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        `;

		// Create separate sections for star widget and support info
		const starWidgetSection = document.createElement('div');
		starWidgetSection.id = 'af-find-nodes-star-widget';
		starWidgetSection.style.cssText = `
			border-top: 1px solid #555;
			padding-top: 8px;
			margin-top: 8px;
			display: ${localStorage.getItem('af-find-nodes-starred') ? 'none' : 'block'};
		`;

		const supportSection = document.createElement('div');
		supportSection.id = 'af-find-nodes-support';
		supportSection.style.cssText = `
			border-top: 1px solid #555;
			padding-top: 8px;
			margin-top: 8px;
			display: block; // Always visible
		`;

		// Star widget (can be hidden)
		const starWidget = document.createElement('div');
		starWidget.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			color: #ccc;
			cursor: pointer;
			margin-bottom: 8px;
		`;

		const starIcon = document.createElement('span');
		starIcon.textContent = '⭐';
		starIcon.style.fontSize = '12px';

		const starText = document.createElement('span');
		starText.innerHTML = 'Please consider <span style="color: #ffd700;">giving a star</span> if you find this helpful';

		starWidget.appendChild(starIcon);
		starWidget.appendChild(starText);

		starWidget.onclick = () => {
			// Open GitHub in new tab
			window.open('https://github.com/alFrame/ComfyUI-AF-Find-Nodes', '_blank');
			// Hide only the star widget, not the support section
			starWidgetSection.style.display = 'none';
			localStorage.setItem('af-find-nodes-starred', 'true');
		};

		// Support info (always visible)
		const supportText = document.createElement('div');
		supportText.innerHTML = '<span style="font-size: 11px; color: #aaa;">If you encounter any issues, please post them <a href="https://github.com/alFrame/ComfyUI-AF-Find-Nodes/issues" target="_blank" style="color: #4da6ff;">here</a></span>';

		// Assemble the sections
		starWidgetSection.appendChild(starWidget);
		supportSection.appendChild(supportText);

        // Event listeners
        searchBtn.onclick = () => this.AF_Find_Nodes_Search();
        clearBtn.onclick = () => this.AF_Find_Nodes_ClearAll();

		inspectorBtn.onclick = () => {
			if (this.currentTab === 'id') {
				this.AF_Find_Nodes_ToggleInspector();
			} else {
				this.AF_Find_Nodes_UpdateResults('Inspector mode is only available in "By ID" tab.', true);
			}
		};
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.AF_Find_Nodes_Search();
            }
        });
		
		// Add debouncing to the search input
		searchInput.addEventListener('input', (e) => {
			// Only auto-search for text-based tabs, not ID tab
			if (this.currentTab !== 'id') {
				clearTimeout(this.searchTimeout);
				this.searchTimeout = setTimeout(() => {
					if (e.target.value.trim().length >= 2) { // Only search if 2+ characters
						this.AF_Find_Nodes_Search();
					}
				}, 300); // Wait 300ms after typing stops
			}
		});

        // Assemble the panel
        buttonRow.appendChild(searchBtn);
        buttonRow.appendChild(clearBtn);
        buttonRow.appendChild(inspectorBtn);

		searchSection.appendChild(tabContainer);
		searchSection.appendChild(searchInput);
		searchSection.appendChild(buttonRow);

		historySection.appendChild(historyTitle);
		historySection.appendChild(historyList);

		panel.appendChild(titleBar);
		panel.appendChild(searchSection);
		panel.appendChild(statusSection);
		panel.appendChild(resultsSection);
		panel.appendChild(experimentalSection);
		panel.appendChild(historySection);
		panel.appendChild(starWidgetSection);
		panel.appendChild(supportSection);
		
        document.body.appendChild(panel);
        this.searchPanel = panel;

        // Update results initially
        this.AF_Find_Nodes_UpdateResults('Ready to search. Enter a node ID or use Inspector mode.');
    }

switchTab(tabId) {
    if ((tabId === 'pack' || tabId === 'type') && !this.experimentalEnabled) {
        this.AF_Find_Nodes_UpdateResults('Experimental features are disabled. Enable them below.', true);
        return;
    }
    this.currentTab = tabId;

    // Save to localStorage
    localStorage.setItem('af-find-node-last-tab', tabId);

    // Update tab buttons
    this.updateTabAppearance();

    // Update input placeholder
    const tabConfig = this.tabs.find(t => t.id === tabId);
    this.tabInputs.main.placeholder = tabConfig.placeholder;

    // Show/hide inspector button based on tab
    this.updateInspectorButtonVisibility();

    // Hide search input and buttons for stats tab
    const searchInput = document.getElementById('af-find-nodes-input');
    const searchBtn = document.querySelector('#af-find-nodes-panel button[onclick*="AF_Find_Nodes_Search"]');
    const clearBtn = document.querySelector('#af-find-nodes-panel button[onclick*="AF_Find_Nodes_ClearAll"]');

    if (tabId === 'stats') {
        if (searchInput) searchInput.style.display = 'none';
        if (searchBtn) searchBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
    } else {
        if (searchInput) searchInput.style.display = 'block';
        if (searchBtn) searchBtn.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'block';
    }

    // Clear previous results, input, and highlight
    this.tabInputs.main.value = '';
    this.AF_Find_Nodes_ClearHighlight();

    // Handle tab-specific content
    if (tabId === 'stats') {
        this.showWorkflowStats();
        this.AF_Find_Nodes_UpdateResults('Workflow statistics loaded.');
    } else {
        this.showResultsList([], '');  // Clear the results list
        this.AF_Find_Nodes_UpdateResults(`Switched to ${tabConfig.name} search. Ready to search.`);
    }

    // Update history for current tab (not for stats)
    if (tabId !== 'stats') {
        this.AF_Find_Nodes_UpdateHistory();
    }
}

showWorkflowStats() {
    // Ensure we have scanned data
    this.scanWorkflowForPacks();

    const totalNodes = app.graph?.nodes?.length || 0;
    const packCount = Object.keys(this.workflowPackIndex).length;
    const typeCount = Object.keys(this.workflowTypeIndex).length;

    // Separate core packs from custom packs
    const allPacks = Object.entries(this.workflowPackIndex)
        .map(([pack, nodeIds]) => ({
            pack,
            count: nodeIds.length,
            percentage: Math.round((nodeIds.length / totalNodes) * 100),
            isCore: pack === 'Core' || pack.toLowerCase().includes('core')
        }));

    const corePacks = allPacks.filter(p => p.isCore);
    const customPacks = allPacks.filter(p => !p.isCore);
    const sortedCustomPacks = customPacks.sort((a, b) => b.count - a.count);
    const sortedAllPacks = [...sortedCustomPacks, ...corePacks];

    // Build stats HTML without nested scroll containers
    let statsHTML = `
        <div style="color: #4CAF50; margin-bottom: 15px; font-size: 12px; font-weight: bold;">
            📊 Workflow Statistics
        </div>

        <div style="background: #2a2a2a; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #4CAF50;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Total Nodes:</span>
                <span style="color: #ff9800; font-weight: bold;">${totalNodes}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Unique Packs:</span>
                <span style="color: #ff9800; font-weight: bold;">${packCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Custom Packs:</span>
                <span style="color: #ff9800; font-weight: bold;">${customPacks.length}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Unique Node Types:</span>
                <span style="color: #ff9800; font-weight: bold;">${typeCount}</span>
            </div>
        </div>

        <!-- Quick Export Buttons at the Top -->
        <div style="margin-bottom: 15px; padding: 10px; background: #1a2a3a; border-radius: 6px; border: 1px solid #444;">
            <div style="color: #aaa; margin-bottom: 8px; font-size: 11px; text-align: center;">
                ⚡ Quick Export
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                <button onclick="window.AF_Find_Nodes_Widget.exportPackList()"
                        style="flex: 1; padding: 8px; background: #7a4a1a; border: none;
                               border-radius: 4px; color: white; cursor: pointer; font-size: 11px;
                               display: flex; align-items: center; justify-content: center; gap: 6px;">
                    📋 Packs
                </button>
                <button onclick="window.AF_Find_Nodes_Widget.copyNodeTypes(false)"
                        style="flex: 1; padding: 8px; background: #2a4a7a; border: none;
                               border-radius: 4px; color: white; cursor: pointer; font-size: 11px;
                               display: flex; align-items: center; justify-content: center; gap: 6px;">
                    📝 Filtered Types
                </button>
                <button onclick="window.AF_Find_Nodes_Widget.copyNodeTypes(true)"
                        style="flex: 1; padding: 8px; background: #3a2a5a; border: none;
                               border-radius: 4px; color: white; cursor: pointer; font-size: 11px;
                               display: flex; align-items: center; justify-content: center; gap: 6px;">
                    📝 All Types
                </button>
            </div>
            <div style="font-size: 10px; color: #666; text-align: center; margin-top: 4px;">
                Copy lists for documentation or cleanup
            </div>
        </div>
    `;

    // Show ALL packs - LIMIT height on this section only
    if (sortedAllPacks.length > 0) {
        statsHTML += `
            <div style="color: #aaa; margin-bottom: 10px; font-size: 11px; border-bottom: 1px solid #444; padding-bottom: 5px;">
                📦 All Node Packs (${sortedAllPacks.length})
            </div>

            <!-- Single scroll container for packs list -->
            <div style="max-height: 600px; overflow-y: auto; background: #1a1a1a; border-radius: 4px; padding: 6px; margin-bottom: 15px; border: 1px solid #333;">
        `;

        sortedAllPacks.forEach(({ pack, count, percentage, isCore }, index) => {
            let packColor = '#ccc';
            let countColor = '#4CAF50';
            let borderColor = '#444';

            if (isCore) {
                packColor = '#4da6ff';
                countColor = '#4da6ff';
                borderColor = '#2196F3';
            } else if (count <= 2) {
                packColor = '#8BC34A';
                countColor = '#8BC34A';
                borderColor = '#8BC34A';
            }

            statsHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center;
                            padding: 8px 10px; margin: 3px 0; background: #222;
                            border-radius: 4px; border-left: 3px solid ${borderColor};">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 10px; color: #666; min-width: 20px; text-align: center;">${index + 1}</span>
                        <span style="font-size: 11px; color: ${packColor};">
                            ${pack} ${isCore ? '🔧' : ''}
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 11px; color: ${countColor};">
                            ${count} node${count !== 1 ? 's' : ''}
                        </span>
                        <span style="font-size: 10px; color: #666; min-width: 40px; text-align: right;">
                            ${percentage}%
                        </span>
                    </div>
                </div>
            `;
        });

        statsHTML += `</div>`;

        // Cleanup opportunity - NO scroll here
        const lowUsagePacks = sortedAllPacks.filter(p => p.count <= 2 && !p.isCore);
        if (lowUsagePacks.length > 0) {
            statsHTML += `
                <div style="background: #223322; border: 1px solid #4CAF50; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                    <div style="color: #8BC34A; font-size: 11px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        💡 Cleanup Opportunity
                    </div>
                    <div style="font-size: 10px; color: #ccc; margin-bottom: 6px;">
                        Packs with only 1-2 nodes (${lowUsagePacks.length}):
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            `;

            lowUsagePacks.forEach(({ pack, count }) => {
                statsHTML += `
                    <span style="background: #4CAF5022; color: #8BC34A; padding: 3px 8px; border-radius: 3px; font-size: 10px;">
                        ${pack} (${count})
                    </span>
                `;
            });

            statsHTML += `
                </div>
                <div style="font-size: 10px; color: #8BC34A; margin-top: 8px; font-style: italic; line-height: 1.3;">
                    PRO TIP: Consider removing these packs, or check for nodes with the same functionality
                </div>
            </div>
            `;
        }

        // Pack distribution chart - NO scroll
        if (sortedAllPacks.length > 0) {
            statsHTML += `
                <div style="color: #aaa; margin-bottom: 8px; font-size: 11px; border-bottom: 1px solid #444; padding-bottom: 5px;">
                    📈 Pack Distribution
                </div>
                <div style="background: #1a1a1a; border-radius: 4px; padding: 10px; margin-bottom: 15px;">
            `;

            const topPacks = sortedAllPacks.slice(0, 5);
            const maxCount = topPacks[0]?.count || 1;

            topPacks.forEach(({ pack, count }) => {
                const barWidth = Math.max((count / maxCount) * 100, 3);
                statsHTML += `
                    <div style="margin-bottom: 6px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                            <span style="font-size: 10px; color: #ccc;">${pack}</span>
                            <span style="font-size: 10px; color: #4CAF50;">${count}</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); border-radius: 3px;"></div>
                        </div>
                    </div>
                `;
            });

            statsHTML += `
                    <div style="font-size: 10px; color: #666; text-align: center; margin-top: 8px;">
                        Top 5 packs by node count
                    </div>
                </div>
            `;
        }
    }

    // Node Types Summary - NO scroll
    statsHTML += `
        <div style="color: #aaa; margin-bottom: 8px; font-size: 11px; border-bottom: 1px solid #444; padding-bottom: 5px;">
            🔧 Node Types Overview
        </div>
        <div style="background: #1a2a3a; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 10px; color: #ccc;">Total Unique Types:</span>
                <span style="font-size: 10px; color: #4da6ff;">${typeCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 10px; color: #ccc;">UUID Types:</span>
                <span style="font-size: 10px; color: ${Object.keys(this.workflowTypeIndex).filter(t => this.isUUID(t)).length > 0 ? '#ff9800' : '#4CAF50'}">
                    ${Object.keys(this.workflowTypeIndex).filter(t => this.isUUID(t)).length}
                </span>
            </div>
            <div style="font-size: 9px; color: #666; margin-top: 8px; text-align: center;">
                Use export buttons above to copy detailed lists
            </div>
        </div>
    `;

    const results = document.getElementById('af-find-nodes-results');
    // NO nested scroll container - just set the HTML directly
    results.innerHTML = statsHTML;
}

    // Add these export methods to your class:
    exportPackList() {
        const packList = Object.entries(this.workflowPackIndex)
            .map(([pack, nodeIds]) => ({ pack, count: nodeIds.length }))
            .sort((a, b) => b.count - a.count)
            .map(({ pack, count }) => `• ${pack}: ${count} node${count !== 1 ? 's' : ''}`)
            .join('\n');

        const exportText = `Node Packs Used in This Workflow:\n\n${packList}\n\nTotal Nodes: ${app.graph?.nodes?.length || 0}\nGenerated by AF-Find-Nodes`;

        // Copy to clipboard
        navigator.clipboard.writeText(exportText).then(() => {
            this.AF_Find_Nodes_UpdateResults('✅ Pack list copied to clipboard! Ready for README.', false);
        }).catch(err => {
            // Fallback: Show in alert
            alert(exportText);
            this.AF_Find_Nodes_UpdateResults('📋 Pack list displayed (check alert popup)', false);
        });
    }

    copyNodeTypes(includeUUIDs = false) {
	    console.log('copyNodeTypes called with includeUUIDs:', includeUUIDs);
	    console.log('workflowTypeIndex keys:', Object.keys(this.workflowTypeIndex).length);
	    console.log('Sample types:', Object.keys(this.workflowTypeIndex).slice(0, 5));
        let typeEntries = Object.entries(this.workflowTypeIndex)
            .map(([type, nodeIds]) => ({ type, count: nodeIds.length }));

        // Filter out UUIDs unless requested
        if (!includeUUIDs) {
            typeEntries = typeEntries.filter(({ type }) => !this.isUUID(type));
        }

        typeEntries = typeEntries
            .sort((a, b) => b.count - a.count)
            .map(({ type, count }) => `• ${type}: ${count} node${count !== 1 ? 's' : ''}`);

        const filteredCount = typeEntries.length;
        const totalCount = Object.keys(this.workflowTypeIndex).length;
        const uuidCount = totalCount - filteredCount;

        // Start building the export text
        let exportText = `Node Types in This Workflow:\n\n${typeEntries.join('\n')}\n\n`;

        if (includeUUIDs) {
            exportText += `Total Types: ${totalCount}\n`;
        } else {
            exportText += `Filtered Types: ${filteredCount} (${uuidCount} UUIDs excluded)\n`;
        }

        exportText += `Generated by AF-Find-Nodes`;

        navigator.clipboard.writeText(exportText).then(() => {
            const msg = includeUUIDs ?
                '✅ All node types copied to clipboard!' :
                '✅ Filtered node types copied to clipboard!';
            this.AF_Find_Nodes_UpdateResults(msg, false);
        }).catch(err => {
            alert(exportText);
            this.AF_Find_Nodes_UpdateResults('📋 Node types displayed (check alert popup)', false);
        });
    }

    updateInspectorButtonVisibility() {
        const inspectorBtn = document.getElementById('af-find-nodes-inspector-toggle');
        if (inspectorBtn) {
            if (this.currentTab === 'id') {
                inspectorBtn.style.display = 'block';
            } else {
                inspectorBtn.style.display = 'none';
                // Also disable inspector mode if switching away from ID tab
                if (this.inspectorMode) {
                    this.AF_Find_Nodes_SetInspectorMode(false);
                }
            }
        }
    }

	updateTabAppearance() {
	    document.querySelectorAll('#af-find-nodes-panel [data-tab]').forEach(btn => {
	        const tabId = btn.dataset.tab;
	        const isExperimental = tabId === 'pack' || tabId === 'type';
	        const isStats = tabId === 'stats';
	        const isActive = tabId === this.currentTab;

	        btn.style.background = isActive ?
	            (isExperimental ? '#7a4a1a' : (isStats ? '#2a4a7a' : '#555')) :
	            (isExperimental ? '#5a2a0a' : (isStats ? '#1a2a5a' : '#333'));

	        btn.style.borderBottom = isActive ?
	            (isExperimental ? '2px solid #ff9800' : (isStats ? '2px solid #4da6ff' : '2px solid #4CAF50')) :
	            'none';

	        btn.style.opacity = isExperimental && !this.experimentalEnabled ? '0.6' : '1';
	    });
	}

	AF_Find_Nodes_ShowPanel() {
	    if (!this.searchPanel) {
	        this.createSearchPanel();
	    }
	    this.searchPanel.style.display = 'block';
	    this.isVisible = true;

	    // Scan workflow when panel opens (safe, on-demand scanning)
	    this.scanWorkflowForPacks();

	    // Show quick stats if we have data
	    if (this.scanCompleted) {
	        const totalNodes = app.graph?.nodes?.length || 0;
	        const packCount = Object.keys(this.workflowPackIndex).length;
	        const typeCount = Object.keys(this.workflowTypeIndex).length;

	        let statsMsg = `Loaded workflow: ${totalNodes} nodes`;
	        if (packCount > 0) {
	            statsMsg += `, ${packCount} packs`;
	        }
	        if (typeCount > 0) {
	            statsMsg += `, ${typeCount} types`;
	        }

	        this.AF_Find_Nodes_UpdateResults(statsMsg);
	    } else {
	        this.AF_Find_Nodes_UpdateResults('Ready to search. Scan your workflow by searching packs/types.');
	    }

	    // Set to remembered tab instead of always 'id'
	    this.switchTab(this.currentTab);

	    // Clear the search field when dialog is shown but keep results
	    document.getElementById('af-find-nodes-input').value = '';
	    document.getElementById('af-find-nodes-input').focus();

	    // Update tab appearance to reflect experimental setting
	    this.updateTabAppearance();

	    // Start monitoring when panel is open
	    this.startWorkflowMonitor();
	}

	AF_Find_Nodes_HidePanel() {
	    if (this.searchPanel) {
	        this.searchPanel.style.display = 'none';
	    }
	    this.isVisible = false;
	    this.AF_Find_Nodes_ClearAll();
	    this.AF_Find_Nodes_SetInspectorMode(false);

	    // Stop monitoring when panel is closed
	    this.stopWorkflowMonitor();
	}

    AF_Find_Nodes_TogglePanel() {
        if (this.isVisible) {
            this.AF_Find_Nodes_HidePanel();
        } else {
            this.AF_Find_Nodes_ShowPanel();
        }
    }

	AF_Find_Nodes_Search() {
		const searchTerm = this.tabInputs.main.value.trim();
		
		if (!searchTerm) {
			this.AF_Find_Nodes_UpdateResults('Please enter a search term', true);
			return;
		}

		let results = [];
		
		switch (this.currentTab) {
			case 'id':
				results = this.searchById(searchTerm);
				break;
			case 'title':
				results = this.searchByTitle(searchTerm);
				break;
			case 'pack':
				results = this.searchByPack(searchTerm);
				break;
			case 'type':
				results = this.searchByType(searchTerm);
				break;
		}
		
		this.handleSearchResults(results, searchTerm);
	}

	searchById(searchTerm) {
		const nodeId = parseInt(searchTerm);
		if (isNaN(nodeId)) {
			this.AF_Find_Nodes_UpdateResults('Invalid node ID. Please enter a number.', true);
			return [];
		}
		
		const node = this.AF_Find_Nodes_FindNodeById(nodeId);
		return node ? [node] : [];
	}

	searchByTitle(searchTerm) {
		const term = searchTerm.toLowerCase();
		return app.graph.nodes.filter(node => {
			return (
				(node.title && node.title.toLowerCase().includes(term)) ||
				(node.color && node.color.toLowerCase().includes(term)) ||
				(node.cnr_id && node.cnr_id.toString().includes(term)) ||
				(node.aux_id && node.aux_id.toString().includes(term)) ||
				(node.name && node.name.toLowerCase().includes(term))
			);
		});
	}

	getNodeBadgeInfo(node) {
	    if (!node) return null;

	    // Check ComfyUI's node registry first - this is where pack info is usually stored
	    if (app.node_types && node.type) {
	        const nodeDef = app.node_types[node.type];
	        if (nodeDef?.category) {
	            // Check if this is a core ComfyUI node
	            const category = nodeDef.category;
	            if (this.isCoreComfyUICategory(category)) {
	                return 'Core';
	            }
	            return category;
	        }
	        if (nodeDef?.name) {
	            return nodeDef.name;
	        }
	    }

	    // Check node constructor properties
	    if (node.constructor?.nodeData?.category) {
	        const category = node.constructor.nodeData.category;
	        if (this.isCoreComfyUICategory(category)) {
	            return 'Core';
	        }
	        return category;
	    }
	    if (node.constructor?.category) {
	        const category = node.constructor.category;
	        if (this.isCoreComfyUICategory(category)) {
	            return 'Core';
	        }
	        return category;
	    }
	    if (node.constructor?.title) {
	        return node.constructor.title;
	    }

	    // Check for comfyClass which sometimes contains pack info
	    if (node.comfyClass) {
	        return node.comfyClass;
	    }

	    // Check cnr_id as a pack identifier
	    if (node.cnr_id) {
	        return node.cnr_id.toString();
	    }

	    // For specific known packs, we can also check the type string
	    const nodeType = node.type || '';
	    if (nodeType.includes('WAS')) return 'WAS Suite';
	    if (nodeType.includes('rgthree')) return 'rgthree';
	    if (nodeType.includes('efficiency')) return 'Efficiency';
	    if (nodeType.includes('ComfyUI-Impact-Pack')) return 'Impact Pack';
	    if (nodeType.includes('pysssss')) return 'Custom Scripts';
	    if (nodeType.includes('easy')) return 'EasyUse';
	    if (nodeType.includes('Comfyroll')) return 'Comfyroll Studio';
	    if (nodeType.includes('tinyterra')) return 'TinyTerra';

	    // Check if it's a UUID (custom subgraph)
	    if (this.isUUID(nodeType)) {
	        return 'Custom Subgraph';
	    }

	    return null;
	}

	// Add this helper method to check if a category is a core ComfyUI category
	isCoreComfyUICategory(category) {
	    if (!category) return false;

	    const coreCategories = [
	        'latent', 'conditioning', 'image', 'sampling', 'loaders', 'utils',
	        'mask', 'inpaint', 'model_merging', 'advanced/loaders', 'advanced/conditioning',
	        'latent/advanced', 'image/advanced', 'video', 'essentials'
	    ];

	    const categoryLower = category.toLowerCase();

	    // Check exact matches
	    if (coreCategories.includes(categoryLower)) {
	        return true;
	    }

	    // Check partial matches (for nested categories like "advanced/loaders")
	    for (const coreCat of coreCategories) {
	        if (categoryLower.includes(coreCat) || coreCat.includes(categoryLower)) {
	            return true;
	        }
	    }

	    return false;
	}

	// Helper to check if a string is a UUID
	isUUID(str) {
	    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	    return uuidRegex.test(str);
	}

	getPackAliases(packName) {
	    if (!packName) return 'unknown';

	    const lowerPackName = packName.toLowerCase();

	    // First, check if it's a core ComfyUI category
	    if (this.isCoreComfyUICategory(lowerPackName)) {
	        return 'Core';
	    }

	    const aliasMap = {
	        'pysssss': ['custom scripts', 'custom-scripts', 'pysssss'],
	        'was': ['was suite', 'was', 'wolfang'],
	        'rgthree': ['rgthree', 'rg3'],
	        'efficiency': ['efficiency', 'eff'],
	        'comfyui-manager': ['manager', 'comfyui-manager'],
	        'easyuse': ['easy use', 'easy-use', 'easyuse', 'easy'],
	        'controlnet': ['controlnet', 'control net', 'comfyui_controlnet_aux'],
	        'comfyroll': ['comfyroll studio', 'comfyroll', '🧩 comfyroll studio'],
	        'tinyterra': ['tinyterra', '🌏 tinyterra'],
	        'crystools': ['crystools', 'crystools 🪛'],
	        'impactpack': ['impactpack', 'impact pack', 'comfyui-impact-pack'],
	        'fen': ["fen's simple nodes", 'fens'],
	        'wlsh': ['wlsh nodes', 'wlsh'],
	        'itools': ['itools'],
	        'ollama': ['ollama'],
	        'bootleg': ['bootleg'],
	        'kjnodes': ['kjnodes'],
	        'marigold': ['marigold'],
	        'sam': ['segment_anything2', 'segment anything2'],
	        'depthanything': ['depthanythingv2', 'depthanything']
	    };

	    // First check for exact matches
	    for (const [canonicalName, aliases] of Object.entries(aliasMap)) {
	        if (aliases.includes(lowerPackName)) {
	            return canonicalName;
	        }
	    }

	    // Then check for partial matches
	    for (const [canonicalName, aliases] of Object.entries(aliasMap)) {
	        for (const alias of aliases) {
	            if (lowerPackName.includes(alias) || alias.includes(lowerPackName)) {
	                return canonicalName;
	            }
	        }
	    }

	    // Check if it's a subgraph/custom node
	    if (this.isUUID(lowerPackName)) {
	        return 'Custom Subgraph';
	    }

	    // Return the original pack name if no aliases found
	    return packName;
	}

	checkNodeFilePath(node, term) {
		// Some nodes store file path info that contains pack names
		if (node.constructor?.nodeData?.filename) {
			return node.constructor.nodeData.filename.toLowerCase().includes(term);
		}
		return false;
	}
	
	searchByPack(searchTerm) {
	    const term = searchTerm.toLowerCase().trim();
	    if (!term) {
	        return [];
	    }

	    // Ensure we have a scanned index
	    this.scanWorkflowForPacks();

	    // If we have a pre-scanned index, use it for lightning-fast search
	    if (Object.keys(this.workflowPackIndex).length > 0) {
	        const results = [];
	        const normalizedTerm = this.normalizePackName(term);

	        // Search through our pack index
	        Object.entries(this.workflowPackIndex).forEach(([packName, nodeIds]) => {
	            // Check if pack name matches (case-insensitive, partial match)
	            const packNameLower = packName.toLowerCase();

	            if (packNameLower.includes(normalizedTerm) ||
	                normalizedTerm.includes(packNameLower) ||
	                packNameLower === normalizedTerm) {

	                // Get all nodes for this pack
	                nodeIds.forEach(nodeId => {
	                    const node = this.AF_Find_Nodes_FindNodeById(nodeId);
	                    if (node) {
	                        // Add some metadata for display
	                        node._packSource = packName;
	                        results.push(node);
	                    }
	                });
	            }
	        });

	        if (results.length > 0) {
	            // Sort by node ID for consistency
	            results.sort((a, b) => a.id - b.id);
	            return results;
	        }
	    }

	    // Fallback to original search if index search finds nothing
	    console.log('AF-Find-Nodes: Using fallback pack search');
	    return this.originalSearchByPack(searchTerm);
	}

	// Keep the original search as fallback - add this method AFTER searchByPack:
	originalSearchByPack(searchTerm) {
	    const term = searchTerm.toLowerCase().trim();
	    if (!term) {
	        return [];
	    }

	    if (!app.graph || !app.graph.nodes) {
	        console.warn("AF_Find_Nodes: No graph or nodes available");
	        return [];
	    }

	    const normalizedTerm = this.getPackAliases(term);

	    return app.graph.nodes.filter(node => {
	        const nodeSource = this.getNodeBadgeInfo(node);
	        const nodeType = (node.type || '').toLowerCase();
	        const nodeCnrId = (node.cnr_id || '').toString().toLowerCase();
	        const nodeSourceLower = (nodeSource || '').toLowerCase();

	        return (nodeSource && nodeSourceLower.includes(normalizedTerm)) ||
	               nodeType.includes(normalizedTerm) ||
	               nodeCnrId.includes(normalizedTerm) ||
	               this.checkNodeFilePath(node, normalizedTerm);
	    });
	}

	scanWorkflowForPacks() {
	    if (!app.graph || !app.graph.nodes || app.graph.nodes.length === 0) {
	        this.workflowPackIndex = {};
	        this.workflowTypeIndex = {};
	        this.scanCompleted = false;
	        return;
	    }

	    // Create a simple signature to detect if workflow changed
	    const nodeIds = app.graph.nodes.map(n => n.id).sort();
	    const signature = nodeIds.join('_') + '_' + app.graph.nodes.length;

	    // If signature matches and we already scanned, skip
	    if (signature === this.lastWorkflowSignature && this.scanCompleted) {
	        return;
	    }

	    console.log('AF-Find-Nodes: Scanning workflow for packs/types...');

	    // Reset indices
	    this.workflowPackIndex = {};
	    this.workflowTypeIndex = {};

	    let packCount = 0;
	    let typeCount = 0;
	    let uuidCount = 0;

	    // Quick scan through all nodes
	    app.graph.nodes.forEach(node => {
	        const nodeId = node.id;
	        const nodeType = node.type || 'Unknown';

	        // Index by type (always available)
	        if (!this.workflowTypeIndex[nodeType]) {
	            this.workflowTypeIndex[nodeType] = [];
	            typeCount++;
	        }
	        this.workflowTypeIndex[nodeType].push(nodeId);

	        // Index by pack (our main target)
	        const packInfo = this.getNodeBadgeInfo(node);
	        if (packInfo) {
	            // Use your existing alias system to normalize pack names
	            const normalizedPack = this.getPackAliases(packInfo);

	            // Track UUIDs separately
	            if (this.isUUID(normalizedPack)) {
	                uuidCount++;
	            }

	            if (!this.workflowPackIndex[normalizedPack]) {
	                this.workflowPackIndex[normalizedPack] = [];
	                packCount++;
	            }
	            this.workflowPackIndex[normalizedPack].push(nodeId);
	        }
	    });

	    this.lastWorkflowSignature = signature;
	    this.scanCompleted = true;

	    console.log(`AF-Find-Nodes: Indexed ${packCount} packs and ${typeCount} node types`);
	    if (uuidCount > 0) {
	        console.log(`AF-Find-Nodes: Found ${uuidCount} UUID-based node types`);
	    }
	}
	
	// Helper method to get normalized pack name
	normalizePackName(packName) {
	    if (!packName) return 'unknown';
	    return this.getPackAliases(packName.toLowerCase());
	}

	handleSearchResults(nodes, searchTerm) {
		if (nodes.length === 0) {
			this.showResultsList([], searchTerm);
			this.AF_Find_Nodes_UpdateResults(`No nodes found for "${searchTerm}"`, true);
			return;
		}
		
		this.showResultsList(nodes, searchTerm);
		this.AF_Find_Nodes_AddToHistory(searchTerm);
		
		if (nodes.length === 1) {
			this.selectFromList(nodes[0].id);
			this.AF_Find_Nodes_UpdateResults(`Found: ${this.getNodeDescription(nodes[0])}`);
		} else {
			this.AF_Find_Nodes_UpdateResults(`Found ${nodes.length} nodes. Click any to select.`);
		}
	}

	showResultsList(nodes, searchTerm) {
		let resultsHTML = '';
		
		if (nodes.length === 0) {
			resultsHTML = `<div style="color: #666; font-style: italic;">No nodes found for "${searchTerm}"</div>`;
		} else {
			resultsHTML = `<div style="margin-bottom: 8px; color: #aaa; font-size: 11px;">Found ${nodes.length} nodes:</div>`;
			
			nodes.forEach((node, index) => {
				const isHighlighted = this.highlightedNode && this.highlightedNode.id === node.id;
				const nodeSource = this.getNodeBadgeInfo(node);
				
				resultsHTML += `
					<div class="result-item" 
						 style="padding: 6px; margin: 2px 0; background: ${isHighlighted ? '#ff960033' : '#2a2a2a'}; border: 1px solid ${isHighlighted ? '#ff9600' : '#444'}; border-radius: 3px; cursor: pointer;"
						 onclick="window.AF_Find_Nodes_Widget.selectFromList(${node.id})">
						<div style="font-weight: bold;">[${node.id}] ${node.type || 'Unknown'}</div>
						<div style="font-size: 10px; color: #ccc;">${node.title || 'Untitled'}</div>
						${nodeSource ? `<div style="font-size: 9px; color: ${this.currentTab === 'pack' ? '#ff9800' : '#888'};">Pack: ${nodeSource}</div>` : ''}
					</div>
				`;
			});
		}
		
		const results = document.getElementById('af-find-nodes-results');
		results.innerHTML = resultsHTML;
	}
	
	selectFromList(nodeId) {
		const node = this.AF_Find_Nodes_FindNodeById(nodeId);
		if (node) {
			this.AF_Find_Nodes_HighlightNode(node);
			this.AF_Find_Nodes_CenterOnNode(node);
			this.AF_Find_Nodes_UpdateResults(`Selected: ${this.getNodeDescription(node)}`);
			
			// Keep the list open, just update the selection highlight
			const currentSearch = this.tabInputs.main.value.trim();
			const currentNodes = this.getCurrentSearchResults(currentSearch);
			this.showResultsList(currentNodes, currentSearch);
		}
	}

	getCurrentSearchResults(searchTerm) {
		switch (this.currentTab) {
			case 'id':
				return this.searchById(searchTerm);
			case 'title':
				return this.searchByTitle(searchTerm);
			case 'pack':
				return this.searchByPack(searchTerm);
			case 'type':
				return this.searchByType(searchTerm);
			default:
				return [];
		}
	}

	getNodeDescription(node) {
		return `[${node.id}] ${node.type || 'Unknown Type'}: ${node.title || 'Untitled'}`;
	}

    AF_Find_Nodes_FindNodeById(nodeId) {
        if (!app.graph || !app.graph.nodes) return null;
        return app.graph.nodes.find(node => node.id === nodeId);
    }

    AF_Find_Nodes_HighlightNode(node) {
        this.AF_Find_Nodes_ClearHighlight();
        
        // Store original color
        this.originalNodeColors.set(node.id, {
            color: node.color,
            bgcolor: node.bgcolor
        });

        // Apply highlight
        node.color = '#ff9600';
        node.bgcolor = '#ff960033';
        
        this.highlightedNode = node;
        app.graph.setDirtyCanvas(true, true);
    }

    AF_Find_Nodes_ClearHighlight() {
        if (this.highlightedNode) {
            const original = this.originalNodeColors.get(this.highlightedNode.id);
            if (original) {
                this.highlightedNode.color = original.color;
                this.highlightedNode.bgcolor = original.bgcolor;
            }
            this.originalNodeColors.delete(this.highlightedNode.id);
            this.highlightedNode = null;
            app.graph.setDirtyCanvas(true, true);
        }
    }

	AF_Find_Nodes_ClearAll() {
		// Clear the search field
		const input = document.getElementById('af-find-nodes-input');
		if (input) {
			input.value = '';
		}
		// Clear highlight
		this.AF_Find_Nodes_ClearHighlight();
		// Clear results display but keep the container visible
		this.showResultsList([], '');
		this.AF_Find_Nodes_UpdateResults('Search field cleared.');
	}

	AF_Find_Nodes_CenterOnNode(node) {
		if (!app.canvas || !node) return;
		
		try {
			// Clear current selection
			app.canvas.deselectAllNodes();
			
			// Select the target node
			node.is_selected = true;
			app.canvas.selectNode(node);
			
			// Reset zoom to a reasonable level for viewing
			const targetScale = 1.0; // or 1.2 for a bit closer
			app.canvas.ds.scale = targetScale;
			
			// Center on the node
			const canvas = app.canvas;
			const nodeWidth = node.size[0];
			const nodeHeight = node.size[1];
			const nodeCenterX = node.pos[0] + (nodeWidth / 2);
			const nodeCenterY = node.pos[1] + (nodeHeight / 2);
			
			canvas.ds.offset[0] = (canvas.canvas.width / 2) - (nodeCenterX * canvas.ds.scale);
			canvas.ds.offset[1] = (canvas.canvas.height / 2) - (nodeCenterY * canvas.ds.scale);
			
			app.graph.setDirtyCanvas(true, true);
		} catch (error) {
			console.warn("AF_Find_Nodes: Could not center on node, using fallback", error);
			// Simple fallback
			const canvas = app.canvas;
			canvas.ds.offset[0] = -node.pos[0] * canvas.ds.scale;
			canvas.ds.offset[1] = -node.pos[1] * canvas.ds.scale;
			canvas.setDirty(true, true);
		}
	}

    AF_Find_Nodes_ToggleInspector() {
        this.AF_Find_Nodes_SetInspectorMode(!this.inspectorMode);
        // Fix width when toggling inspector
        /* if (this.searchPanel) {
            this.searchPanel.style.width = '340px';
        } */
    }

    AF_Find_Nodes_SetInspectorMode(enabled) {
        if (enabled && this.currentTab !== 'id') {
            this.switchTab('id');
        }

        this.inspectorMode = enabled;
        const btn = document.getElementById('af-find-nodes-inspector-toggle');
        if (btn) {
            btn.style.background = enabled ? '#ff9800' : '#2196F3';
            btn.textContent = enabled ? 'Exit Inspector' : 'Inspector';
        }

        // Setup or cleanup selection monitor
        this.setupSelectionMonitor();

        if (enabled) {
            this.AF_Find_Nodes_UpdateResults('Inspector mode active. Click any node to see its ID.');
        } else {
            this.AF_Find_Nodes_UpdateResults('Inspector mode disabled.');
        }
    }

    AF_Find_Nodes_HandleNodeClick(node) {
        if (this.inspectorMode && node) {
            const input = document.getElementById('af-find-nodes-input');
            if (input) {
                input.value = node.id.toString();
            }
            this.AF_Find_Nodes_HighlightNode(node);
            this.AF_Find_Nodes_AddToHistory(node.id);
            this.AF_Find_Nodes_UpdateResults(`Selected node ${node.id}: ${node.type || 'Unknown Type'}`);
        }
    }

	AF_Find_Nodes_AddToHistory(searchTerm) {
		const history = this.tabHistory[this.currentTab];
		
		// Remove if already exists
		this.tabHistory[this.currentTab] = history.filter(item => item !== searchTerm);
		
		// Add to front
		this.tabHistory[this.currentTab].unshift(searchTerm);
		
		// Limit size
		if (this.tabHistory[this.currentTab].length > this.maxHistory) {
			this.tabHistory[this.currentTab] = this.tabHistory[this.currentTab].slice(0, this.maxHistory);
		}
		
		// Save to localStorage
		localStorage.setItem(`af-find-node-history-${this.currentTab}`, JSON.stringify(this.tabHistory[this.currentTab]));
		
		this.AF_Find_Nodes_UpdateHistory();
	}

	AF_Find_Nodes_UpdateHistory() {
		const historyContainer = document.getElementById('af-find-nodes-history');
		if (!historyContainer) return;

		historyContainer.innerHTML = '';
		
		const currentHistory = this.tabHistory[this.currentTab];
		
		currentHistory.forEach(item => {
			const historyBtn = document.createElement('button');
			historyBtn.textContent = item;
			historyBtn.style.cssText = `
				background: #444;
				border: none;
				color: #fff;
				padding: 2px 6px;
				border-radius: 3px;
				cursor: pointer;
				font-size: 10px;
				margin: 1px;
			`;
			historyBtn.onclick = () => {
				this.tabInputs.main.value = item;
				this.AF_Find_Nodes_Search();
			};
			historyContainer.appendChild(historyBtn);
		});
		
		if (currentHistory.length === 0) {
			const noHistory = document.createElement('div');
			noHistory.textContent = 'No recent searches';
			noHistory.style.cssText = 'color: #666; font-size: 10px; font-style: italic;';
			historyContainer.appendChild(noHistory);
		}
	}
	
	AF_Find_Nodes_UpdateResults(message, isError = false) {
		const status = document.getElementById('af-find-nodes-status');
		if (status) {
			status.innerHTML = message;
			status.style.color = isError ? '#ff6b6b' : '#aaa';  /// Red for errors, white otherwise
		}
	}

    // Keyboard shortcut handler
    AF_Find_Nodes_HandleKeyboard(event) {
        // Ctrl+Shift+F to toggle search panel
        if (event.ctrlKey && event.shiftKey && event.code === 'KeyF') {
            event.preventDefault();
            this.AF_Find_Nodes_TogglePanel();
        }
        // Escape to close panel
        if (event.code === 'Escape' && this.isVisible) {
            event.preventDefault();
            this.AF_Find_Nodes_HidePanel();
        }
    }

    searchByType(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            return [];
        }

        // Ensure we have a scanned index
        this.scanWorkflowForPacks();

        // Use pre-scanned index if available
        if (Object.keys(this.workflowTypeIndex).length > 0) {
            const results = [];

            // Search through our type index
            Object.entries(this.workflowTypeIndex).forEach(([nodeType, nodeIds]) => {
                if (nodeType.toLowerCase().includes(term)) {
                    nodeIds.forEach(nodeId => {
                        const node = this.AF_Find_Nodes_FindNodeById(nodeId);
                        if (node) {
                            results.push(node);
                        }
                    });
                }
            });

            if (results.length > 0) {
                results.sort((a, b) => a.id - b.id);
                return results;
            }
        }

        // Fallback to original type search
        return app.graph.nodes.filter(node => {
            const nodeType = node.type || '';
            return nodeType.toLowerCase().includes(term);
        });
    }
}

// Initialize the search widget with guard against double initialization
window.AF_Find_Nodes_Widget = new AF_Find_Nodes_Widget();

// Register the extension - SAFE VERSION with NO overrides
app.registerExtension({
    name: "AF-Find-Nodes",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // We don't need to modify node definitions
    },

    async setup() {
        // Add keyboard event listeners
        document.addEventListener('keydown', (e) => {
            window.AF_Find_Nodes_Widget.AF_Find_Nodes_HandleKeyboard(e);
        });

        console.log("AF - Find Nodes extension loaded. Use Ctrl+Shift+F to open search panel.");

        // Start workflow monitoring when extension loads (but only scans when needed)
        window.AF_Find_Nodes_Widget.startWorkflowMonitor();
    },

    async destroyed() {
        // Clean up all intervals and timeouts
        if (window.AF_Find_Nodes_Widget) {
            window.AF_Find_Nodes_Widget.stopWorkflowMonitor();

            // Clean up selection interval if it exists
            if (window.AF_Find_Nodes_Widget.selectionInterval) {
                clearInterval(window.AF_Find_Nodes_Widget.selectionInterval);
                window.AF_Find_Nodes_Widget.selectionInterval = null;
            }
        }
    }
});

} // End of guard against double initialization
