# ComfyUI-AF-Find-Nodes
A ComfyUI extension that allows you to find and locate nodes by their ID, title, pack, or type in complex workflows.

ComfyUI reports node IDs when it encounters errors, but there's no built-in tool to find those node IDs quickly. That's now solved with this custom node/tool.

Ever had this in the console?

<img width="454" height="188" alt="image" src="https://github.com/user-attachments/assets/6b4d00de-59d3-4a96-908a-65d999a921d7" />

Here's the solution!

## Features

### 🔍 **Multiple Search Modes**
The extension now features a tabbed interface with four search modes:

#### 📍 By ID
- Enter any node ID to instantly locate and highlight it
- Auto-centers the canvas on the found node
- Perfect for debugging when error messages reference specific node IDs

#### 📛 By Title
- Search nodes by their title, color, cnr_id, aux_id, or name
- Finds nodes based on your custom naming and organization
- Real-time search as you type (searches after 2+ characters)

#### 📦 By Pack (Experimental)
- Search for all nodes from a specific pack/extension
- Examples: "rgthree", "WAS", "efficiency", "controlnet"
- Includes smart alias matching (e.g., "easy" finds "EasyUse")

#### 🔎 By Type (Experimental)
- Search by node type/class name
- Examples: "KSampler", "CLIPTextEncode", "LoadImage"
- Useful for finding all instances of a specific node type

### 🎯 **Inspector Mode** 
- Available in "By ID" tab only
- Click any node to see its ID
- Automatically fills the search field with clicked node ID
- Great for exploring and mapping your workflow

### 📜 **Tab-Specific Search History**
- Each search mode maintains its own history
- Stores up to 10 recent searches per tab
- Click any history item to quickly re-search
- History persists between sessions

### ⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+F`: Toggle search panel
- `Escape`: Close search panel
- `Enter`: Execute search (in ID mode)

### 🎨 **Visual Highlighting**
- Found nodes are highlighted in orange
- Multiple results shown in an interactive list
- Click any result to center and highlight that node
- Original colors are preserved and restored
- Clear highlighting with one click

### ⚙️ **Experimental Features Toggle**
- Enable/disable experimental search modes (Pack & Type)
- Setting persists between sessions
- Warning indicators on experimental tabs

## Installation

1. Download or clone this repository to your `ComfyUI/custom_nodes/` directory:
   ```bash
   cd ComfyUI/custom_nodes/
   git clone https://github.com/alFrame/ComfyUI-AF-Find-Nodes.git
   ```

2. Restart ComfyUI

3. The extension will automatically load - look for the console message:
   ```
   🔍 AF - Find Nodes extension loaded!
   ```

## Usage

### Opening the Search Panel
- Press `Ctrl+Shift+F` anywhere in ComfyUI to open the search panel
- The panel remembers your last active tab

### Finding Nodes by ID
1. Make sure you're on the "🔍 By ID" tab
2. Enter a node ID in the search field (e.g., `42`)
3. Click "Find" or press Enter
4. The node will be highlighted and centered on screen

### Finding Nodes by Title
1. Switch to the "📛 By Title" tab
2. Start typing any part of a node's title, color, or identifier
3. Results appear automatically as you type
4. Click any result to jump to that node

### Finding Nodes by Pack (Experimental)
1. Enable experimental features at the bottom of the panel
2. Switch to the "📦 By Pack" tab
3. Enter a pack name (e.g., "rgthree", "WAS", "controlnet")
4. Browse results and click to navigate

### Finding Nodes by Type (Experimental)
1. Enable experimental features at the bottom of the panel
2. Switch to the "🔎 By Type" tab
3. Enter a node type (e.g., "KSampler", "CLIP")
4. View all matching nodes in your workflow

### Using Inspector Mode
1. Switch to the "🔍 By ID" tab
2. Click the "Inspector" button to enter inspector mode
3. Click any node in your workflow to see its ID
4. The ID will automatically appear in the search field
5. Click "Exit Inspector" to return to normal mode

### Search History
- Recent searches appear as clickable buttons below the search field
- Each tab maintains its own independent history
- Click any history item to quickly search for that node/term again
- History is saved and persists between ComfyUI sessions

## Perfect For

- **Debugging workflows** when error messages reference node IDs
- **Large workflow navigation** - quickly jump to specific nodes
- **Workflow organization** - finding nodes by your custom titles
- **Pack exploration** - locating all nodes from a specific extension
- **Type analysis** - finding all instances of a node type
- **Workflow documentation** - mapping and exploring node relationships

## Error Message Integration

When ComfyUI shows error messages like:
```
Error occurred when executing node 147
```

Simply:
1. Open AF - Find Nodes (`Ctrl+Shift+F`)
2. Type `147` and press Enter
3. Instantly locate the problematic node!

## Known Limitations

### ⚠️ Experimental Features Notice
The "By Pack" and "By Type" search modes are marked as experimental because:
- Different node packs use varying conventions for storing metadata
- Pack information may not always be consistently available
- Some nodes may not be correctly identified by their pack
- Results may include false positives or miss some nodes

These features work best with well-structured node packs but may produce unexpected results with others.

### Not Compatible with Subgraphs
This extension does not currently support searching within subgraphs or nested workflows.

## Compatibility

- Works with all ComfyUI workflows
- Compatible with custom nodes
- No dependencies on other extensions
- Pure JavaScript implementation
- Tested with ComfyUI v0.0.04+

## File Structure

```
ComfyUI-AF-Find-Nodes/
├── AF_Find_Nodes.js      # Main extension JavaScript
├── __init__.py                # Python initialization
└── README.md                  # This file
```

## Changelog

### v0.0.04
- Added tabbed interface with four search modes
- New "By Title" search for finding nodes by name
- New "By Pack" experimental search (with aliases support)
- New "By Type" experimental search
- Tab-specific search history
- Experimental features toggle with persistent settings
- Results now shown in interactive list format
- Auto-search for text-based tabs
- Improved visual feedback and status messages

### v0.0.03
- Clear button now also clears the search field
- Dialog content cleared when closed or opened
- Error messages shown in red
- Fixed dialog width to 340px

### v0.0.02
- Fixed double initialization error
- Removed right-click on canvas to trigger the dialog
- Fixed zooming in to node

### v0.0.01
- Initial release

## Contributing

Issues and pull requests welcome at: https://github.com/alFrame/ComfyUI-AF-Find-Nodes

Please report:
- Bugs or unexpected behavior
- Node packs that don't work well with experimental features
- Feature suggestions
- Compatibility issues

## License

MIT License - Feel free to use, modify, and distribute!

## Credits

**Creator:** Alex Furer  
**Co-Creators:** Claude AI, QWEN3 Coder, DeepSeek

---

*Praise, comments, bugs, improvements:* https://github.com/alFrame/ComfyUI-AF-Find-Nodes
