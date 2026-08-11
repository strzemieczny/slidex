import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config/api';

// 🎨 Import wektorowych ikon z lucide-react
import {
    Sun,
    Moon,
    ArrowLeft,
    Building2,
    BarChart3,
    LogIn,
    Target,
    X,
    Map as MapIcon,
    ShieldAlert
} from 'lucide-react';

const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'], autoConnect: true });

interface Material {
    id: string;
    barcode: string;
    partNumber: string;
    quantity?: number | null;
    entryTime: string;
}

interface Lane {
    id: string;
    code: string;
    shelf: number;
    column: number;
    materials: Material[];
}

export interface RackGroup {
    id: string;
    code: string;
    name: string;
}

export interface Rack {
    id: string;
    code: string;
    name: string;
    groupId?: string | null;
    totalShelves: number;
    totalColumns: number;
    laneCapacity: number;
    lanes: Lane[];
}

interface PNStat {
    partNumber: string;
    totalQty: number;
    boxCount: number;
}

const getItemQuantity = (material?: Material | null): number => {
    if (!material) return 0;
    const qty = Number(material.quantity);
    return isNaN(qty) || qty <= 0 ? 1 : qty;
};

// 📏 KOMPONENT SKALOWANIA TEKSTU W ZALEŻNOŚCI OD DŁUGOŚCI CIĄGU
const AutoFitText = ({ text, className = '' }: { text: string; className?: string }) => {
    const charWidth = 9;
    const estimatedWidth = Math.max(text.length * charWidth, 40);

    return (
        <svg
            viewBox={`0 0 ${estimatedWidth} 20`}
            className={`w-full h-full max-h-6 max-w-full ${className}`}
            preserveAspectRatio="xMidYMid meet"
        >
            <text
                x="50%"
                y="50%"
                dominantBaseline="central"
                textAnchor="middle"
                fill="currentColor"
                fontWeight="900"
                fontFamily="monospace"
                fontSize="14"
            >
                {text}
            </text>
        </svg>
    );
};

