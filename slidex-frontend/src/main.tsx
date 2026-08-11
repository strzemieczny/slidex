import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ScanInApp from './ScanInApp';
import ScanOutApp from './ScanOutApp';
import ScannerMenu from "./ScannerHome";
import ScanInventory from "./ScannerInventory";
import DashboardCombined from "./DashboardCombined";
import './index.css';
import Config from './Config';
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/config" element={<Config />} />
                <Route path="/dashboardCombined" element={<DashboardCombined />} />
                <Route path="/scanner" element={<ScannerMenu />} />
                <Route path="/scanner/inventory" element={<ScanInventory />} />
                <Route path="/scanner/scan-in" element={<ScanInApp />} />
                <Route path="/scanner/scan-out" element={<ScanOutApp />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);