# ComfyUI-AF-FindNodeByID

A ComfyUI extension that allows you to find and locate nodes by their ID in complex workflows.

ComfyUI is reporting node IDs when it encounters an error, but there is no built in tool to find those node IDs quickly.

That's now solved with thisnode. Here's a quick video showing the functionallity.

[VIDEO]

## Features

### 🔍 **Find by Node ID**
- Enter any node ID to instantly locate and highlight it
- Auto-centers the canvas on the found node
- Perfect for debugging when error messages reference specific node IDs

### 🎯 **Inspector Mode** 
- Click any node to see its ID
- Automatically fills the search field with clicked node ID
- Great for exploring and mapping your workflow

### 📝 **Search History**
- Keeps track of your recent searches
- Click any history item to quickly re-search
- Stores up to 10 recent searches

### ⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+F`: Toggle search panel
- `Escape`: Close search panel
- `Enter`: Execute search

### 🎨 **Visual Highlighting**
- Found nodes are highlighted in red
- Original colors are preserved and restored
- Clear highlighting with one click

## Installation

1. Download or clone this repository to your `ComfyUI/custom_nodes/` directory:
   ```bash
   cd ComfyUI/custom_nodes/
   git clone https://github.com/alFrame/ComfyUI-AF-Find-Node-by-ID.git
   ```

2. Restart ComfyUI

3. The extension will automatically load - look for the console message:
   ```
   🔍 AF - Find Node by ID extension loaded!
   ```

## Usage

### Method 1: Keyboard Shortcut
- Press `Ctrl+Shift+F` anywhere in ComfyUI to open the search panel

### Finding Nodes
1. Enter a node ID in the search field (e.g., `42`)
2. Click "Find" or press Enter
3. The node will be highlighted and centered on screen

### Using Inspector Mode
1. Click the "Inspector" button to enter inspector mode
2. Click any node in your workflow to see its ID
3. The ID will automatically appear in the search field
4. Click "Exit Inspector" to return to normal mode

### Search History
- Recent searches appear as clickable buttons below the search field
- Click any history item to quickly search for that node again

## Perfect For

- **Debugging workflows** when error messages reference node IDs
- **Large workflow navigation** - quickly jump to specific nodes
- **Workflow documentation** - mapping node IDs for reference
- **Subgraph exploration** - understanding complex node relationships

## Error Message Integration

When ComfyUI shows error messages like:
```
Error occurred when executing node 147
```

Simply:
1. Open AF - Find Node by ID (`Ctrl+Shift+F`)
2. Type `147` and press Enter
3. Instantly locate the problematic node!

## Compatibility

- Works with all ComfyUI workflows
- Compatible with custom nodes
- No dependencies on other extensions
- Pure JavaScript implementation

## Not compatible with subgraphs !!

## File Structure

```
ComfyUI-AF-Find-Node-by-ID/
├── AF_Find_Node_by_ID.js      # Main extension JavaScript
├── __init__.py                # Python initialization
└── README.md                  # This file
```

## License

MIT License - Feel free to use, modify, and distribute!

## Contributing

Issues and pull requests welcome at: [https://github.com/alFrame/ComfyUI-AF-Find-Node-by-ID](https://github.com/alFrame/ComfyUI-AF-FindNodeByID)

---

**Creator:** Alex Furer with Claude AI  
**Version:** 1.0.0