export default function DashboardIn() {
    const [groups, setGroups] = useState<RackGroup[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);

    const urlParams = new URLSearchParams(window.location.search);
    const initialGroupFromUrl = urlParams.get('group') || 'ALL';

    // ☀️ ODCZYT PARAMETRU MOTYWU Z URL (?light=true LUB ?theme=light)
    const initialIsLight = urlParams.get('light') === 'true' || urlParams.get('theme') === 'light';
    const [isLight, setIsLight] = useState<boolean>(initialIsLight);

    const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupFromUrl);
    const [selectedRackCode, setSelectedRackCode] = useState<string>('');
    const [selectedPartNumber, setSelectedPartNumber] = useState<string>('');
    const [targetLaneCode, setTargetLaneCode] = useState<string>('');

    const [highlightedPartNumber, setHighlightedPartNumber] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [alarm, setAlarm] = useState<{ message: string; laneCode: string } | null>(null);

    useEffect(() => {
        void fetchOverview();
        void fetchGroups();
    }, []);

    // 🎯 Dołączanie do Pokoju w Socket.IO z obsługą reconnecta
    useEffect(() => {
        const joinRooms = () => {
            if (!socket.connected) return;

            socket.emit('join:zone', 'ALL');
            if (selectedGroupId && selectedGroupId !== 'ALL') {
                socket.emit('join:zone', selectedGroupId);
                const matchedGroup = groups.find((g) => g.id === selectedGroupId || g.code.toUpperCase() === selectedGroupId.toUpperCase());
                if (matchedGroup) {
                    socket.emit('join:zone', matchedGroup.id);
                    socket.emit('join:zone', matchedGroup.code);
                }
            }
        };

        joinRooms();
        socket.on('connect', joinRooms);

        return () => {
            socket.off('connect', joinRooms);
        };
    }, [selectedGroupId, groups]);

    const fetchGroups = async (): Promise<void> => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/groups`);
            if (res.ok) {
                const data: RackGroup[] = await res.json();
                setGroups(data);
                const paramGroup = new URLSearchParams(window.location.search).get('group');
                if (paramGroup) {
                    const matchedGroup = data.find((g) => g.code.toUpperCase() === paramGroup.toUpperCase() || g.id === paramGroup);
                    if (matchedGroup) setSelectedGroupId(matchedGroup.id);
                }
            }
        } catch {
            // Ciche ignorowanie błędów pobierania
        }
    };

    const fetchOverview = async (): Promise<void> => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/overview`);
            if (res.ok) {
                const data: Rack[] = await res.json();
                setRacks(data);
            }
        } catch {
            // Ciche ignorowanie błędów pobierania
        }
    };

    // ☀️ FUNKCJA ZMIANY MOTYWU Z AKTUALIZACJĄ PARAMETRU URL
    const toggleTheme = () => {
        const nextLight = !isLight;
        setIsLight(nextLight);

        const newUrl = new URL(window.location.href);
        if (nextLight) {
            newUrl.searchParams.set('light', 'true');
        } else {
            newUrl.searchParams.delete('light');
            newUrl.searchParams.delete('theme');
        }
        window.history.replaceState({}, '', newUrl.toString());
    };

    const handleGroupChange = (groupId: string) => {
        setSelectedGroupId(groupId);
        setSelectedRackCode('');
        setSelectedPartNumber('');
        setTargetLaneCode('');
        setHighlightedPartNumber(null);

        const newUrl = new URL(window.location.href);
        if (groupId === 'ALL') {
            newUrl.searchParams.delete('group');
        } else {
            const groupObj = groups.find((g) => g.id === groupId);
            newUrl.searchParams.set('group', groupObj ? groupObj.code : groupId);
        }
        window.history.replaceState({}, '', newUrl.toString());
    };

    useEffect(() => {
        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);
        const handleOverviewUpdate = () => {
            void fetchOverview();
        };

        const handleHighlight = (data: { type?: string; rackCode: string; partNumber: string; targetLaneCode?: string }) => {
            if (data.type && data.type !== 'IN') return;

            setSelectedRackCode(data?.rackCode || '');
            setSelectedPartNumber(data?.partNumber || '');
            setTargetLaneCode(data?.targetLaneCode || '');
        };

        const handleViolation = (data: { laneCode: string; scanned: string; expected: string }) => {
            setAlarm({
                message: `Tor ${data.laneCode} zawiera inny materiał (${data.expected}). Próba załadunku: ${data.scanned}`,
                laneCode: data.laneCode,
            });
            setTimeout(() => setAlarm(null), 10000);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('lane:updated', handleOverviewUpdate);

        socket.on('pick:highlight', handleHighlight);
        socket.on('put:highlight', handleHighlight);
        socket.on('scanin:highlight', handleHighlight);
        socket.on('fifo:violation', handleViolation);

        if (socket.connected) setIsConnected(true);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('lane:updated', handleOverviewUpdate);
            socket.off('pick:highlight', handleHighlight);
            socket.off('put:highlight', handleHighlight);
            socket.off('scanin:highlight', handleHighlight);
            socket.off('fifo:violation', handleViolation);
        };
    }, []);

    const filteredRacks = selectedGroupId === 'ALL'
        ? racks
        : racks.filter(r => r.groupId === selectedGroupId || groups.find(g => g.id === r.groupId)?.code.toUpperCase() === selectedGroupId.toUpperCase());

    const activeRack = racks.find((r) => r.code === selectedRackCode) || null;

    const targetLane = activeRack && (targetLaneCode || selectedPartNumber)
        ? activeRack.lanes.find((l) => l.code === targetLaneCode) ||
        activeRack.lanes
            .filter((l) => l.materials?.some((m) => m.partNumber === selectedPartNumber))
            .sort((a, b) => new Date(a.materials[0]?.entryTime || 0).getTime() - new Date(b.materials[0]?.entryTime || 0).getTime())[0]
        : null;

    const totalPiecesInGroup = filteredRacks.reduce((acc, rack) => acc + rack.lanes.reduce((lAcc, lane) => lAcc + (lane.materials || []).reduce((mAcc, m) => mAcc + getItemQuantity(m), 0), 0), 0);
    const totalBoxesInGroup = filteredRacks.reduce((acc, rack) => acc + rack.lanes.reduce((lAcc, lane) => lAcc + (lane.materials?.length || 0), 0), 0);

    const partNumberStats: PNStat[] = (() => {
        const map = new Map<string, { totalQty: number; boxCount: number }>();
        filteredRacks.forEach((rack) => {
            rack.lanes.forEach((lane) => {
                (lane.materials || []).forEach((m) => {
                    const pn = m.partNumber.toUpperCase().trim();
                    if (!pn) return;
                    const qty = getItemQuantity(m);
                    const current = map.get(pn) || { totalQty: 0, boxCount: 0 };
                    map.set(pn, { totalQty: current.totalQty + qty, boxCount: current.boxCount + 1 });
                });
            });
        });

        const result: PNStat[] = [];
        map.forEach((data, partNumber) => {
            result.push({ partNumber, totalQty: data.totalQty, boxCount: data.boxCount });
        });

        return result.sort((a, b) => b.totalQty - a.totalQty);
    })();

    const maxPNQuantity = partNumberStats.length > 0 ? partNumberStats[0].totalQty : 1;

    // 🎨 PALETA KOLORÓW DLA MOTYWÓW
    const theme = {
        bg: isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0A0E1A] text-slate-100',
        headerBorder: isLight ? 'border-slate-200' : 'border-slate-800/80',
        cardBg: isLight ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-slate-900/80 backdrop-blur-md shadow-xl',
        cardBorder: isLight ? 'border-slate-200/80' : 'border-slate-800/80',
        innerBg: isLight ? 'bg-slate-50' : 'bg-[#060913]',
        innerBorder: isLight ? 'border-slate-200' : 'border-slate-800/60',
        textPrimary: isLight ? 'text-slate-900' : 'text-slate-100',
        textSecondary: isLight ? 'text-slate-500' : 'text-slate-400',
        selectBg: isLight ? 'bg-white text-teal-800 border-slate-200 shadow-sm' : 'bg-slate-900 text-bw-cyan border-slate-800 shadow-inner',
        emptySlotBg: isLight ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-slate-900/60 border-slate-800/60 text-slate-700',
        filledSlotBg: isLight ? 'bg-teal-600 text-white border-teal-500 shadow-sm' : 'bg-bw-cyan text-slate-950 border-2 border-white shadow-[0_0_12px_rgba(46,250,217,0.3)]',
        targetSlotBg: 'bg-bw-cyan text-slate-950 font-black border-2 border-white animate-bounce z-10 shadow-[0_0_20px_#2EFAD9]',
    };

    return (
        <div className={`min-h-screen w-full p-3 lg:p-6 font-sans select-none flex flex-col justify-between overflow-x-hidden transition-colors duration-300 relative ${theme.bg}`}>
            <style>{`
        @keyframes cinematicZoomIn {
          0% { opacity: 0; transform: scale3d(0.98, 0.98, 1); }
          100% { opacity: 1; transform: scale3d(1, 1, 1); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.01); }
        }
        .animate-zoom-in { animation: cinematicZoomIn 0.25s ease-out forwards; }
        .animate-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
      `}</style>

            {/* 🚨 BANER BŁĘDU / BLOKADY TORU */}
            {alarm && (
                <div className="fixed inset-x-4 top-4 z-50 max-w-5xl mx-auto rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 p-0.5 shadow-[0_0_50px_rgba(244,63,94,0.6)] animate-pulse-glow">
                    <div className="bg-rose-950/90 backdrop-blur-xl rounded-[14px] p-4 lg:p-5 border border-rose-500/40 text-white flex items-start lg:items-center justify-between gap-4">
                        <div className="flex items-start lg:items-center gap-4">
                            <div className="p-3 bg-rose-600 rounded-xl shadow-lg shrink-0">
                                <ShieldAlert className="w-8 h-8 lg:w-10 lg:h-10 text-white animate-bounce" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-rose-500/30 text-rose-200 border border-rose-400/40 text-[10px] lg:text-xs font-mono font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                        ⛔ BLOKADA BEZPIECZEŃSTWA TORU
                                    </span>
                                    <span className="text-xs font-mono text-rose-300 font-bold">SLIDEX LOGISTICS</span>
                                </div>
                                <div className="text-base lg:text-xl font-mono font-black text-rose-100 leading-snug">
                                    {alarm.message}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setAlarm(null)}
                            className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 hover:text-white p-2 rounded-xl border border-rose-500/30 transition-all shrink-0 cursor-pointer active:scale-95"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}

            <div className="w-full">
                {/* HEADER */}
                <header className={`mb-3 lg:mb-5 border-b pb-3 flex items-center justify-between gap-3 w-full ${theme.headerBorder}`}>
                    <div className="flex items-center gap-2 lg:gap-4">
                        <h1 className="text-xl md:text-2xl font-black tracking-widest flex items-center gap-2">
                            <span className={isLight ? 'text-teal-600' : 'text-bw-cyan'}>SLIDEX</span>
                            <span className={`text-[10px] md:text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider border flex items-center gap-1.5 ${
                                isLight ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-bw-cyan/10 text-bw-cyan border-bw-cyan/30'
                            }`}>
                                <LogIn className="w-3.5 h-3.5" />
                                SCAN-IN BOARD
                            </span>
                        </h1>

                        <div className="flex items-center gap-1.5 ml-1">
                            <span className={`text-xs font-mono font-extrabold uppercase ${theme.textSecondary}`}>Strefa:</span>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                className={`font-black text-xs md:text-sm rounded-lg px-3 py-1.5 border focus:outline-none cursor-pointer transition-all ${theme.selectBg}`}
                            >
                                <option value="ALL">Wszystkie Strefy (Cała Hala)</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.code} ({g.name})</option>
                                ))}
                            </select>
                        </div>

                        {activeRack && (
                            <button
                                onClick={() => setSelectedRackCode('')}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                                    isLight ? 'bg-slate-200 hover:bg-slate-300 text-teal-800 border-slate-300' : 'bg-slate-800/80 hover:bg-slate-700 text-bw-cyan border-slate-700'
                                }`}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Powrót do Hali</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 lg:gap-3">
                        <button
                            onClick={toggleTheme}
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                                isLight
                                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
                                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-800'
                            }`}
                        >
                            {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
                            <span>{isLight ? 'Ciemny' : 'Jasny'}</span>
                        </button>

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${theme.cardBg} ${theme.cardBorder}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-rose-500'}`} />
                            <span className={`text-xs font-mono font-black ${theme.textPrimary}`}>{isConnected ? 'LIVE (IN)' : 'OFFLINE'}</span>
                        </div>
                    </div>
                </header>

                {/* BANER STATUSOWY */}
                <div className="mb-4 h-14 flex items-center justify-between gap-3 w-full">
                    <div className="flex-1 h-full">
                        {highlightedPartNumber ? (
                            <div className="w-full h-full bg-bw-cyan text-slate-950 font-black text-xs sm:text-sm lg:text-base px-4 rounded-xl border-2 border-white flex items-center justify-between shadow-[0_0_20px_rgba(46,250,217,0.3)]">
                                <div className="flex items-center gap-3 truncate">
                                    <Target className="w-5 h-5 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                                    <span className="truncate flex items-center gap-2">
                                        FILTRACJA P/N: <strong className="font-mono text-base lg:text-lg underline tracking-tight">{highlightedPartNumber}</strong>
                                    </span>
                                    <span className="font-mono bg-slate-950 text-bw-cyan px-2.5 py-0.5 rounded text-xs ml-2 truncate font-bold">Podświetlone w strefie</span>
                                </div>
                                <button onClick={() => setHighlightedPartNumber(null)} className="bg-slate-950 hover:bg-slate-900 text-bw-cyan font-extrabold text-xs px-3 py-1.5 rounded-lg border border-bw-cyan/40 transition-all active:scale-95 shrink-0 cursor-pointer flex items-center gap-1">
                                    <X className="w-4 h-4" />
                                    <span>Wyczyść</span>
                                </button>
                            </div>
                        ) : selectedPartNumber && activeRack ? (
                            <div className="w-full h-full bg-bw-cyan text-slate-950 font-black text-xs sm:text-sm lg:text-base px-4 rounded-xl border-2 border-white flex items-center justify-between shadow-[0_0_25px_rgba(46,250,217,0.4)] animate-zoom-in">
                                <div className="flex items-center gap-3 truncate">
                                    <LogIn className="w-5 h-5 shrink-0" />
                                    <span className="flex items-center gap-2">
                                        ZAŁADUNEK P/N: <strong className="font-mono text-base lg:text-lg underline tracking-tight">{selectedPartNumber}</strong>
                                    </span>
                                    <span className="font-mono bg-slate-950 text-bw-cyan px-3 py-1 rounded-lg text-xs ml-2 truncate font-bold">
                                        {targetLane ? `TOR DOCELOWY: ${activeRack.code} • S${targetLane.shelf}-C${targetLane.column} (${targetLane.code})` : 'Brak wolnego miejsca'}
                                    </span>
                                </div>
                                <span className="text-xs bg-slate-950 text-bw-cyan px-2.5 py-1 rounded-lg uppercase font-mono font-black tracking-wider">
                                    SCAN-IN
                                </span>
                            </div>
                        ) : (
                            <div className={`w-full h-full border rounded-xl flex items-center px-4 justify-between transition-colors duration-300 ${theme.cardBg} ${theme.cardBorder}`}>
                                <div className="flex items-center gap-3">
                                    <LogIn className="w-5 h-5 text-bw-cyan" />
                                    <div>
                                        <h2 className={`text-sm lg:text-base font-black leading-tight ${theme.textPrimary}`}>KONTROLA ZAŁADUNKU MATERIAŁÓW (SCAN-IN)</h2>
                                        <span className={`text-xs font-mono mt-0.5 block ${isLight ? 'text-teal-700 font-bold' : 'text-bw-cyan'}`}>Aktywne regały w widoku: {filteredRacks.length}</span>
                                    </div>
                                </div>
                                <span className={`text-xs font-mono font-bold tracking-wider ${theme.textSecondary}`}>CZEKAM NA SKANER</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 lg:gap-3 h-full shrink-0">
                        <div className={`h-full px-4 rounded-xl border flex flex-col justify-center text-right ${theme.innerBg} ${isLight ? 'border-teal-300' : 'border-bw-cyan/40'}`}>
                            <span className={`text-[9px] uppercase font-mono font-extrabold tracking-wider ${theme.textSecondary}`}>Łącznie Sztuk</span>
                            <strong className={`font-mono text-base lg:text-xl font-black ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>{totalPiecesInGroup} szt.</strong>
                        </div>
                        <div className={`h-full px-4 rounded-xl border flex flex-col justify-center text-right ${theme.innerBg} ${theme.innerBorder}`}>
                            <span className={`text-[9px] uppercase font-mono font-extrabold tracking-wider ${theme.textSecondary}`}>Pojemniki</span>
                            <strong className={`font-mono text-sm lg:text-lg font-black ${theme.textPrimary}`}>{totalBoxesInGroup} box</strong>
                        </div>
                    </div>
                </div>

                {/* SIATKA REGAŁÓW */}
                <main className="relative w-full space-y-4">
                    {activeRack ? (
                        <div className="space-y-4">
                            {/* MINI-MAPA STREFY - PRZY ZOOMIE */}
                            {filteredRacks.length > 0 && (
                                <div className={`p-3 rounded-xl border transition-colors duration-300 ${theme.cardBg} ${theme.cardBorder}`}>
                                    <div className="flex items-center justify-between mb-2 text-xs font-mono font-bold">
                                        <span className={`uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>
                                            <MapIcon className="w-4 h-4" />
                                            <span>SZYBKA NAWIGACJA STREFY ({filteredRacks.length} REGAŁY)</span>
                                        </span>
                                        <span className={theme.textSecondary}>KLIKNIJ REGAŁ, ABY PRZEŁĄCZYĆ PODGLĄD</span>
                                    </div>

                                    <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5">
                                        {filteredRacks.map((r) => {
                                            const isSelected = r.code === activeRack?.code;
                                            const hasTargetPN = Boolean(selectedPartNumber) && r.lanes.some(l =>
                                                l.materials?.some(m => m.partNumber.toUpperCase().trim() === selectedPartNumber.toUpperCase().trim())
                                            );

                                            return (
                                                <div
                                                    key={r.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedRackCode('');
                                                        } else {
                                                            setSelectedRackCode(r.code);
                                                        }
                                                    }}
                                                    className={`flex-1 min-w-[90px] lg:min-w-[120px] py-2 px-2.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-150 ${
                                                        isSelected
                                                            ? 'bg-bw-cyan text-slate-950 font-black shadow-lg scale-105'
                                                            : hasTargetPN
                                                                ? isLight
                                                                    ? 'bg-teal-100 text-teal-900 border border-teal-400 font-bold'
                                                                    : 'bg-bw-cyan/20 text-bw-cyan border border-bw-cyan/60 font-bold'
                                                                : `${theme.innerBg} ${theme.textPrimary} border ${theme.cardBorder} hover:border-bw-cyan/50`
                                                    }`}
                                                >
                                                    <Building2 className={`w-4 h-4 mb-1 ${
                                                        isSelected ? 'text-slate-950' : (isLight ? 'text-teal-600' : 'text-bw-cyan')
                                                    }`} />
                                                    <span className="text-xs font-mono font-black tracking-wider truncate max-w-full leading-none">
                                                        {r.code}
                                                    </span>
                                                    <span className={`text-[9px] font-mono block mt-0.5 ${
                                                        isSelected ? 'text-slate-900 font-bold' : theme.textSecondary
                                                    }`}>
                                                        {r.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* WIDOK SZCZEGÓŁOWY REGAŁU */}
                            <div className={`animate-zoom-in p-4 lg:p-5 rounded-2xl border-2 overflow-x-auto w-full ${theme.cardBg} ${isLight ? 'border-teal-400' : 'border-bw-cyan/40'}`}>
                                <div className={`flex items-center justify-between mb-4 pb-3 border-b ${theme.cardBorder}`}>
                                    <div className="flex items-center gap-3">
                                        <Building2 className="w-6 h-6 text-bw-cyan" />
                                        <div>
                                            <h2 className={`text-lg lg:text-2xl font-black ${theme.textPrimary}`}>{activeRack.name} ({activeRack.code})</h2>
                                            <span className={`text-xs font-mono font-bold block ${theme.textSecondary}`}>Siatka lokacyjna torów załadunkowych</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedRackCode('')}
                                        className={`font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                                            isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        <X className="w-4 h-4" />
                                        <span>Zamknij Podgląd</span>
                                    </button>
                                </div>

                                <div className="min-w-[750px]">
                                    <div className={`grid grid-cols-[40px_repeat(auto-fit,minmax(0,1fr))] gap-2.5 mb-2.5 text-center text-xs font-black uppercase tracking-wider ${theme.textSecondary}`}>
                                        <div></div>
                                        {Array.from({ length: activeRack.totalColumns }, (_, i) => i + 1).map((col) => (
                                            <div key={col} className={`py-1.5 rounded-lg border font-mono ${theme.innerBg} ${theme.innerBorder} ${theme.textPrimary}`}>KOLUMNA {col}</div>
                                        ))}
                                    </div>

                                    {Array.from({ length: activeRack.totalShelves }, (_, i) => activeRack.totalShelves - i).map((shelf) => (
                                        <div key={shelf} className="grid grid-cols-[40px_repeat(auto-fit,minmax(0,1fr))] gap-2.5 mb-2.5 items-stretch">
                                            <div className={`border rounded-xl flex items-center justify-center p-1 ${theme.innerBg} ${theme.innerBorder}`}>
                                                <span className={`text-base lg:text-xl font-black font-mono ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>{shelf}</span>
                                            </div>

                                            {Array.from({ length: activeRack.totalColumns }, (_, i) => i + 1).map((col) => {
                                                const lane = activeRack.lanes.find((l) => l.shelf === shelf && l.column === col);
                                                const currentBoxes = lane ? lane.materials?.length || 0 : 0;
                                                const totalPiecesInLane = lane && lane.materials ? lane.materials.reduce((sum, m) => sum + getItemQuantity(m), 0) : 0;
                                                const lanePartNumber = lane?.materials?.[0]?.partNumber || null;
                                                const isViolated = alarm?.laneCode === lane?.code;
                                                const isLaneHighlighted = Boolean(targetLane) && targetLane?.id === lane?.id;
                                                const capacity = activeRack.laneCapacity;

                                                return (
                                                    <div
                                                        key={col}
                                                        className={`p-2.5 rounded-xl border transition-all duration-200 relative flex flex-col justify-between min-h-[170px] lg:min-h-[200px] ${
                                                            isViolated
                                                                ? 'bg-rose-950/90 border-rose-500 text-white animate-pulse'
                                                                : isLaneHighlighted
                                                                    ? `${theme.cardBg} border-bw-cyan border-2 z-10 shadow-[0_0_15px_rgba(46,250,217,0.3)]`
                                                                    : selectedPartNumber
                                                                        ? `${theme.innerBg} border-slate-300 opacity-25`
                                                                        : currentBoxes > 0
                                                                            ? `${theme.innerBg} ${theme.cardBorder}`
                                                                            : `${theme.innerBg} border-dashed ${theme.cardBorder}`
                                                        }`}
                                                    >
                                                        <div className={`flex justify-between items-center pb-2 border-b ${theme.cardBorder} gap-1 overflow-hidden`}>
                                                            <div className="shrink-0">
                                                                <span className={`text-xs font-black font-mono block ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>S{shelf}-C{col}</span>
                                                                <div className={`text-[9px] font-mono font-bold ${theme.textSecondary}`}>{lane?.code}</div>
                                                            </div>

                                                            <div className="flex-1 text-center px-1 overflow-hidden h-6 flex items-center justify-center">
                                                                {lanePartNumber ? (
                                                                    <div className={`w-full h-full px-1.5 rounded flex items-center justify-center ${
                                                                        isLaneHighlighted
                                                                            ? 'bg-bw-cyan text-slate-950 border border-white font-black'
                                                                            : isLight
                                                                                ? 'bg-teal-100 border border-teal-300 text-teal-900 font-bold'
                                                                                : 'bg-bw-cyan/10 border border-bw-cyan/30 text-white font-bold'
                                                                    }`}>
                                                                        <AutoFitText text={lanePartNumber} />
                                                                    </div>
                                                                ) : (
                                                                    <span className={`text-[9px] font-mono font-bold uppercase ${theme.textSecondary}`}>[ WOLNY ]</span>
                                                                )}
                                                            </div>

                                                            <div className="text-right shrink-0">
                                                                <div className={`text-sm lg:text-base font-black font-mono leading-none ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>
                                                                    {totalPiecesInLane} <span className={`text-[9px] ${theme.textSecondary}`}>szt.</span>
                                                                </div>
                                                                <span className={`text-[9px] font-mono font-bold block mt-0.5 ${theme.textSecondary}`}>({currentBoxes}/{capacity})</span>
                                                            </div>
                                                        </div>

                                                        <div className="my-2 grid grid-cols-5 gap-1.5 items-stretch min-h-[65px] lg:min-h-[85px]">
                                                            {Array.from({ length: capacity }, (_, slotIndex) => {
                                                                const box = lane?.materials?.[slotIndex];
                                                                const isFifoHead = slotIndex === 0 && Boolean(box);

                                                                return (
                                                                    <div
                                                                        key={box?.id || slotIndex}
                                                                        className={`p-1 rounded-lg border flex flex-col justify-between overflow-hidden transition-all duration-150 ${
                                                                            box
                                                                                ? isLaneHighlighted && isFifoHead
                                                                                    ? theme.targetSlotBg
                                                                                    : isFifoHead
                                                                                        ? isLight
                                                                                            ? 'bg-teal-700 text-white border border-teal-900 shadow-sm'
                                                                                            : 'bg-slate-900 border border-bw-cyan text-white shadow-sm'
                                                                                        : isLight
                                                                                            ? 'bg-slate-200 border border-slate-300 text-slate-900'
                                                                                            : 'bg-slate-900/80 border border-slate-700 text-white'
                                                                                : isLight
                                                                                    ? 'border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[8px] font-black uppercase'
                                                                                    : 'border border-dashed border-slate-800/80 rounded-lg flex flex-col items-center justify-center text-slate-600 text-[8px] font-black uppercase'
                                                                        }`}
                                                                    >
                                                                        {box ? (
                                                                            <>
                                                                                <div className="flex items-center justify-between border-b border-slate-500/30 pb-0.5">
                                                                                    <span className={`text-[8px] font-black uppercase ${
                                                                                        isLaneHighlighted && isFifoHead ? 'text-slate-950' : isFifoHead ? (isLight ? 'text-amber-300' : 'text-bw-cyan') : theme.textSecondary
                                                                                    }`}>
                                                                                        {isLaneHighlighted && isFifoHead ? 'IN' : isFifoHead ? '★' : `#${slotIndex + 1}`}
                                                                                    </span>
                                                                                    <span className={`text-[9px] font-mono font-black px-1 rounded ${
                                                                                        isLaneHighlighted && isFifoHead ? 'bg-slate-950 text-bw-cyan' : isLight ? 'bg-white text-teal-800' : 'text-bw-cyan bg-bw-cyan/10'
                                                                                    }`}>
                                                                                        {getItemQuantity(box)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="my-auto py-0.5 text-center overflow-hidden h-4 flex items-center">
                                                                                    <AutoFitText text={box.barcode} className={isLaneHighlighted && isFifoHead ? 'text-slate-950' : theme.textPrimary} />
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <div className="m-auto text-center">
                                                                                <span className="block text-[7px] text-slate-500 font-bold">SLOT</span>
                                                                                <span className="block text-[9px] text-slate-400 font-black">{slotIndex + 1}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className={`w-full h-1.5 rounded-full overflow-hidden border ${theme.innerBg} ${theme.cardBorder}`}>
                                                            <div className={`h-full transition-all duration-300 ease-out ${isLight ? 'bg-teal-600' : 'bg-bw-cyan'}`} style={{ width: `${(currentBoxes / capacity) * 100}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* WIDOK OGÓLNY REGAŁÓW (KAFELKI) */
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-4 lg:gap-5 w-full animate-zoom-in">
                            {filteredRacks.map((rack) => (
                                <div
                                    key={rack.id}
                                    onClick={() => setSelectedRackCode(rack.code)}
                                    className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${theme.cardBg} ${theme.cardBorder} hover:scale-[1.01] ${
                                        isLight ? 'hover:border-teal-500 hover:shadow-md' : 'hover:border-bw-cyan hover:shadow-xl'
                                    }`}
                                >
                                    <div className={`flex items-center justify-between mb-2.5 pb-2 border-b ${theme.cardBorder}`}>
                                        <span className={`text-xs lg:text-sm font-mono font-black ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>{rack.code}</span>
                                        <h3 className={`text-xs lg:text-sm font-black ${theme.textPrimary}`}>{rack.name}</h3>
                                    </div>
                                    <div className={`grid gap-1.5 mb-1 p-2 rounded-xl border ${theme.innerBg} ${theme.innerBorder}`} style={{ gridTemplateRows: `repeat(${rack.totalShelves}, minmax(0, 1fr))` }}>
                                        {Array.from({ length: rack.totalShelves }, (_, sIdx) => {
                                            const shelfNum = rack.totalShelves - sIdx;
                                            return (
                                                <div key={shelfNum} className="grid gap-1.5 w-full" style={{ gridTemplateColumns: `repeat(${rack.totalColumns}, minmax(0, 1fr))` }}>
                                                    {Array.from({ length: rack.totalColumns }, (_, cIdx) => {
                                                        const colNum = cIdx + 1;
                                                        const lane = rack.lanes.find((l) => l.shelf === shelfNum && l.column === colNum);
                                                        const hasStock = Boolean(lane && lane.materials?.length > 0);
                                                        const lanePN = lane?.materials?.[0]?.partNumber;
                                                        const isHighlightedByChart = Boolean(highlightedPartNumber && lanePN?.toUpperCase().trim() === highlightedPartNumber.toUpperCase().trim());

                                                        return (
                                                            <div
                                                                key={colNum}
                                                                className={`h-11 sm:h-12 lg:h-14 rounded-lg flex items-center justify-center font-mono font-black transition-all duration-200 overflow-hidden text-center p-1 ${
                                                                    isHighlightedByChart
                                                                        ? `bg-bw-cyan text-slate-950 font-black border border-white z-10 animate-pulse shadow-[0_0_15px_#2EFAD9]`
                                                                        : highlightedPartNumber
                                                                            ? 'opacity-20'
                                                                            : hasStock
                                                                                ? theme.filledSlotBg
                                                                                : `${theme.emptySlotBg} text-xs`
                                                                }`}
                                                            >
                                                                {hasStock ? (
                                                                    <AutoFitText text={lanePN || 'OK'} />
                                                                ) : (
                                                                    <span className="text-slate-500/50">•</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* WYKRES SŁUPKOWY PER PART NUMBER */}
                    {!activeRack && partNumberStats.length > 0 && (
                        <div className={`p-4 lg:p-6 rounded-2xl border-2 w-full animate-zoom-in mt-6 transition-colors duration-300 ${theme.cardBg} ${theme.cardBorder}`}>
                            <div className={`flex items-center justify-between mb-4 pb-3 border-b flex-wrap gap-2 ${theme.cardBorder}`}>
                                <div className="flex items-center gap-2.5">
                                    <BarChart3 className="w-5 h-5 text-bw-cyan" />
                                    <div>
                                        <h3 className={`text-sm lg:text-base font-black tracking-wide ${theme.textPrimary}`}>
                                            STATYSTYKA STREFY • STANY MATERIAŁOWE PER PART NUMBER (SCAN-IN)
                                        </h3>
                                        <span className={`text-xs font-mono block ${theme.textSecondary}`}>
                                            Kliknij na słupek, aby podświetlić lokalizację danego Part Numberu
                                        </span>
                                    </div>
                                </div>

                                <span className={`text-xs font-mono font-black border px-3 py-1.5 rounded-xl ${
                                    isLight ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-bw-cyan/10 text-bw-cyan border-bw-cyan/30'
                                }`}>
                                    TOTAL: {totalPiecesInGroup} szt. ({totalBoxesInGroup} box)
                                </span>
                            </div>

                            <div className="overflow-x-auto pb-2 pt-1">
                                <div className={`flex items-end gap-3 lg:gap-4 min-w-max h-[210px] lg:h-[260px] pt-8 pb-2 px-3 border-b-2 ${theme.cardBorder}`}>
                                    {partNumberStats.map((item) => {
                                        const heightPercentage = Math.round((item.totalQty / maxPNQuantity) * 100);
                                        const isSelected = highlightedPartNumber === item.partNumber;

                                        return (
                                            <div
                                                key={item.partNumber}
                                                onClick={() => setHighlightedPartNumber(isSelected ? null : item.partNumber)}
                                                className={`flex flex-col items-center h-full justify-end min-w-[100px] lg:min-w-[125px] group cursor-pointer transition-transform duration-200 ${
                                                    isSelected ? '-translate-y-1 z-10' : 'hover:-translate-y-0.5'
                                                }`}
                                            >
                                                <div className="mb-1.5 text-center">
                                                    <span className={`text-base lg:text-xl font-mono font-black block leading-none ${
                                                        isSelected
                                                            ? (isLight ? 'text-teal-800' : 'text-white')
                                                            : (isLight ? 'text-teal-600 group-hover:text-teal-900' : 'text-bw-cyan group-hover:text-white')
                                                    }`}>
                                                        {item.totalQty}
                                                    </span>
                                                    <span className={`text-[10px] font-mono font-bold uppercase block mt-0.5 tracking-wider ${theme.textSecondary}`}>
                                                        {item.boxCount} box
                                                    </span>
                                                </div>

                                                <div className={`w-full rounded-t-xl overflow-hidden border-x border-t transition-colors duration-200 flex flex-col justify-end h-full p-1 ${theme.innerBg} ${
                                                    isSelected ? 'border-bw-cyan shadow-[0_0_15px_rgba(46,250,217,0.3)]' : theme.cardBorder
                                                }`}>
                                                    <div
                                                        className={`w-full rounded-t-lg transition-all duration-300 ease-out ${
                                                            isSelected
                                                                ? 'bg-bw-cyan shadow-[0_0_15px_#2EFAD9]'
                                                                : isLight
                                                                    ? 'bg-teal-500 group-hover:bg-teal-400'
                                                                    : 'bg-bw-cyan/70 group-hover:bg-bw-cyan'
                                                        }`}
                                                        style={{ height: `${Math.max(heightPercentage, 10)}%` }}
                                                    />
                                                </div>

                                                <div className={`mt-2 text-center w-full h-8 py-1 px-1 rounded-xl border transition-colors duration-200 flex items-center justify-center ${
                                                    isSelected
                                                        ? 'bg-bw-cyan text-slate-950 border-white font-black shadow-md'
                                                        : `${theme.innerBg} ${theme.textPrimary} ${theme.cardBorder}`
                                                }`}>
                                                    <AutoFitText text={item.partNumber} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}