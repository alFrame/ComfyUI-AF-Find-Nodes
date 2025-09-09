- Zoom to node does not workflows
- Recent Seraches dows not populate
// ****** ComfyUI-AF-Find Node by ID ******
//
// Creator: Alex Furer - Co-Creator(s): Claude AI 
//
// Praise, comment, bugs, improvements: https://github.com/alFrame/ComfyUI_AF_FindNodeByID
//
// LICENSE: MIT License
//
// v0.0.02
//
// Description:
// A ComfyUI extension that allows you to search for and locate nodes by their ID in complex workflows.
//
// Usage:
// Read Me on Github
//
// Changelog:
// v0.0.01
// - Initial Version
//
// v0.0.02
//   - Fixed double initialization error
//   - Removed right-click on canvas to trigger the dialog
//   - Fixed zooming in to node
//
// Feature Requests / Wet Dreams
// - 

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

// Prevent double initialization
if (window.AF_Find_Node_by_ID_Widget) {
    console.log("AF - Find Node by ID already loaded, skipping initialization");
} else {

class AF_Find_Node_by_ID_Widget {
    constructor() {
        this.searchPanel = null;
        this.isVisible = false;
        this.highlightedNode = null;
        this.originalNodeColors = new Map();
        this.searchHistory = [];
        this.maxHistory = 10;
        this.inspectorMode = false;
    }

    createSearchPanel() {
        // Create main container
        const panel = document.createElement('div');
        panel.id = 'af-find-node-by-id-panel';
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
            min-width: 300px;
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
        title.textContent = 'AF - Find Node by ID';
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
        closeBtn.onclick = () => this.AF_Find_Node_by_ID_HidePanel();

        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);

        // Search input section
        const searchSection = document.createElement('div');
        searchSection.style.marginBottom = '10px';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Enter node ID (e.g., 42)';
        searchInput.id = 'af-find-node-by-id-input';
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
        inspectorBtn.id = 'af-find-node-by-id-inspector-toggle';
        inspectorBtn.style.cssText = `
            flex: 1;
            padding: 6px;
            background: #2196F3;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 11px;
        `;

        // Results section
        const resultsSection = document.createElement('div');
        resultsSection.id = 'af-find-node-by-id-results';
        resultsSection.style.cssText = `
            max-height: 200px;
            overflow-y: auto;
            background: #1a1a1a;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
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
        historyList.id = 'af-find-node-by-id-history';
        historyList.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        `;

        // Event listeners
        searchBtn.onclick = () => this.AF_Find_Node_by_ID_Search();
        clearBtn.onclick = () => this.AF_Find_Node_by_ID_ClearHighlight();
        inspectorBtn.onclick = () => this.AF_Find_Node_by_ID_ToggleInspector();
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.AF_Find_Node_by_ID_Search();
            }
        });

        // Assemble the panel
        buttonRow.appendChild(searchBtn);
        buttonRow.appendChild(clearBtn);
        buttonRow.appendChild(inspectorBtn);

        searchSection.appendChild(searchInput);
        searchSection.appendChild(buttonRow);

        historySection.appendChild(historyTitle);
        historySection.appendChild(historyList);

        panel.appendChild(titleBar);
        panel.appendChild(searchSection);
        panel.appendChild(resultsSection);
        panel.appendChild(historySection);

        document.body.appendChild(panel);
        this.searchPanel = panel;

        // Update results initially
        this.AF_Find_Node_by_ID_UpdateResults('Ready to search. Enter a node ID or use Inspector mode.');
    }

    AF_Find_Node_by_ID_ShowPanel() {
        if (!this.searchPanel) {
            this.createSearchPanel();
        }
        this.searchPanel.style.display = 'block';
        this.isVisible = true;
        document.getElementById('af-find-node-by-id-input').focus();
    }

    AF_Find_Node_by_ID_HidePanel() {
        if (this.searchPanel) {
            this.searchPanel.style.display = 'none';
        }
        this.isVisible = false;
        this.AF_Find_Node_by_ID_ClearHighlight();
        this.AF_Find_Node_by_ID_SetInspectorMode(false);
    }

    AF_Find_Node_by_ID_TogglePanel() {
        if (this.isVisible) {
            this.AF_Find_Node_by_ID_HidePanel();
        } else {
            this.AF_Find_Node_by_ID_ShowPanel();
        }
    }

    AF_Find_Node_by_ID_Search() {
        const input = document.getElementById('af-find-node-by-id-input');
        const searchId = input.value.trim();
        
        if (!searchId) {
            this.AF_Find_Node_by_ID_UpdateResults('Please enter a node ID');
            return;
        }

        const nodeId = parseInt(searchId);
        if (isNaN(nodeId)) {
            this.AF_Find_Node_by_ID_UpdateResults('Invalid node ID. Please enter a number.');
            return;
        }

        const node = this.AF_Find_Node_by_ID_FindNodeById(nodeId);
        if (node) {
            this.AF_Find_Node_by_ID_HighlightNode(node);
            this.AF_Find_Node_by_ID_CenterOnNode(node);
            this.AF_Find_Node_by_ID_AddToHistory(nodeId);
            this.AF_Find_Node_by_ID_UpdateResults(`Found node ${nodeId}: ${node.type || 'Unknown Type'}`);
        } else {
            this.AF_Find_Node_by_ID_UpdateResults(`Node ${nodeId} not found in current workflow`);
        }
    }

    AF_Find_Node_by_ID_FindNodeById(nodeId) {
        if (!app.graph || !app.graph.nodes) return null;
        return app.graph.nodes.find(node => node.id === nodeId);
    }

    AF_Find_Node_by_ID_HighlightNode(node) {
        this.AF_Find_Node_by_ID_ClearHighlight();
        
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

    AF_Find_Node_by_ID_ClearHighlight() {
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

    AF_Find_Node_by_ID_CenterOnNode(node) {
        if (!app.canvas || !node) return;
        
        // Clear current selection
        app.canvas.selectNodes();
        
        // Select the target node
        node.is_selected = true;
        app.canvas.selected_nodes[node.id] = node;
        
        // Use ComfyUI's built-in "fit view to selected nodes" functionality
        app.canvas.fitSelectedNodes();
        
        // Mark canvas as dirty to trigger redraw
        app.canvas.setDirty(true, true);
    }

    AF_Find_Node_by_ID_ToggleInspector() {
        this.AF_Find_Node_by_ID_SetInspectorMode(!this.inspectorMode);
    }

    AF_Find_Node_by_ID_SetInspectorMode(enabled) {
        this.inspectorMode = enabled;
        const btn = document.getElementById('af-find-node-by-id-inspector-toggle');
        if (btn) {
            btn.style.background = enabled ? '#ff9800' : '#2196F3';
            btn.textContent = enabled ? 'Exit Inspector' : 'Inspector';
        }
        
        if (enabled) {
            this.AF_Find_Node_by_ID_UpdateResults('Inspector mode active. Click any node to see its ID.');
        } else {
            this.AF_Find_Node_by_ID_UpdateResults('Inspector mode disabled.');
        }
    }

    AF_Find_Node_by_ID_HandleNodeClick(node) {
        if (this.inspectorMode && node) {
            const input = document.getElementById('af-find-node-by-id-input');
            if (input) {
                input.value = node.id.toString();
            }
            this.AF_Find_Node_by_ID_HighlightNode(node);
            this.AF_Find_Node_by_ID_AddToHistory(node.id);
            this.AF_Find_Node_by_ID_UpdateResults(`Selected node ${node.id}: ${node.type || 'Unknown Type'}`);
        }
    }

    AF_Find_Node_by_ID_AddToHistory(nodeId) {
        // Remove if already exists
        this.searchHistory = this.searchHistory.filter(id => id !== nodeId);
        // Add to front
        this.searchHistory.unshift(nodeId);
        // Limit size
        if (this.searchHistory.length > this.maxHistory) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistory);
        }
        this.AF_Find_Node_by_ID_UpdateHistory();
    }

    AF_Find_Node_by_ID_UpdateHistory() {
        const historyContainer = document.getElementById('af-find-node-by-id-history');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';
        
        this.searchHistory.forEach(nodeId => {
            const historyBtn = document.createElement('button');
            historyBtn.textContent = nodeId.toString();
            historyBtn.style.cssText = `
                background: #444;
                border: none;
                color: #fff;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            `;
            historyBtn.onclick = () => {
                document.getElementById('af-find-node-by-id-input').value = nodeId.toString();
                this.AF_Find_Node_by_ID_Search();
            };
            historyContainer.appendChild(historyBtn);
        });
    }

    AF_Find_Node_by_ID_UpdateResults(message) {
        const results = document.getElementById('af-find-node-by-id-results');
        if (results) {
            results.textContent = message;
        }
    }

    // Keyboard shortcut handler
    AF_Find_Node_by_ID_HandleKeyboard(event) {
        // Ctrl+Shift+F to toggle search panel
        if (event.ctrlKey && event.shiftKey && event.code === 'KeyF') {
            event.preventDefault();
            this.AF_Find_Node_by_ID_TogglePanel();
        }
        // Escape to close panel
        if (event.code === 'Escape' && this.isVisible) {
            event.preventDefault();
            this.AF_Find_Node_by_ID_HidePanel();
        }
    }
}

