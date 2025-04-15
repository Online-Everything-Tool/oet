// FILE: app/t/_components/ToolSettings.tsx
'use client';

import React, { useState } from 'react';
import ToolHistorySettings from './ToolHistorySettings'; // Use relative path
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import '@shoelace-style/shoelace/dist/components/button/button.js'; // Import sl-button

interface ToolSettingsProps {
    toolRoute: string;
}

/**
 * Renders a settings icon button that opens a dialog containing
 * the ToolHistorySettings component for the given toolRoute.
 */
export default function ToolSettings({ toolRoute }: ToolSettingsProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="absolute right-0">
            <sl-tooltip content="History Logging Settings">
                <sl-icon-button
                    name="gear"
                    label="Settings"
                    onClick={() => setIsSettingsOpen(true)}
                    style={{ fontSize: '1.2rem', color: `rgb(var(--color-text-muted))` }}
                ></sl-icon-button>
            </sl-tooltip>

            <sl-dialog
                label="History Settings"
                className="dialog-overview" // Optional: Add custom class if needed
                open={isSettingsOpen}
                onSl-after-hide={() => setIsSettingsOpen(false)}
            >
                {/* Render the actual settings UI component inside */}
                <ToolHistorySettings toolRoute={toolRoute} />

                <sl-button slot="footer" variant="primary" onClick={() => setIsSettingsOpen(false)}>
                    Close
                </sl-button>
            </sl-dialog>
        </div>
    );
}