import { X, Download, ExternalLink } from 'lucide-react';
import { APP_VERSION, ChangelogEntry } from '../lib/useVersionCheck';

interface AboutModalProps {
  onClose: () => void;
  onUpdate: () => void;
  isAdmin: boolean;
  updateAvailable: boolean;
  latestVersion: string | null;
  changelog: ChangelogEntry[];
}

export default function AboutModal({
  onClose,
  onUpdate,
  isAdmin,
  updateAvailable,
  latestVersion,
  changelog
}: AboutModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">About</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Version */}
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">v{APP_VERSION}</p>
            <p className="text-sm text-gray-500">Asset Management System</p>
          </div>

          {/* Update banner */}
          {updateAvailable && latestVersion && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    v{latestVersion} available
                  </p>
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => { onClose(); onUpdate(); }}
                    className="flex items-center gap-1 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md px-3 py-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Update
                  </button>
                ) : (
                  <a
                    href="https://github.com/sbennell/Asset_System/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                  >
                    View on GitHub
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Changelog */}
          {changelog.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Changelog</h4>
              <div className="max-h-64 overflow-y-auto space-y-3 border rounded-lg p-3 bg-gray-50 text-sm">
                {changelog.map(entry => (
                  <div key={entry.version}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-gray-900">v{entry.version}</span>
                      <span className="text-xs text-gray-400">{entry.date}</span>
                    </div>
                    <div className="text-gray-600 text-xs whitespace-pre-line leading-relaxed">
                      {entry.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="flex items-center justify-center gap-4 text-xs">
            <a
              href="https://github.com/sbennell/Asset_System"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-500 hover:text-primary-600"
            >
              <ExternalLink className="w-3 h-3" />
              GitHub
            </a>
            <a
              href="https://github.com/sbennell/Asset_System/blob/main/VERSION_HISTORY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-500 hover:text-primary-600"
            >
              <ExternalLink className="w-3 h-3" />
              Full Changelog
            </a>
          </div>

          {/* Copyright */}
          <p className="text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Asset Management System - Stewart Bennell
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
