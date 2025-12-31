"""
@author: Alex Furer
@title: AF - Find Nodes
@nickname: AF - Find Nodes
@description: A ComfyUI utility extension for finding nodes by ID, title, pack, or type in workflows.
"""

# Copyright (C) 2025 Alex Furer
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

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
