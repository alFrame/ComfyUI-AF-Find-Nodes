"""
@author: Alex Furer
@title: AF - Find Nodes
@nickname: AF - Find Nodes
@description: A ComfyUI utility extension for finding nodes by ID, title, pack, or type in workflows.
"""

# Tell ComfyUI to serve JavaScript files from this directory
WEB_DIRECTORY = "./web"

# No Python nodes to register - this is a pure JavaScript extension
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']

print("*  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *")
print(r"""
      ＡＦ  －  ＣｏｍｆｙＵＩ  Ｎｏｄｅｓ
                                     
     🔍 AF - Find Nodes Extension Loaded !
   Use Ctrl+Shift+F to open the search panel
""")
print("*  *  *  *  *  *  *  *  *  *  *  *  *  *  *  * ")