// ****** ComfyUI-AF-Find Nodes ******
//
// Creator: Alex Furer - Co-Creator(s): Claude AI & QWEN3 Coder & DeepSeek
//
// Praise, comment, bugs, improvements: https://github.com/alFrame/ComfyUI-AF-Find-Nodes
//
// LICENSE: MIT License
//
// v0.0.06
//
// Description:
// A ComfyUI utility extension for finding nodes by ID, title, pack, or type in workflows.
//
// Usage:
// Read Me on Github
//
// Changelog:
// "v0.0.06 - Cosmetics, making this a version",
// "v0.0.05 - Renamed the project from "AF - Find Node By ID" to "AF - Find Nodes"",
// "v0.0.04 - Added tabs to search by ID, by Title, by Pack, by Type. Search 'By Pack' and 'By Type' are experimental features. Due to inconsistencies in how nodes are coded and distributed across different packs, these searches may produce unexpected results or false positives. Use with caution !!",
// "v0.0.03 - Clear button now also clears the search field. Dialog content cleared when closed or opened. Error messages in red. Fixed dialog width to 340px",
// "v0.0.02 - Fixed double initialization error. Removed right-click on canvas to trigger the dialog. Fixed zooming in to node",
// "v0.0.01 - Initial Version"
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
		this.experimentalEnabled = localStorage.getItem('af-find-node-experimental') === 'true'; // ← Change to ONLY true if explicitly set
		
		// Remember last tab state - default to 'id' if not set
		this.currentTab = localStorage.getItem('af-find-node-last-tab') || 'id';
		this.tabInputs = {};
		this.tabHistory = { 
			id: JSON.parse(localStorage.getItem('af-find-node-history-id') || '[]'),
			title: JSON.parse(localStorage.getItem('af-find-node-history-title') || '[]'),
			pack: JSON.parse(localStorage.getItem('af-find-node-history-pack') || '[]'),
			type: JSON.parse(localStorage.getItem('af-find-node-history-type') || '[]')
		};
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
            width: 380px;  /* Fixed width */
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
			{ id: 'type', name: '🔎 By Type', placeholder: 'Search node types (e.g., KSampler, CLIPTextEncode)' }
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
				'Experimental features enabled. Use with caution!' : 
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
			max-height: 200px;
			overflow-y: auto;
			background: #1a1a1a;
			border: 1px solid #555;
			border-radius: 4px;
			padding: 8px;
			margin-bottom: 10px;
			min-height: 40px; // Ensure it's always visible
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
		
		// Clear previous results, input, and highlight
		this.tabInputs.main.value = '';
		this.AF_Find_Nodes_ClearHighlight();
		this.showResultsList([], '');  // Clear the results list
		this.AF_Find_Nodes_UpdateResults(`Switched to ${tabConfig.name} search. Ready to search.`);
		
		// Update history for current tab
		this.AF_Find_Nodes_UpdateHistory();
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
			const isActive = tabId === this.currentTab;
			
			btn.style.background = isActive ? (isExperimental ? '#7a4a1a' : '#555') : (isExperimental ? '#5a2a0a' : '#333');
			btn.style.borderBottom = isActive ? (isExperimental ? '2px solid #ff9800' : '2px solid #4CAF50') : 'none';
			btn.style.opacity = isExperimental && !this.experimentalEnabled ? '0.6' : '1';
		});
	}

	AF_Find_Nodes_ShowPanel() {
		if (!this.searchPanel) {
			this.createSearchPanel();
		}
		this.searchPanel.style.display = 'block';
		this.isVisible = true;
		
		// Set to remembered tab instead of always 'id'
		this.switchTab(this.currentTab);
		
		// Clear the search field when dialog is shown but keep results
		document.getElementById('af-find-nodes-input').value = '';
		document.getElementById('af-find-nodes-input').focus();
		
		// Update tab appearance to reflect experimental setting
		this.updateTabAppearance();  // Add this line
	}

    AF_Find_Nodes_HidePanel() {
        if (this.searchPanel) {
            this.searchPanel.style.display = 'none';
        }
        this.isVisible = false;
        this.AF_Find_Nodes_ClearAll();
        this.AF_Find_Nodes_SetInspectorMode(false);
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
				return nodeDef.category;
			}
			if (nodeDef?.name) {
				return nodeDef.name;
			}
		}
		
		// Check node constructor properties
		if (node.constructor?.nodeData?.category) {
			return node.constructor.nodeData.category;
		}
		if (node.constructor?.category) {
			return node.constructor.category;
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
		
		return null;
	}

	getPackAliases(packName) {
		const aliasMap = {
			'pysssss': ['custom scripts', 'custom-scripts', 'pysssss'],
			'was': ['was suite', 'was', 'wolfang'],
			'rgthree': ['rgthree', 'rg3'],
			'efficiency': ['efficiency', 'eff'],
			'comfyui-manager': ['manager', 'comfyui-manager'],
			'easyuse': ['easy use', 'easy-use', 'easyuse', 'easy'],
			'controlnet': ['controlnet', 'control net', 'comfyui_controlnet_aux']  // Add this
		};
		
		const searchTerm = packName.toLowerCase();
		
		// First check for exact matches
		for (const [canonicalName, aliases] of Object.entries(aliasMap)) {
			if (aliases.includes(searchTerm)) {
				return canonicalName;
			}
		}
		
		// Then check for partial matches (if the search term is part of any alias)
		for (const [canonicalName, aliases] of Object.entries(aliasMap)) {
			for (const alias of aliases) {
				if (alias.includes(searchTerm) || searchTerm.includes(alias)) {
					return canonicalName;
				}
			}
		}
		
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
		
		if (!app.graph || !app.graph.nodes) {
			console.warn("AF_Find_Nodes: No graph or nodes available");
			return [];
		}
		
		// Use aliases to normalize the search term
		const normalizedTerm = this.getPackAliases(term);
		
		console.log("Pack search - original:", searchTerm, "normalized:", normalizedTerm);
		
		return app.graph.nodes.filter(node => {
			// Get node category/source from multiple possible locations
			const nodeSource = this.getNodeBadgeInfo(node);
			
			// Also check the node type which often contains pack info
			const nodeType = (node.type || '').toLowerCase();
			
			// Check pack-specific identifiers
			const nodeCnrId = (node.cnr_id || '').toString().toLowerCase();
			
			// Make ALL comparisons case-insensitive by converting to lowercase
			const nodeSourceLower = (nodeSource || '').toLowerCase();
			
			// ONLY check pack-related fields, not title or name!
			// REMOVED: any checks for node.title, node.name, etc.
			return (nodeSource && nodeSourceLower.includes(normalizedTerm)) ||
				   nodeType.includes(normalizedTerm) ||
				   nodeCnrId.includes(normalizedTerm) ||
				   this.checkNodeFilePath(node, normalizedTerm);
		});
	}
	
	searchByType(searchTerm) {
		const term = searchTerm.toLowerCase().trim();
		if (!term) {
			return [];
		}
		
		if (!app.graph || !app.graph.nodes) {
			return [];
		}
		
		return app.graph.nodes.filter(node => {
			const nodeType = node.type || '';
			return nodeType.toLowerCase().includes(term);
		});
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
						${nodeSource ? `<div style="font-size: 9px; color: #888;">Source: ${nodeSource}</div>` : ''}
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
			status.textContent = message;
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
}

