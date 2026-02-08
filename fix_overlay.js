const fs = require('fs');
const path = 'c:\\Users\\Eitan Baron\\Documents\\GitHub\\studio\\src\\components\\album\\custom-layout-editor\\custom-layout-editor-overlay.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Find the line that starts with indented import Label
// Look for the specific import line from the view_file output:
// "                    import {Label} from '@/components/ui/label';"
const startIdx = lines.findIndex(l => l.trim().startsWith("import {Label}") && l.startsWith("                    "));

if (startIdx === -1) {
    console.error("Could not find start index. File might be different than expected.");
    // Fallback: search for "export const CustomLayoutEditorOverlay" which appeared twice.
    // The second one is indented.
    // But better to fail safe.
    process.exit(1);
}

// Keep lines from startIdx to end
let newLines = lines.slice(startIdx);

// Unindent (remove 20 spaces)
newLines = newLines.map(l => l.startsWith("                    ") ? l.substring(20) : l);

// Add missing imports (these were in the deleted top section)
const header = `import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlbumPage, AlbumConfig } from '@/lib/types';
import { LayoutSidebarLeft } from './layout-sidebar-left';
import { LayoutSidebarRight } from './layout-sidebar-right';
import { LayoutCanvas } from './layout-canvas';
import { FloatingToolbar } from './floating-toolbar';
import { Button } from '@/components/ui/button';
`;

const finalContent = header + newLines.join('\n');
fs.writeFileSync(path, finalContent);
console.log("File repaired successfully.");