// Initialize the search widget with guard against double initialization
window.AF_Find_Node_by_ID_Widget = new AF_Find_Node_by_ID_Widget();

// Register the extension
app.registerExtension({
    name: "AF-Find-Node-by-ID",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // We don't need to modify node definitions
    },

    async setup() {
        // Add keyboard event listeners
        document.addEventListener('keydown', (e) => {
            window.AF_Find_Node_by_ID_Widget.AF_Find_Node_by_ID_HandleKeyboard(e);
        });

        // Hook into node selection changes for inspector mode
        let lastSelectedNodes = [];
        
        // Monitor for node selection changes
        const checkNodeSelection = () => {
            if (!window.AF_Find_Node_by_ID_Widget.inspectorMode) return;
            
            const currentSelected = app.canvas.selected_nodes;
            if (!currentSelected || Object.keys(currentSelected).length === 0) return;
            
            // Get the first selected node
            const nodeId = Object.keys(currentSelected)[0];
            const node = currentSelected[nodeId];
            
            if (node && !lastSelectedNodes.includes(node.id)) {
                window.AF_Find_Node_by_ID_Widget.AF_Find_Node_by_ID_HandleNodeClick(node);
                lastSelectedNodes = [node.id];
            }
        };
        
        // Check selection periodically when inspector is active
        setInterval(() => {
            if (window.AF_Find_Node_by_ID_Widget.inspectorMode) {
                checkNodeSelection();
            } else {
                lastSelectedNodes = [];
            }
        }, 100);

        // Also try hooking into the canvas click event
        const canvas = app.canvas.canvas;
        canvas.addEventListener('click', (e) => {
            if (!window.AF_Find_Node_by_ID_Widget.inspectorMode) return;
            
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
                window.AF_Find_Node_by_ID_Widget.AF_Find_Node_by_ID_HandleNodeClick(node);
                e.stopPropagation();
            }
        }, true);

        console.log("AF - Find Node by ID extension loaded. Use Ctrl+Shift+F to open search panel.");
    }
});

} // End of guard against double initialization