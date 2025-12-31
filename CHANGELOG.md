## Changelog

### v0.3.0
- Added a tab to update nodes in the workflow with node versions of already installed node packs and ComfyUI core nodes
- Changed the display of found node packs under the stats tab. It's now collapsible items list
- New screenshots
- Small bugs and inconveniences fixed
- Switched to GNU 3.0 LICENSE

### v0.2.2
- Critical workflow loading/tab duplication bug
- The extension was dangerously overriding ComfyUI's core loadGraphData() function, which interfered with workflow management and caused infinite tab creation when loading workflows.
- Removed the unsafe loadGraphData override completely
- Added safe workflow monitoring using setInterval polling instead of function overriding
- Added proper cleanup of all intervals in destroyed() method

### v0.2.1
- Updated README with screenshots

### v0.2.0
- Added statistics panel
- Updated README
- Added screenshot of error message

### v0.1.0
- Added a star rating widget
- Added a "support" widget to GitHub issues page
- Added a bunch of files to the .gitignore
- Changed icon.png (ComfyUI registry icon) back to GitHub, as it didn't work, because my repo was set to private (DUH...)

### v0.0.9
- Changed Icon location to my own website as the ComfyUI Registry botched out on any GitHub URL I tried...

### v0.0.8
- Minor changes for registry compliance
- Cropped the UI screenshot 

### v0.0.7
- Moved the JS to the web/ directory
- Added nodes.py (empty basically, but needed for registration and distribution via ComfyUI Manager
- Added CHANGELOG.md
- Added package.json for ComfyUI Manager compliance
- Added pyproject.toml for registry compliance
- Reworked the README
- Added screenshots

### v0.0.6
- Cosmetics, making this a version

### v0.0.05
- Renamed the project from "AF - Find Node By ID" to "AF - Find Nodes"",

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