// Initialize the search widget with guard against double initialization
window.AF_Find_Nodes_Widget = new AF_Find_Nodes_Widget();

// Register the extension
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

        // Hook into node selection changes for inspector mode
        let lastSelectedNodes = [];
        
        // Monitor for node selection changes
        const checkNodeSelection = () => {
            if (!window.AF_Find_Nodes_Widget.inspectorMode) return;
            
            const currentSelected = app.canvas.selected_nodes;
            if (!currentSelected || Object.keys(currentSelected).length === 0) return;
            
            // Get the first selected node
            const nodeId = Object.keys(currentSelected)[0];
            const node = currentSelected[nodeId];
            
            if (node && !lastSelectedNodes.includes(node.id)) {
                window.AF_Find_Nodes_Widget.AF_Find_Nodes_HandleNodeClick(node);
                lastSelectedNodes = [node.id];
            }
        };
        
		// Check selection periodically when inspector is active
		let selectionInterval = null;

		// In the setup() function, replace the setInterval with:
		const setupSelectionMonitor = () => {
			if (window.AF_Find_Nodes_Widget.inspectorMode && !selectionInterval) {
				selectionInterval = setInterval(() => {
					checkNodeSelection();
				}, 300); // Reduced from 100ms to 300ms
			} else if (!window.AF_Find_Nodes_Widget.inspectorMode && selectionInterval) {
				clearInterval(selectionInterval);
				selectionInterval = null;
				lastSelectedNodes = [];
			}
		};

		// Monitor inspector mode changes
		const originalSetInspectorMode = window.AF_Find_Nodes_Widget.AF_Find_Nodes_SetInspectorMode;
		window.AF_Find_Nodes_Widget.AF_Find_Nodes_SetInspectorMode = function(enabled) {
			originalSetInspectorMode.call(this, enabled);
			setupSelectionMonitor();
		};

        // Also try hooking into the canvas click event
        const canvas = app.canvas.canvas;
		
		let lastInspectorClick = 0;
		canvas.addEventListener('click', (e) => {
			if (!window.AF_Find_Nodes_Widget.inspectorMode) return;
			
			// Debounce clicks to prevent multiple rapid triggers
			const now = Date.now();
			if (now - lastInspectorClick < 200) return; // 200ms debounce
			lastInspectorClick = now;
			
			// Only proceed if we're actually in inspector mode
			if (!window.AF_Find_Nodes_Widget.inspectorMode) return;
			
			// Get canvas coordinates
			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			
			// Convert to canvas coordinates
			const canvasX = (x - app.canvas.ds.offset[0]) / app.canvas.ds.scale;
			const canvasY = (y - app.canvas.ds.offset[1]) / app.canvas.ds.scale;
			
			// Find node at position
			const node = app.graph.getNodeOnPos(canvasX, canvasY);
			
			if (node) {
				window.AF_Find_Nodes_Widget.AF_Find_Nodes_HandleNodeClick(node);
				e.stopPropagation();
			}
		}, true);

        console.log("AF - Find Nodes extension loaded. Use Ctrl+Shift+F to open search panel.");
    },

    async destroyed() {
        // Clean up interval when extension is destroyed
        if (selectionInterval) {
            clearInterval(selectionInterval);
            selectionInterval = null;
        }
    }
});

} // End of guard against double initialization