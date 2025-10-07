"""
AF - Find Node by ID Extension for ComfyUI
A utility extension for finding nodes by ID in ComfyUI workflows

Creator: Alex Furer with Claude AI
License: MIT
"""

import os

# Get the directory of this file
node_dir = os.path.dirname(__file__)
js_path = os.path.join(node_dir, "AF_Find_Node_by_ID.js")

# Tell ComfyUI to serve web files from this directory
WEB_DIRECTORY = "." if os.path.exists(js_path) else None

# No Python nodes to register - this is a pure JavaScript extension
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']
__version__ = "0.0.04"
__author__ = "Alex Furer"

print("*  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *")
print(r"""
   ___   ____        _____           ___     __  ______  _  __       __      
  / _ | / __/ ____  / ___/__  __ _  / _/_ __/ / / /  _/ / |/ /__ ___/ /__ ___
 / __ |/ _/  /___/ / /__/ _ \/  ' \/ _/ // / /_/ // /  /    / _ Y _  / -_|_-<
/_/ |_/_/          \___/\___/_/_/_/_/ \_, /\____/___/ /_/|_/\___|_,_/\__/___/
                                     /___/
                                     
              🔍 AF - Find Node by ID extension loaded!
                 Use Ctrl+Shift+F to open the search panel
                 
""")
print("*  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *")