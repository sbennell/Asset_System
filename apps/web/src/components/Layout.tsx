import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ClipboardCheck,
  Download,
  Loader2
} from 'lucide-react';
import { useState, useCallback } from 'react';
import AboutModal from './AboutModal';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../App';
import { useVersionCheck, APP_VERSION } from '../lib/useVersionCheck';

const navigation = [
  { name: 'Assets', href: '/assets', icon: Package },
  { name: 'Stocktake', href: '/stocktake', icon: ClipboardCheck },
  { name: 'Settings', href: '/settings', icon: Settings }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const { data: versionCheck } = useVersionCheck();
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [showAbout, setShowAbout] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      navigate('/login');
    }
  });

  // Poll health endpoint after triggering update
  const pollForRestart = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes at 5s intervals
    let apiWentDown = false;

    const poll = () => {
      attempts++;
      fetch('/api/health', { cache: 'no-store' })
        .then(res => {
          if (res.ok && apiWentDown) {
            // API is back after going down - update complete
            setTimeout(() => window.location.reload(), 1000);
          } else if (res.ok && !apiWentDown) {
            // API hasn't gone down yet, keep polling
            if (attempts < maxAttempts) setTimeout(poll, 5000);
          }
        })
        .catch(() => {
          // API is down - expected during update
          apiWentDown = true;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            setUpdateError('Update is taking longer than expected. Check server logs.');
          }
        });
    };

    setTimeout(poll, 5000);
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateError('');
    try {
      await api.triggerUpdate();
      pollForRestart();
    } catch (err: any) {
      setUpdating(false);
      setUpdateError(err.message || 'Failed to trigger update');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-2">
              <LayoutDashboard className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">Asset System</span>
            </Link>
            <button
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon className={cn('w-5 h-5 mr-3', isActive ? 'text-primary-600' : 'text-gray-400')} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info and Logout */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'ADMIN' ? 'Administrator' : 'User'}
                </p>
              </div>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut className="w-5 h-5 mr-3 text-gray-400" />
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>

          {/* Version */}
          <div className="px-4 py-2 border-t border-gray-200">
            {versionCheck?.updateAvailable ? (
              <button
                onClick={() => setShowAbout(true)}
                disabled={updating}
                className="w-full flex items-center justify-center gap-1 text-xs text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md px-2 py-1 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <Download className="w-3 h-3" />
                Update to v{versionCheck.latestVersion}
              </button>
            ) : (
              <button
                onClick={() => setShowAbout(true)}
                className="text-xs text-gray-400 hover:text-primary-600 text-center block w-full"
              >
                Version {APP_VERSION}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex items-center h-16 px-4 bg-white border-b border-gray-200 lg:hidden">
          <button
            className="p-2 -ml-2 rounded-md hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-4 text-lg font-semibold">Asset System</span>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* About modal */}
      {showAbout && (
        <AboutModal
          onClose={() => setShowAbout(false)}
          onUpdate={handleUpdate}
          isAdmin={isAdmin}
          updateAvailable={versionCheck?.updateAvailable ?? false}
          latestVersion={versionCheck?.latestVersion ?? null}
          changelog={versionCheck?.changelog ?? []}
        />
      )}

      {/* Updating overlay */}
      {updating && (
        <div className="fixed inset-0 z-50 bg-gray-900/80 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm mx-4 text-center">
            {updateError ? (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Update Issue</h2>
                <p className="text-sm text-gray-600 mb-4">{updateError}</p>
                <p className="text-xs text-gray-500">Check server logs for details.</p>
                <button
                  onClick={() => { setUpdating(false); setUpdateError(''); }}
                  className="mt-4 btn btn-secondary"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Updating to v{versionCheck?.latestVersion}
                </h2>
                <p className="text-sm text-gray-600">
                  The system is updating and will restart automatically.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  This page will reload when the update is complete.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
