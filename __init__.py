"""
@author: Alex Furer
@title: AF - Find Node by ID
@nickname: AF - Find Node by ID
@description: A ComfyUI utility extension for finding nodes by ID (and more) in ComfyUI workflows.
"""

# Tell ComfyUI to serve JavaScript files from this directory
WEB_DIRECTORY = "."

# No Python nodes to register - this is a pure JavaScript extension
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']

__version__ = "0.0.04"
__author__ = "Alex Furer"
__title__ = "AF - Find Node by ID"
__description__ = "A ComfyUI utility extension for finding nodes by ID (and more) in ComfyUI workflows."
__license__ = "MIT"
__changelog__ = [
    "v0.0.04 - Added tabs to search by ID, by Title, by Pack, by Type. Search 'By Pack' and 'By Type' are experimental features. Due to inconsistencies in how nodes are coded and distributed across different packs, these searches may produce unexpected results or false positives. Use with caution !!",
    "v0.0.03 - Clear button now also clears the search field. Dialog content cleared when closed or opened. Error messages in red. Fixed dialog width to 340px",
    "v0.0.02 - Fixed double initialization error. Removed right-click on canvas to trigger the dialog. Fixed zooming in to node",
    "v0.0.01 - Initial Version"
]

print("*  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *")
print(r"""
   ___   ____        _____           ___     __  ______  _  __       __      
  / _ | / __/ ____  / ___/__  __ _  / _/_ __/ / / /  _/ / |/ /__ ___/ /__ ___
 / __ |/ _/  /___/ / /__/ _ \/  ' \/ _/ // / /_/ // /  /    / _ Y _  / -_|_-<
/_/ |_/_/          \___/\___/_/_/_/_/ \_, /\____/___/ /_/|_/\___|_,_/\__/___/
                                     /___/
                                     
              🔍 AF - Find Node by ID Extension Loaded !
               Use Ctrl+Shift+F to open the search panel
                 
""")
print("*  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *")