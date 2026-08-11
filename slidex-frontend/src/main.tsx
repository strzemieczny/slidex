/* eslint-disable react-refresh/only-export-components -- application entry point */
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

const App = lazy(() => import('./App'));
const ScanInApp = lazy(() => import('./ScanInApp'));
const ScanOutApp = lazy(() => import('./ScanOutApp'));
const ScannerMenu = lazy(() => import('./ScannerHome'));
const ScanInventory = lazy(() => import('./ScannerInventory'));
const ScannerAudit = lazy(() => import('./ScannerAudit'));
const DashboardCombined = lazy(() => import('./DashboardCombined'));
const Config = lazy(() => import('./Config'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/config" element={<Config />} />
          <Route path="/dashboardCombined" element={<DashboardCombined />} />
          <Route path="/scanner" element={<ScannerMenu />} />
          <Route path="/scanner/inventory" element={<ScanInventory />} />
          <Route path="/scanner/audit" element={<ScannerAudit />} />
          <Route path="/scanner/scan-in" element={<ScanInApp />} />
          <Route path="/scanner/scan-out" element={<ScanOutApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
);
