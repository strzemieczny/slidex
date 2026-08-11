import { useState, useEffect } from 'react';
import { getApiBaseUrl, getSavedServerIp } from './config/api';
import { Capacitor } from '@capacitor/core';

// 🎨 Import wektorowych ikon z lucide-react
import {
    MapPin,
    LogIn,
    LogOut,
    Search,
    ChevronRight,
    Tv,
    Server,
    Save,
    Download,
    Smartphone,
    X,
    ClipboardCheck
} from 'lucide-react';

export interface RackGroup {
    id: string;
    code: string;
    name: string;
}

export default function ScannerMenu() {
    const [groups, setGroups] = useState<RackGroup[]>([]);
    const [assignedGroupId, setAssignedGroupId] = useState<string>(
        localStorage.getItem('SCANNER_GROUP_ID') || 'ALL'
    );

    // 🌐 Stan dla IP serwera
    const [serverIp, setServerIp] = useState<string>(getSavedServerIp());
    const [ipSavedMessage, setIpSavedMessage] = useState(false);

    // 📱 Wykrywanie czy aplikacja działa w paczce APK (Capacitor), czy w przeglądarce
    const isNativeApp = Capacitor.isNativePlatform();
    const [showDownloadBanner, setShowDownloadBanner] = useState<boolean>(!isNativeApp);

    useEffect(() => {
        void fetchGroups();

        const enableFullscreen = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };

        window.addEventListener('click', enableFullscreen, { once: true });
        window.addEventListener('touchstart', enableFullscreen, { once: true });

        return () => {
            window.removeEventListener('click', enableFullscreen);
            window.removeEventListener('touchstart', enableFullscreen);
        };
    }, []);

    const fetchGroups = async () => {
        try {
            const baseUrl = getApiBaseUrl();
            const res = await fetch(`${baseUrl}/fifo/groups`);
            if (res.ok) {
                const data: RackGroup[] = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error('Błąd pobierania stref:', err);
        }
    };

    const handleGroupChange = (groupId: string) => {
        setAssignedGroupId(groupId);
        localStorage.setItem('SCANNER_GROUP_ID', groupId);
    };

    const handleSaveServerIp = () => {
        let cleanedIp = serverIp.trim();
        if (!cleanedIp) return;

        // Czyszczenie formatu wpisanego IP
        cleanedIp = cleanedIp.replace(/^https?:\/\//, '');

        localStorage.setItem('SCANNER_SERVER_IP', cleanedIp);
        setIpSavedMessage(true);

        // Przeładowanie strony z zachowaniem czystego URL
        setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
        }, 600);
    };

    const handleDownloadApk = () => {
        const baseUrl = getApiBaseUrl();
        window.location.href = `${baseUrl}/fifo/download-apk`;
    };

    return (
        <div className="scanner-view min-h-dvh w-full bg-bw-navy text-bw-sand p-3 sm:p-5 font-sans select-none">
            <div className="max-w-lg mx-auto w-full min-h-[calc(100dvh-1.5rem)] flex flex-col justify-between">
                <div>
                    {/* NAGŁÓWEK */}
                    <header className="text-center pt-0.5 pb-1.5 sm:pb-2 border-b border-slate-800 shrink-0">
                        <div className="inline-flex items-center gap-1.5 bg-bw-cyan/10 border border-bw-cyan/30 px-2 py-0.5 rounded-full mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-bw-cyan animate-pulse"></span>
                            <span className="text-[8px] sm:text-[10px] font-mono font-black text-bw-cyan uppercase tracking-widest">
                                SLIDEX FLOW TERMINAL
                            </span>
                        </div>
                        <h1 className="text-sm sm:text-xl font-black text-white tracking-wider leading-tight">
                            WYBÓR OPERACJI
                        </h1>
                        <p className="text-[9px] sm:text-xs font-mono text-slate-400 mt-0.5">
                            Wybierz tryb pracy skanera
                        </p>
                    </header>

                    {/* 📲 BANER POBIERANIA APK (Widoczny TYLKO w przeglądarce) */}
                    {showDownloadBanner && (
                        <div className="mt-2 bg-gradient-to-r from-bw-cyan/20 via-slate-900 to-slate-900 border-2 border-bw-cyan rounded-xl p-2.5 shadow-[0_0_20px_rgba(46,250,217,0.25)] relative animate-in fade-in duration-300">
                            <button
                                onClick={() => setShowDownloadBanner(false)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-lg"
                                title="Zamknij"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex items-start gap-2.5">
                                <div className="p-2 bg-bw-cyan text-slate-950 rounded-lg shrink-0 mt-0.5">
                                    <Smartphone className="w-4 h-4 animate-bounce" />
                                </div>
                                <div className="flex-1 pr-4">
                                    <h3 className="text-xs font-black text-white leading-tight uppercase tracking-wider">
                                        Pobierz Aplikację na Skaner
                                    </h3>
                                    <p className="text-[9px] sm:text-[10px] font-mono text-slate-300 mt-0.5 leading-snug">
                                        Przeglądasz wersję webową. Pobierz aplikację APK dla lepszej obsługi skanera.
                                    </p>

                                    <button
                                        onClick={handleDownloadApk}
                                        className="mt-2 w-full bg-bw-cyan hover:bg-bw-cyan/90 text-slate-950 font-black text-[10px] sm:text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Pobierz Plik APK</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION: STREFA, KONFIGURACJA IP I NAWIGACJA */}
                    <div className="mt-1.5 sm:mt-2.5 space-y-1.5 sm:space-y-2.5">
                        {/* WYBÓR STREFY */}
                        <div className="bg-slate-900/90 p-1.5 sm:p-2.5 rounded-xl border border-slate-800 shadow-md">
                            <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan tracking-wider mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-bw-cyan" />
                                    <span>Strefa Skanera:</span>
                                </span>
                                <span className="text-[7px] sm:text-[8px] text-slate-500 font-bold">SAVED</span>
                            </label>
                            <select
                                value={assignedGroupId}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                className="w-full bg-slate-950 text-white font-black text-[11px] sm:text-xs rounded-md sm:rounded-lg p-1 sm:p-1.5 border border-slate-700 focus:outline-none focus:border-bw-cyan cursor-pointer transition-colors"
                            >
                                <option value="ALL">Wszystkie Strefy (Cała Hala)</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.code} ({g.name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ⚙️ USTAWIENIA IP SERWERA */}
                        <div className="bg-slate-900/90 p-1.5 sm:p-2.5 rounded-xl border border-slate-800 shadow-md">
                            <label className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <Server className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                                    <span>IP Serwera Backend (DEV):</span>
                                </span>
                                {ipSavedMessage && (
                                    <span className="text-[8px] text-emerald-400 font-bold animate-pulse">
                                        ZAPISANO! RESTART...
                                    </span>
                                )}
                            </label>
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={serverIp}
                                    onChange={(e) => setServerIp(e.target.value)}
                                    placeholder="np. 10.237.121.132"
                                    className="flex-1 bg-slate-950 text-bw-cyan font-mono font-black text-[10px] sm:text-xs rounded-md sm:rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:border-bw-cyan"
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveServerIp}
                                    className="bg-slate-800 hover:bg-slate-700 active:bg-bw-cyan active:text-slate-950 text-bw-cyan font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-md sm:rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                >
                                    <Save className="w-3 h-3" />
                                    <span>Zapisz</span>
                                </button>
                            </div>
                        </div>

                        {/* PRZYCISKI MENU */}
                        <div className="space-y-1.5 sm:space-y-2 pt-0.5">
                            {/* 1. SCAN IN */}
                            <a
                                href="/scanner/scan-in"
                                className="group relative bg-slate-900 hover:bg-slate-850 border border-bw-cyan/50 hover:border-bw-cyan p-2 sm:p-3 rounded-xl flex items-center justify-between shadow-lg transition-all duration-300 active:scale-98 overflow-hidden block"
                            >
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bw-cyan/10 border border-bw-cyan/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                                        <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-bw-cyan" />
                                    </div>
                                    <div>
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-bw-cyan block leading-tight">
                                            PRZYJĘCIE / ZAŁADUNEK
                                        </span>
                                        <h2 className="text-xs sm:text-sm font-black text-white leading-tight">
                                            SCAN IN
                                        </h2>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-bw-cyan group-hover:translate-x-1 transition-transform shrink-0" />
                            </a>

                            {/* 2. SCAN OUT */}
                            <a
                                href="/scanner/scan-out"
                                className="group relative bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-bw-cyan p-2 sm:p-3 rounded-xl flex items-center justify-between shadow-lg transition-all duration-300 active:scale-98 overflow-hidden block"
                            >
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                                        <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-bw-cyan transition-colors" />
                                    </div>
                                    <div>
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 block leading-tight">
                                            WYDANIE / POBRANIE
                                        </span>
                                        <h2 className="text-xs sm:text-sm font-black text-white leading-tight">
                                            SCAN OUT
                                        </h2>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-bw-cyan group-hover:translate-x-1 transition-transform shrink-0" />
                            </a>

                            {/* 3. INVENTORY & LOCATOR */}
                            <a
                                href="/scanner/audit"
                                className="group relative bg-amber-500/10 hover:bg-amber-500/15 border border-amber-400/50 hover:border-amber-300 p-2 sm:p-3 rounded-xl flex items-center justify-between shadow-lg transition-all duration-300 active:scale-98 overflow-hidden block"
                            >
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-400/10 border border-amber-400/30 rounded-lg flex items-center justify-center shrink-0">
                                        <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                                    </div>
                                    <div>
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-amber-300 block leading-tight">PEŁNY SPIS REGAŁU</span>
                                        <h2 className="text-xs sm:text-sm font-black text-white leading-tight">AUDIT MODE</h2>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-amber-300 shrink-0" />
                            </a>

                            {/* 4. INVENTORY & LOCATOR */}
                            <a
                                href="/scanner/inventory"
                                className="group relative bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-bw-cyan p-2 sm:p-3 rounded-xl flex items-center justify-between shadow-lg transition-all duration-300 active:scale-98 overflow-hidden block"
                            >
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                                        <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-bw-cyan transition-colors" />
                                    </div>
                                    <div>
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 block leading-tight">
                                            STANY MATERIAŁOWE
                                        </span>
                                        <h2 className="text-xs sm:text-sm font-black text-white leading-tight">
                                            INVENTORY & LOCATOR
                                        </h2>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-bw-cyan group-hover:translate-x-1 transition-transform shrink-0" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* STOPKA */}
                <footer className="mt-2 pt-1.5 border-t border-slate-800 text-center space-y-1 shrink-0">
                    <a
                        href="/"
                        className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] sm:text-xs px-3 py-1 rounded-lg transition-all active:scale-95"
                    >
                        <Tv className="w-3 h-3 text-bw-cyan" />
                        <span>Otwórz Podgląd TV Board</span>
                    </a>
                    <div className="text-[8px] font-mono text-slate-500">
                        BW SLIDEX FIFO FLOW v2.0
                    </div>
                </footer>
            </div>
        </div>
    );
}
