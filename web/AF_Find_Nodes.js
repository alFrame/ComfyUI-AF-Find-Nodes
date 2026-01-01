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
/*
 * Copyright (C) 2025 Alex Furer
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

// Prevent double initialization
if (window.AF_Find_Nodes_Widget) {
    // console.log("AF - Find Nodes already loaded, skipping initialization");
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
        // NOTE: Automatic monitoring disabled - scanning happens on-demand only
        this.lastNodeCount = 0;
        this.selectionInterval = null;
        this.lastSelectedNodes = [];
        // Updates tab state
        this.updateableNodes = [];
        this.selectedUpdates = new Set();
        this.autoBackupEnabled = localStorage.getItem('af-find-node-auto-backup') !== 'false';
        this.collapsedPacks = new Set();
        this.collapsedStatsPacks = new Set(); // Track collapsed packs in Stats tab
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

    // ========== WORKFLOW CHANGE DETECTION (KISS) ==========
    getCurrentWorkflowSignature() {
        if (!app.graph?.nodes) return null;
        const nodeIds = app.graph.nodes.map(n => n.id).sort();
        return nodeIds.join('_') + '_' + app.graph.nodes.length;
    }

    isWorkflowChanged() {
        const currentSig = this.getCurrentWorkflowSignature();
        return currentSig !== this.lastWorkflowSignature;
    }

    invalidateScanCache() {
        this.workflowPackIndex = {};
        this.workflowTypeIndex = {};
        this.lastWorkflowSignature = null;
        this.scanCompleted = false;
    }

    // DEPRECATED: Automatic workflow monitoring disabled
    // Scanning now happens on-demand only when tabs are opened
    // This prevents cross-tab contamination issues
    startWorkflowMonitor() {
        // No longer starts automatic monitoring
        return;

        /* DISABLED CODE - kept for reference
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
        */ // END DISABLED CODE
    }

    // DEPRECATED: No longer needed with on-demand scanning
    stopWorkflowMonitor() {
        // No-op - monitoring is disabled
        return;

        /* DISABLED CODE
        if (this.workflowMonitorInterval) {
            clearInterval(this.workflowMonitorInterval);
            this.workflowMonitorInterval = null;
        }
        if (this.workflowScanTimeout) {
            clearTimeout(this.workflowScanTimeout);
            this.workflowScanTimeout = null;
        }
        */ // END DISABLED CODE
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
            width: 500px;  /* Fixed width */
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
            { id: 'stats', name: '📊 Stats', placeholder: 'Workflow statistics and pack overview' },
            { id: 'updates', name: '🔄 Updates', placeholder: 'Check for node version updates' }
            ];

        this.tabInputs = {};

        // Create tab buttons
        this.tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.textContent = tab.name;
            tabBtn.dataset.tab = tab.id;

            const isExperimental = tab.id === 'pack' || tab.id === 'type';
            const isStats = tab.id === 'stats' || tab.id === 'updates';
            const isActive = tab.id === this.currentTab;

            tabBtn.style.cssText = `
                flex: 1;
                padding: 6px 4px;
                background: ${isActive ? (isExperimental ? '#7a4a1a' : (isStats ? '#2a4a7a' : '#555')) : (isExperimental ? '#5a2a0a' : (isStats ? '#1a2a5a' : '#333'))};
                border: none;
                border-bottom: ${isActive ? (isExperimental ? '2px solid #ff9800' : (isStats ? '2px solid #4da6ff' : '2px solid #4CAF50')) : 'none'};
                border-right: 1px solid #666;
                color: white;
                cursor: pointer;
                font-size: 10px;
                border-radius: 0;
                opacity: ${isExperimental && !this.experimentalEnabled ? '0.6' : '1'};
            `;

            // Remove right border from last tab
            if (tab.id === 'updates') {
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

        // Hide search input and entire button row for stats/updates tabs
        const searchInput = document.getElementById('af-find-nodes-input');
        const buttonRow = searchInput?.nextElementSibling; // The div containing Find/Clear/Inspector buttons

        if (tabId === 'stats' || tabId === 'updates') {
            if (searchInput) searchInput.style.display = 'none';
            if (buttonRow) buttonRow.style.display = 'none';
        } else {
            if (searchInput) searchInput.style.display = 'block';
            if (buttonRow) buttonRow.style.display = 'flex';
            // Update inspector button visibility for other tabs
            this.updateInspectorButtonVisibility();
        }

        // Clear previous results, input, and highlight (but not for stats/updates)
        if (tabId !== 'stats' && tabId !== 'updates') {
            this.tabInputs.main.value = '';
            this.AF_Find_Nodes_ClearHighlight();
        }

        // Check for workflow changes before showing tab content
        if (tabId === 'pack' || tabId === 'type' || tabId === 'stats') {
            if (this.isWorkflowChanged()) {
                this.invalidateScanCache();
                console.log('AF-Find-Nodes: Workflow changed - cache invalidated');
            }
        }

        // Handle tab-specific content
        if (tabId === 'stats') {
            this.showWorkflowStats();
        } else if (tabId === 'updates') {
            this.showUpdatesTab();
            this.AF_Find_Nodes_UpdateResults('Ready to scan for node updates.');
        } else if (tabId === 'pack' || tabId === 'type') {
            // Show scan prompt if not scanned
            if (!this.scanCompleted) {
                this.showScanPrompt(tabId);
            } else {
                this.showResultsList([], '');
                this.AF_Find_Nodes_UpdateResults(`Switched to ${tabConfig.name} search. Ready to search.`);
            }
        } else {
            this.showResultsList([], '');  // Clear the results list
            this.AF_Find_Nodes_UpdateResults(`Switched to ${tabConfig.name} search. Ready to search.`);
        }

        // Update history for current tab (not for stats)
        if (tabId !== 'stats' && tabId !== 'updates') {
            this.AF_Find_Nodes_UpdateHistory();
        }

        // Hide/show history section - find the parent div that contains both title and list
        const historyList = document.getElementById('af-find-nodes-history');
        if (historyList && historyList.parentElement) {
            historyList.parentElement.style.display = (tabId === 'stats' || tabId === 'updates') ? 'none' : 'block';
        }
    }

    // Show scan prompt for Pack/Type tabs when workflow not scanned
    showScanPrompt(tabId) {
        const results = document.getElementById('af-find-nodes-results');
        const tabName = tabId === 'pack' ? 'Pack' : 'Type';

        results.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="color: #ff9800; margin-bottom: 15px; font-size: 13px;">
                    ⚠️ Workflow not scanned
                </div>
                <div style="color: #aaa; margin-bottom: 20px; font-size: 11px; line-height: 1.6;">
                    Click the button below to scan your workflow and index all ${tabName.toLowerCase()}s.
                    This will enable fast searching.
                </div>
                <button onclick="window.AF_Find_Nodes_Widget.performWorkflowScan()"
                        style="padding: 12px 24px; background: #4CAF50; border: none;
                               border-radius: 4px; color: white; cursor: pointer; font-size: 12px;
                               font-weight: bold;">
                    🔍 Scan Workflow
                </button>
            </div>
        `;

        this.AF_Find_Nodes_UpdateResults(`Click "Scan Workflow" to index your workflow for ${tabName} search.`);
    }

    // Perform workflow scan (user-triggered)
    performWorkflowScan() {
        const results = document.getElementById('af-find-nodes-results');
        results.innerHTML = '<div style="color: #ff9800; padding: 20px; text-align: center;">⏳ Scanning workflow...</div>';

        // Use setTimeout to show the loading message
        setTimeout(() => {
            this.scanWorkflowForPacks();

            if (this.scanCompleted) {
                const packCount = Object.keys(this.workflowPackIndex).length;
                const typeCount = Object.keys(this.workflowTypeIndex).length;
                const totalNodes = app.graph?.nodes?.length || 0;

                results.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <div style="color: #4CAF50; margin-bottom: 15px; font-size: 13px;">
                            ✅ Scan Complete!
                        </div>
                        <div style="color: #aaa; font-size: 11px; line-height: 1.6;">
                            Indexed ${totalNodes} nodes<br>
                            Found ${packCount} packs and ${typeCount} node types<br><br>
                            You can now search by pack or type.
                        </div>
                        <button onclick="window.AF_Find_Nodes_Widget.performWorkflowScan()"
                                style="margin-top: 15px; padding: 8px 16px; background: #555; border: none;
                                       border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                            🔄 Re-scan Workflow
                        </button>
                    </div>
                `;

                this.AF_Find_Nodes_UpdateResults(`✅ Indexed ${packCount} packs and ${typeCount} types from ${totalNodes} nodes.`);
                console.log(`AF-Find-Nodes: Scan complete - ${packCount} packs, ${typeCount} types, ${totalNodes} nodes`);
            } else {
                results.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #ff6b6b;">
                        ❌ Scan failed - No workflow loaded
                    </div>
                `;
                this.AF_Find_Nodes_UpdateResults('No workflow loaded.', true);
            }
        }, 100);
    }

    showWorkflowStats() {
        // Check if workflow needs scanning
        if (!this.scanCompleted) {
            const results = document.getElementById('af-find-nodes-results');
            results.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <div style="color: #ff9800; margin-bottom: 15px; font-size: 13px;">
                        ⚠️ Workflow not scanned
                    </div>
                    <div style="color: #aaa; margin-bottom: 20px; font-size: 11px; line-height: 1.6;">
                        Click the button below to scan your workflow and generate statistics.
                    </div>
                    <button onclick="window.AF_Find_Nodes_Widget.performWorkflowScan()"
                            style="padding: 12px 24px; background: #4CAF50; border: none;
                                   border-radius: 4px; color: white; cursor: pointer; font-size: 12px;
                                   font-weight: bold;">
                        🔍 Scan Workflow
                    </button>
                </div>
            `;
            this.AF_Find_Nodes_UpdateResults('Click "Scan Workflow" to generate workflow statistics.');
            return;
        }

        const totalNodes = app.graph?.nodes?.length || 0;
        const packCount = Object.keys(this.workflowPackIndex).length;
        const typeCount = Object.keys(this.workflowTypeIndex).length;

        // Organize packs by node count
        const allPacks = Object.entries(this.workflowPackIndex)
            .map(([pack, nodeIds]) => ({
                pack,
                count: nodeIds.length,
                percentage: Math.round((nodeIds.length / totalNodes) * 100),
                isCore: pack === 'Core' || pack.toLowerCase().includes('core'),
                nodeIds: nodeIds
            }));

        const corePacks = allPacks.filter(p => p.isCore);
        const customPacks = allPacks.filter(p => !p.isCore);
        const sortedCustomPacks = customPacks.sort((a, b) => b.count - a.count);
        const sortedAllPacks = [...sortedCustomPacks, ...corePacks];

        // Build stats HTML
        let statsHTML = `
            <div style="padding: 8px;">
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

                <!-- Re-scan Button -->
                <div style="margin-bottom: 15px;">
                    <button onclick="window.AF_Find_Nodes_Widget.performWorkflowScan()"
                            style="width: 100%; padding: 8px; background: #555; border: none;
                                   border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                        🔄 Re-scan Workflow
                    </button>
                </div>

                <!-- Quick Export Buttons -->
                <div style="margin-bottom: 15px; padding: 10px; background: #1a2a3a; border-radius: 6px; border: 1px solid #444;">
                    <div style="color: #aaa; margin-bottom: 8px; font-size: 11px; text-align: center;">
                        ⚡ Quick Export
                    </div>
                    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                        <button onclick="window.AF_Find_Nodes_Widget.exportPackList()"
                                style="flex: 1; padding: 8px; background: #7a4a1a; border: none;
                                       border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                            📋 Packs
                        </button>
                        <button onclick="window.AF_Find_Nodes_Widget.copyNodeTypes(false)"
                                style="flex: 1; padding: 8px; background: #2a4a7a; border: none;
                                       border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                            📝 Types
                        </button>
                        <button onclick="window.AF_Find_Nodes_Widget.copyNodeTypes(true)"
                                style="flex: 1; padding: 8px; background: #3a2a5a; border: none;
                                       border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                            📝 All
                        </button>
                    </div>
                    <div style="font-size: 10px; color: #666; text-align: center; margin-top: 4px;">
                        Copy lists for documentation
                    </div>
                </div>

                <div style="color: #aaa; margin-bottom: 10px; font-size: 11px; border-bottom: 1px solid #444; padding-bottom: 5px;">
                    📦 Node Packs (${sortedAllPacks.length}) - Click to expand
                </div>
            </div>

            <!-- Scrollable pack list -->
            <div style="max-height: 500px; overflow-y: auto; padding: 0 8px 8px 8px;">
        `;

        // Build collapsible pack list
        sortedAllPacks.forEach(({ pack, count, percentage, isCore, nodeIds }) => {
            const isCollapsed = this.collapsedStatsPacks ? !this.collapsedStatsPacks.has(pack) : true;

            statsHTML += `
                <div style="margin-bottom: 8px; border: 1px solid ${isCore ? '#2196F3' : '#444'}; border-radius: 4px; overflow: hidden;">
                    <div onclick="window.AF_Find_Nodes_Widget.toggleStatsPackCollapse('${pack.replace(/'/g, "\\'")}')"
                         style="background: ${isCore ? '#2a3a4a' : '#2a2a2a'}; padding: 10px; cursor: pointer;
                                display: flex; justify-content: space-between; align-items: center;
                                border-bottom: ${isCollapsed ? 'none' : '1px solid #444'};">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 12px;">${isCollapsed ? '▶' : '▼'}</span>
                            <span style="color: ${isCore ? '#4da6ff' : '#ccc'}; font-weight: bold;">
                                📦 ${pack} ${isCore ? '🔧' : ''}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 11px; color: #4CAF50;">
                                ${count} node${count !== 1 ? 's' : ''}
                            </span>
                            <span style="font-size: 10px; color: #666;">
                                ${percentage}%
                            </span>
                        </div>
                    </div>
                    <div id="af-stats-pack-${pack.replace(/\s/g, '-').replace(/'/g, '')}"
                         style="display: ${isCollapsed ? 'none' : 'block'}; background: #1a1a1a;">
            `;

            // Add nodes for this pack
            nodeIds.forEach(nodeId => {
                const node = this.AF_Find_Nodes_FindNodeById(nodeId);
                if (node) {
                    statsHTML += `
                        <div style="padding: 6px 12px; border-bottom: 1px solid #333; font-size: 11px; cursor: pointer;"
                             onclick="window.AF_Find_Nodes_Widget.selectAndCenterNode(${nodeId})">
                            <span style="color: #4da6ff;">[${nodeId}]</span>
                            <span style="color: #ccc;"> ${node.type}</span>
                            ${node.title ? `<span style="color: #888; font-size: 10px;"> - ${node.title}</span>` : ''}
                        </div>
                    `;
                }
            });

            statsHTML += `
                    </div>
                </div>
            `;
        });

        statsHTML += `</div>`;

        const results = document.getElementById('af-find-nodes-results');
        results.innerHTML = statsHTML;
    }

    // Add method to track collapsed packs for stats tab
    toggleStatsPackCollapse(pack) {
        if (!this.collapsedStatsPacks) {
            this.collapsedStatsPacks = new Set();
        }

        if (this.collapsedStatsPacks.has(pack)) {
            this.collapsedStatsPacks.delete(pack);
        } else {
            this.collapsedStatsPacks.add(pack);
        }
        this.showWorkflowStats();
    }

    // Add method for selecting and centering nodes (reusable)
    selectAndCenterNode(nodeId) {
        const node = this.AF_Find_Nodes_FindNodeById(nodeId);
        if (node) {
            app.canvas.deselectAllNodes();
            node.is_selected = true;
            app.canvas.selectNode(node);
            this.AF_Find_Nodes_CenterOnNode(node);
        }
    }

    // ========== UPDATES TAB ==========

    showUpdatesTab() {
        const results = document.getElementById('af-find-nodes-results');

        // Set overflow to hidden since we'll manage scroll internally
        results.style.overflow = 'hidden';
        results.style.display = 'flex';
        results.style.flexDirection = 'column';
        results.style.padding = '0';

        let html = `
            <!-- Fixed header section (non-scrollable) -->
            <div style="padding: 8px; flex-shrink: 0;">
                <div style="color: #4CAF50; margin-bottom: 15px; font-size: 12px; font-weight: bold;">
                    🔄 Node Version Updates
                </div>

                <div style="margin-bottom: 15px;">
                    <button onclick="window.AF_Find_Nodes_Widget.performUpdateScan()"
                            style="width: 100%; padding: 10px; background: #4CAF50; border: none;
                                   border-radius: 4px; color: white; cursor: pointer; font-size: 12px;
                                   font-weight: bold;">
                        🔍 Scan for Updates
                    </button>
                </div>
            </div>

            <!-- Scrollable results container -->
            <div id="af-updates-scan-results" style="flex: 1; overflow-y: auto; padding: 0 8px 8px 8px;">
                <div style="min-height: 100px; color: #aaa; text-align: center; padding: 20px;">
                    Click "Scan for Updates" to check for node version updates in your workflow.
                </div>
            </div>
        `;

        results.innerHTML = html;
    }

    performUpdateScan() {
        const resultsContainer = document.getElementById('af-updates-scan-results');
        resultsContainer.innerHTML = '<div style="color: #ff9800; padding: 20px;">⏳ Scanning workflow...</div>';

        setTimeout(() => {
            this.updateableNodes = this.scanForUpdates();
            this.selectedUpdates.clear();

            if (this.updateableNodes.length === 0) {
                resultsContainer.innerHTML = `
                    <div style="color: #4CAF50; padding: 20px;">
                        ✅ All nodes are up to date!<br>
                        <span style="font-size: 10px; color: #888;">No updates found.</span>
                    </div>
                `;
                this.AF_Find_Nodes_UpdateResults('✅ No updates found - all nodes are current.');
                return;
            }

            this.displayUpdateableNodes();
            this.AF_Find_Nodes_UpdateResults(`Found ${this.updateableNodes.length} node(s) with available updates.`);
        }, 100);
    }

    displayUpdateableNodes() {
        const byPack = {};
        this.updateableNodes.forEach(nodeInfo => {
            if (!byPack[nodeInfo.pack]) {
                byPack[nodeInfo.pack] = [];
            }
            byPack[nodeInfo.pack].push(nodeInfo);
        });

        // Get both containers
        const mainResults = document.getElementById('af-find-nodes-results');
        const scrollContainer = document.getElementById('af-updates-scan-results');

        // Build the fixed header content (goes in main results, above scroll)
        let fixedHeaderHTML = `
            <div style="padding: 0 8px; flex-shrink: 0;">
                <div style="background: #2a2a2a; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #ff9800;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Updates Available:</span>
                        <span style="color: #ff9800; font-weight: bold;">${this.updateableNodes.length} node(s)</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Affected Packs:</span>
                        <span style="color: #ff9800; font-weight: bold;">${Object.keys(byPack).length}</span>
                    </div>
                </div>

                <div style="background: #2a3a2a; border: 1px solid #4CAF50; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                    <div style="color: #4CAF50; font-size: 11px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        ⚠️ Backup Options
                    </div>
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px;">
                        <input type="checkbox" id="af-auto-backup-checkbox"
                               ${this.autoBackupEnabled ? 'checked' : ''}
                               onchange="window.AF_Find_Nodes_Widget.toggleAutoBackup(this.checked)"
                               style="margin: 0;">
                        <span>Auto-backup before updating (recommended)</span>
                    </label>
                    <button onclick="window.AF_Find_Nodes_Widget.createManualBackup()"
                            style="width: 100%; margin-top: 8px; padding: 6px; background: #4CAF50; border: none;
                                   border-radius: 4px; color: white; cursor: pointer; font-size: 10px;">
                        💾 Create Backup Now
                    </button>
                </div>

                <div style="margin-bottom: 15px; padding: 10px; background: #1a2a3a; border-radius: 6px; border: 1px solid #444;">
                    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                        <button onclick="window.AF_Find_Nodes_Widget.selectAllUpdates()"
                                style="flex: 1; padding: 8px; background: #2a4a7a; border: none;
                                       border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                            ✓ Select All
                        </button>
                        <button onclick="window.AF_Find_Nodes_Widget.deselectAllUpdates()"
                                style="flex: 1; padding: 8px; background: #666; border: none;
                                       border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">
                            ✗ Deselect All
                        </button>
                    </div>
                    <button onclick="window.AF_Find_Nodes_Widget.applySelectedUpdates()"
                            id="af-apply-updates-btn"
                            style="width: 100%; padding: 10px; background: #ff9800; border: none;
                                   border-radius: 4px; color: white; cursor: pointer; font-size: 12px;
                                   font-weight: bold;">
                        📥 Update Selected Nodes (0)
                    </button>
                </div>
            </div>
        `;

        // Build the scrollable node list
        let nodesHTML = '';

        const sortedPacks = Object.keys(byPack).sort();
        const coreIndex = sortedPacks.indexOf('Core');
        if (coreIndex > -1) {
            sortedPacks.splice(coreIndex, 1);
            sortedPacks.push('Core');
        }

        sortedPacks.forEach(pack => {
            const nodes = byPack[pack];
            const isCollapsed = this.collapsedPacks.has(pack);
            const isCore = pack === 'Core';

            nodesHTML += `
                <div style="margin-bottom: 8px; border: 1px solid ${isCore ? '#ff6b6b' : '#444'}; border-radius: 4px; overflow: hidden;">
                    <div onclick="window.AF_Find_Nodes_Widget.togglePackCollapse('${pack}')"
                         style="background: ${isCore ? '#3a2a2a' : '#2a2a2a'}; padding: 10px; cursor: pointer;
                                display: flex; justify-content: space-between; align-items: center;
                                border-bottom: ${isCollapsed ? 'none' : '1px solid #444'};">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 12px;">${isCollapsed ? '▶' : '▼'}</span>
                            <input type="checkbox"
                                   onchange="window.AF_Find_Nodes_Widget.togglePackSelection('${pack}', this.checked)"
                                   onclick="event.stopPropagation()"
                                   style="margin: 0;">
                            <span style="color: ${isCore ? '#ff6b6b' : '#ccc'}; font-weight: bold;">
                                📦 ${pack} ${isCore ? '⚠️' : ''}
                            </span>
                        </div>
                        <span style="color: #ff9800; font-size: 11px;">${nodes.length} update(s)</span>
                    </div>
                    <div id="af-pack-${pack.replace(/\s/g, '-')}"
                         style="display: ${isCollapsed ? 'none' : 'block'}; background: #1a1a1a;">
            `;

            nodes.forEach(nodeInfo => {
                const statusColor = this.getUpdateStatusColor(nodeInfo.category);
                const statusText = this.getUpdateStatusText(nodeInfo.category);
                const versionDisplay = this.formatVersionDisplay(nodeInfo.workflow, nodeInfo.installed);

                nodesHTML += `
                    <div style="padding: 8px 12px; border-bottom: 1px solid #333; font-size: 11px;"
                         onclick="window.AF_Find_Nodes_Widget.highlightUpdateNode(${nodeInfo.nodeId})">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <input type="checkbox"
                                   id="af-update-${nodeInfo.nodeId}"
                                   onchange="window.AF_Find_Nodes_Widget.toggleNodeSelection(${nodeInfo.nodeId}, this.checked)"
                                   onclick="event.stopPropagation()"
                                   style="margin: 0;">
                            <span style="color: #4da6ff; cursor: pointer;">[${nodeInfo.nodeId}] ${nodeInfo.type}</span>
                        </div>
                        <div style="margin-left: 24px; font-size: 10px; color: #aaa;">
                            ${nodeInfo.title}
                        </div>
                        <div style="margin-left: 24px; margin-top: 4px; font-size: 10px;">
                            ${versionDisplay}
                        </div>
                        <div style="margin-left: 24px; margin-top: 2px; font-size: 9px; color: ${statusColor};">
                            Status: ${statusText}
                        </div>
                    </div>
                `;
            });

            nodesHTML += `
                    </div>
                </div>
            `;
        });

        const coreNodes = byPack['Core'];
        if (coreNodes && coreNodes.length > 0) {
            nodesHTML += `
                <div style="background: #3a2a2a; border: 1px solid #ff6b6b; border-radius: 6px; padding: 10px; margin-top: 15px; margin-bottom: 15px;">
                    <div style="color: #ff6b6b; font-size: 11px; margin-bottom: 6px; font-weight: bold;">
                        ⚠️ Core ComfyUI Nodes Warning
                    </div>
                    <div style="font-size: 10px; color: #ccc; line-height: 1.4;">
                        ${coreNodes.length} Core ComfyUI node(s) will be updated.
                        This may affect workflow compatibility. Backup recommended.
                    </div>
                </div>
            `;
        }

        // Update the display: Remove any existing fixed headers first
        const existingFixedHeaders = mainResults.querySelectorAll('div[style*="flex-shrink: 0"]');
        existingFixedHeaders.forEach((header, index) => {
            if (index > 0) header.remove(); // Keep first one (scan button), remove duplicates
        });

        // Now insert/update the fixed header
        const scanButton = mainResults.querySelector('div[style*="flex-shrink: 0"]');
        if (scanButton && scrollContainer) {
            // Remove existing fixed header if present
            const nextDiv = scanButton.nextElementSibling;
            if (nextDiv && nextDiv !== scrollContainer) {
                nextDiv.remove();
            }
            scanButton.insertAdjacentHTML('afterend', fixedHeaderHTML);
            scrollContainer.innerHTML = nodesHTML;
        }
    }

    getUpdateStatusColor(category) {
        switch(category) {
            case 'newer': return '#4CAF50';
            case 'format-changed': return '#ff9800';
            case 'hash-changed': return '#ff9800';
            default: return '#888';
        }
    }

    getUpdateStatusText(category) {
        switch(category) {
            case 'newer': return '✅ Update available (semantic version)';
            case 'format-changed': return '⚠️ Version format changed - review recommended';
            case 'hash-changed': return '⚠️ Git hash changed - review recommended';
            default: return '❓ Unable to determine version relationship';
        }
    }

    formatVersionDisplay(workflow, installed) {
        const truncate = (str, len = 12) => {
            if (str.length <= len) return str;
            return str.substring(0, len) + '...';
        };

        return `
            <span style="color: #888;">Workflow:</span>
            <span style="color: #ff6b6b;">${truncate(workflow)}</span>
            <span style="color: #888;"> → </span>
            <span style="color: #888;">Installed:</span>
            <span style="color: #4CAF50;">${truncate(installed)} ⬆️</span>
        `;
    }

    togglePackCollapse(packName) {
            if (this.collapsedPacks.has(packName)) {
                this.collapsedPacks.delete(packName);
            } else {
                this.collapsedPacks.add(packName);
            }
            this.displayUpdateableNodes();
        }

        togglePackSelection(packName, checked) {
            const nodes = this.updateableNodes.filter(n => n.pack === packName);
            nodes.forEach(nodeInfo => {
                if (checked) {
                    this.selectedUpdates.add(nodeInfo.nodeId);
                } else {
                    this.selectedUpdates.delete(nodeInfo.nodeId);
                }
                const checkbox = document.getElementById(`af-update-${nodeInfo.nodeId}`);
                if (checkbox) checkbox.checked = checked;
            });
            this.updateApplyButton();
        }

        toggleNodeSelection(nodeId, checked) {
            if (checked) {
                this.selectedUpdates.add(nodeId);
            } else {
                this.selectedUpdates.delete(nodeId);
            }
            this.updateApplyButton();
        }

        selectAllUpdates() {
            this.updateableNodes.forEach(nodeInfo => {
                this.selectedUpdates.add(nodeInfo.nodeId);
                const checkbox = document.getElementById(`af-update-${nodeInfo.nodeId}`);
                if (checkbox) checkbox.checked = true;
            });
            this.updateApplyButton();
        }

        deselectAllUpdates() {
            this.selectedUpdates.clear();
            this.updateableNodes.forEach(nodeInfo => {
                const checkbox = document.getElementById(`af-update-${nodeInfo.nodeId}`);
                if (checkbox) checkbox.checked = false;
            });
            this.updateApplyButton();
        }

        updateApplyButton() {
            const btn = document.getElementById('af-apply-updates-btn');
            if (btn) {
                const count = this.selectedUpdates.size;
                btn.textContent = `📥 Update Selected Nodes (${count})`;
                btn.style.opacity = count > 0 ? '1' : '0.5';
                btn.style.cursor = count > 0 ? 'pointer' : 'not-allowed';
            }
        }

        highlightUpdateNode(nodeId) {
            const node = this.AF_Find_Nodes_FindNodeById(nodeId);
            if (node) {
                // Clear existing selection and select this node
                app.canvas.deselectAllNodes();
                node.is_selected = true;
                app.canvas.selectNode(node);
                this.AF_Find_Nodes_CenterOnNode(node);
            }
        }

        toggleAutoBackup(enabled) {
            this.autoBackupEnabled = enabled;
            localStorage.setItem('af-find-node-auto-backup', enabled.toString());
        }

        createManualBackup() {
            this.AF_Find_Nodes_UpdateResults('💾 Creating backup...', false);

            try {
                const workflow = app.graph.serialize();
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
                const filename = `workflow_backup_${timestamp[0]}_${timestamp[1].split('.')[0]}.json`;

                const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.AF_Find_Nodes_UpdateResults(`✅ Backup created: ${filename}`, false);
            } catch (error) {
                console.error('Backup failed:', error);
                this.AF_Find_Nodes_UpdateResults('❌ Failed to create backup. Check console.', true);
            }
        }

        async applySelectedUpdates() {
            if (this.selectedUpdates.size === 0) {
                this.AF_Find_Nodes_UpdateResults('No nodes selected for update.', true);
                return;
            }

            if (this.autoBackupEnabled) {
                this.AF_Find_Nodes_UpdateResults('💾 Creating backup before updates...', false);
                this.createManualBackup();
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const count = this.selectedUpdates.size;
            if (!confirm(`Update ${count} node(s)?\n\nThis will recreate the selected nodes with the latest versions.\nConnections and values will be preserved where possible.`)) {
                return;
            }

            this.AF_Find_Nodes_UpdateResults(`⏳ Updating ${count} node(s)...`, false);

            let successCount = 0;
            let failCount = 0;

            for (const nodeId of this.selectedUpdates) {
                try {
                    const success = await this.recreateNode(nodeId);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    console.error(`Failed to update node ${nodeId}:`, error);
                    failCount++;
                }
            }

            if (failCount === 0) {
                this.AF_Find_Nodes_UpdateResults(`✅ Successfully updated ${successCount} node(s)!`, false);
            } else {
                this.AF_Find_Nodes_UpdateResults(`⚠️ Updated ${successCount}, failed ${failCount}. Check console.`, true);
            }

            // Clear selection after updates
            app.canvas.deselectAllNodes();

            setTimeout(() => {
                this.performUpdateScan();
            }, 1000);
        }

        async recreateNode(nodeId) {
            const node = this.AF_Find_Nodes_FindNodeById(nodeId);
            if (!node) {
                console.error(`Node ${nodeId} not found`);
                return false;
            }

            try {
                const nodeState = {
                    id: node.id,
                    type: node.type,
                    pos: [...node.pos],
                    size: [...node.size],
                    title: node.title,
                    color: node.color,
                    bgcolor: node.bgcolor,
                    mode: node.mode,
                    flags: {...node.flags},
                                widgets_values: node.widgets_values ? [...node.widgets_values] : [],
                                inputs: node.inputs ? node.inputs.map(input => ({
                                    name: input.name,
                                    type: input.type,
                                    link: input.link
                                })) : [],
                                outputs: node.outputs ? node.outputs.map(output => ({
                                    name: output.name,
                                    type: output.type,
                                    links: output.links ? [...output.links] : []
                                })) : []
                            };

                            const inputLinks = [];
                            if (node.inputs) {
                                node.inputs.forEach((input, idx) => {
                                    if (input.link != null) {
                                        const link = app.graph.links[input.link];
                                        if (link) {
                                            inputLinks.push({
                                                targetSlot: idx,
                                                originNode: link.origin_id,
                                                originSlot: link.origin_slot
                                            });
                                        }
                                    }
                                });
                            }

                            const outputLinks = [];
                            if (node.outputs) {
                                node.outputs.forEach((output, idx) => {
                                    if (output.links && output.links.length > 0) {
                                        output.links.forEach(linkId => {
                                            const link = app.graph.links[linkId];
                                            if (link) {
                                                outputLinks.push({
                                                    originSlot: idx,
                                                    targetNode: link.target_id,
                                                    targetSlot: link.target_slot
                                                });
                                            }
                                        });
                                    }
                                });
                            }

                            app.graph.remove(node);

                            const newNode = LiteGraph.createNode(nodeState.type);
                            if (!newNode) {
                                console.error(`Failed to create node of type: ${nodeState.type}`);
                                return false;
                            }

                            newNode.pos = nodeState.pos;
                            newNode.size = nodeState.size;
                            if (nodeState.title) newNode.title = nodeState.title;
                            if (nodeState.color) newNode.color = nodeState.color;
                            if (nodeState.bgcolor) newNode.bgcolor = nodeState.bgcolor;
                            if (nodeState.mode !== undefined) newNode.mode = nodeState.mode;
                            if (nodeState.flags) Object.assign(newNode.flags, nodeState.flags);

                            if (newNode.widgets && nodeState.widgets_values) {
                                nodeState.widgets_values.forEach((val, idx) => {
                                    if (newNode.widgets[idx]) {
                                        newNode.widgets[idx].value = val;
                                    }
                                });
                            }

                            app.graph.add(newNode);

                            inputLinks.forEach(linkInfo => {
                                const originNode = app.graph.getNodeById(linkInfo.originNode);
                                if (originNode && newNode.inputs[linkInfo.targetSlot]) {
                                    originNode.connect(linkInfo.originSlot, newNode, linkInfo.targetSlot);
                                }
                            });

                            outputLinks.forEach(linkInfo => {
                                const targetNode = app.graph.getNodeById(linkInfo.targetNode);
                                if (targetNode && newNode.outputs[linkInfo.originSlot]) {
                                    newNode.connect(linkInfo.originSlot, targetNode, linkInfo.targetSlot);
                                }
                            });

                            // Make sure this node isn't in our highlight tracking
                            this.originalNodeColors.delete(nodeId);

                            app.graph.setDirtyCanvas(true, true);
                            return true;

                        } catch (error) {
                            console.error(`Error recreating node ${nodeId}:`, error);
                            return false;
                        }
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
        // console.log('copyNodeTypes called with includeUUIDs:', includeUUIDs);
        // console.log('workflowTypeIndex keys:', Object.keys(this.workflowTypeIndex).length);
        // console.log('Sample types:', Object.keys(this.workflowTypeIndex).slice(0, 5));
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
            const isStats = tabId === 'stats' || tabId === 'updates';
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

        // Check if workflow changed (no automatic scan)
        if (this.isWorkflowChanged()) {
            this.invalidateScanCache();
            console.log('AF-Find-Nodes: Workflow changed - cache invalidated');
        }

        // Show status based on scan state
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
            this.AF_Find_Nodes_UpdateResults('Ready to search. Use Pack/Type/Stats tabs to scan workflow.');
        }

        // Set to remembered tab instead of always 'id'
        this.switchTab(this.currentTab);

        // Clear the search field when dialog is shown but keep results
        document.getElementById('af-find-nodes-input').value = '';
        document.getElementById('af-find-nodes-input').focus();

        // Update tab appearance to reflect experimental setting
        this.updateTabAppearance();

        // No automatic monitoring - scanning happens on-demand only
    }

    AF_Find_Nodes_HidePanel() {
        if (this.searchPanel) {
            this.searchPanel.style.display = 'none';
        }
        this.isVisible = false;
        this.AF_Find_Nodes_ClearAll();
        this.AF_Find_Nodes_SetInspectorMode(false);

        // Clear selection when closing
        app.canvas.deselectAllNodes();

        // No monitoring to stop - on-demand scanning only
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

    // ========== VERSION DETECTION METHODS ==========
    isSemanticVersion(ver) {
        if (!ver || typeof ver !== 'string') return false;
        return /^v?\d+(\.\d+){0,2}(\.\d+)*$/.test(ver);
    }

    isGitHash(ver) {
        if (!ver || typeof ver !== 'string') return false;
        return /^[0-9a-f]{7,40}$/i.test(ver);
    }

    compareSemanticVersions(v1, v2) {
        const clean1 = v1.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
        const clean2 = v2.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);

        const maxLen = Math.max(clean1.length, clean2.length);
        for (let i = 0; i < maxLen; i++) {
            const num1 = clean1[i] || 0;
            const num2 = clean2[i] || 0;
            if (num2 > num1) return 1;
            if (num2 < num1) return -1;
        }
        return 0;
    }

    getVersionInfo(node) {
        const workflowVer = node.properties?.ver || node.ver || 'unknown';
        let installedVer = 'unknown';

        try {
            // Create a temporary fresh instance of the same node type
            const tempNode = LiteGraph.createNode(node.type);
            if (tempNode) {
                // Check the fresh node's version in its properties
                installedVer = tempNode.properties?.ver ||
                              tempNode.ver ||
                              'unknown';

                // Important: Don't add it to graph, just check and discard
                tempNode.graph = null;
            }
        } catch (e) {
            console.warn(`[AF-Updates] Failed to create temp node for ${node.type}:`, e);
        }

        // Only log when we have both versions and they differ
        if (workflowVer !== 'unknown' && installedVer !== 'unknown' && workflowVer !== installedVer) {
            // console.log(`[AF-Updates] MISMATCH: ${node.type}`);
            // console.log(`  Workflow: ${workflowVer}`);
            // console.log(`  Installed: ${installedVer}`);
        }

        return {
            workflow: workflowVer,
            installed: installedVer,
            category: this.categorizeVersionChange(workflowVer, installedVer),
            node: node,
            type: node.type
        };
    }

    categorizeVersionChange(oldVer, newVer) {
        if (oldVer === newVer) return 'same';
        if (oldVer === 'unknown' || newVer === 'unknown') return 'unknown';

        if (this.isSemanticVersion(oldVer) && this.isSemanticVersion(newVer)) {
            const comparison = this.compareSemanticVersions(oldVer, newVer);
            if (comparison > 0) return 'newer';
            if (comparison < 0) return 'older';
            return 'same';
        }

        if (this.isGitHash(oldVer) && this.isSemanticVersion(newVer)) {
            return 'format-changed';
        }

        if (this.isGitHash(oldVer) && this.isGitHash(newVer)) {
            return 'hash-changed';
        }

        return 'unknown';
    }

    scanForUpdates() {
        if (!app.graph || !app.graph.nodes) {
            this.AF_Find_Nodes_UpdateResults('No workflow loaded.', true);
            return [];
        }

        const updateableNodes = [];

        app.graph.nodes.forEach(node => {
            const versionInfo = this.getVersionInfo(node);

            if (versionInfo.category === 'newer' ||
                versionInfo.category === 'format-changed' ||
                versionInfo.category === 'hash-changed') {

                const packInfo = this.getNodeBadgeInfo(node);
                updateableNodes.push({
                    ...versionInfo,
                    pack: packInfo || 'Unknown',
                    nodeId: node.id,
                    title: node.title || 'Untitled'
                });
            }
        });

        return updateableNodes;
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
        // console.log('AF-Find-Nodes: Using fallback pack search');
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
                const nodeSource = this.getNodeBadgeInfo(node);

                resultsHTML += `
                    <div class="result-item"
                         style="padding: 6px; margin: 2px 0; background: #2a2a2a; border: 1px solid #444; border-radius: 3px; cursor: pointer;"
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
            // Clear existing selection and select this node
            app.canvas.deselectAllNodes();
            node.is_selected = true;
            app.canvas.selectNode(node);
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
        // Don't do anything if we're in stats or updates tab
        if (this.currentTab === 'stats' || this.currentTab === 'updates') {
            return;
        }

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
            // Clear existing selection and select this node
            app.canvas.deselectAllNodes();
            node.is_selected = true;
            app.canvas.selectNode(node);
            this.AF_Find_Nodes_CenterOnNode(node);

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
            status.style.color = isError ? '#ff6b6b' : '#aaa';  // Red for errors, white otherwise
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

        // Workflow scanning now happens on-demand only (no automatic monitoring)
    },

    async destroyed() {
        // Clean up selection interval if it exists
        if (window.AF_Find_Nodes_Widget) {
            if (window.AF_Find_Nodes_Widget.selectionInterval) {
                clearInterval(window.AF_Find_Nodes_Widget.selectionInterval);
                window.AF_Find_Nodes_Widget.selectionInterval = null;
            }
        }
    }
});

} // End of guard against double initialization
