import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

import ScannerMenu from './ScannerHome';
import ScanInApp from './ScanInApp';
import ScanOutApp from './ScanOutApp';
import ScanInventory from './ScannerInventory';
import DashboardIn from './DashboardIn';
import DashboardOut from './DashboardOut';
import AutoUpdateModel from './components/AutoUpdateModel';

export default function App() {
  const [pathname, setPathname] = useState<string>(window.location.pathname);
  const [tvMode, setTvMode] = useState<'IN' | 'OUT'>('IN');

  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
  );
  const isScannerDevice = isNative || isMobileBrowser;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode')?.toUpperCase();
    if (modeParam === 'OUT' || modeParam === 'IN') {
      setTvMode(modeParam);
    }

    if (isScannerDevice && window.location.pathname === '/') {
      window.history.replaceState({}, '', '/home');
      setPathname('/home');
    }

    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isScannerDevice]);

  // 🎯 Funkcja pomocnicza wybierająca aktywny ekran
  const renderCurrentView = () => {
    if (pathname === '/home') {
      return <ScannerMenu />;
    }

    if (pathname === '/scanner/scan-in') {
      return <ScanInApp />;
    }

    if (pathname === '/scanner/scan-out') {
      return <ScanOutApp />;
    }

    if (pathname === '/scanner/inventory') {
      return <ScanInventory />;
    }

    if (isScannerDevice && pathname === '/') {
      return <ScannerMenu />;
    }

    return tvMode === 'IN' ? <DashboardIn /> : <DashboardOut />;
  };

  return (
      <>
        {/* Active Screen */}
        {renderCurrentView()}

        {/* 🚀 Modal aktualizacji montowany ZAWSZE, niezależnie od podstrony */}
        <AutoUpdateModel />
      </>
  );
}