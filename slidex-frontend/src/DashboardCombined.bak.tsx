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
    RefreshCw,
    LogIn,
    LogOut,
    Target,
    AlertTriangle,
    X,
    Map as MapIcon
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

// 📏 RESPONSYWNA FUNKCJA CZCIONEK: Mniejsze na laptopach/FHD, GIANT dla 4K (3xl:)
const getPNFontSize = (pn?: string | null, isHighlighted?: boolean): string => {
    if (!pn) return 'text-xs 2xl:text-base 3xl:text-lg';
    const len = pn.trim().length;

    if (isHighlighted) {
        if (len <= 8) return 'text-sm xl:text-lg 2xl:text-2xl 3xl:text-4xl tracking-wider';
        if (len <= 10) return 'text-xs xl:text-base 2xl:text-xl 3xl:text-3xl tracking-tight';
        return 'text-[10px] xl:text-sm 2xl:text-lg 3xl:text-2xl tracking-tighter';
    }

    if (len <= 8) {
        return 'text-xs xl:text-sm 2xl:text-xl 3xl:text-3xl tracking-wide';
    } else if (len <= 10) {
        return 'text-[11px] xl:text-xs 2xl:text-lg 3xl:text-2xl tracking-tight';
    } else {
        return 'text-[9px] xl:text-[11px] 2xl:text-base 3xl:text-xl tracking-tighter';
    }
};

export default function DashboardCombined() {
    const [groups, setGroups] = useState<RackGroup[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);

    const urlParams = new URLSearchParams(window.location.search);
    const initialGroupFromUrl = urlParams.get('group') || 'ALL';

    const initialIsLight = urlParams.get('light') === 'true' || urlParams.get('theme') === 'light';
    const [isLight, setIsLight] = useState<boolean>(initialIsLight);

    const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupFromUrl);
    const [selectedRackCode, setSelectedRackCode] = useState<string>('');
    const [selectedPartNumber, setSelectedPartNumber] = useState<string>('');
    const [targetLaneCode, setTargetLaneCode] = useState<string>('');
    const [actionType, setActionType] = useState<'IN' | 'OUT' | null>(null);

    const [highlightedPartNumber, setHighlightedPartNumber] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [alarm, setAlarm] = useState<{ message: string; laneCode: string } | null>(null);

    useEffect(() => {
        fetchOverview().catch((err) => console.error(err));
        fetchGroups().catch((err) => console.error(err));
    }, []);

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
        } catch (err) {
            console.error('Błąd pobierania grup:', err);
        }
    };

    const fetchOverview = async (): Promise<void> => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/overview`);
            if (!res.ok) throw new Error('Błąd pobierania danych');
            const data: Rack[] = await res.json();
            setRacks(data);
        } catch (err) {
            console.error('Błąd pobierania danych:', err);
        }
    };

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
        setActionType(null);
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
            fetchOverview().catch((err) => console.error(err));
        };

        const handleHighlight = (data: { type?: 'IN' | 'OUT'; rackCode: string; partNumber: string; targetLaneCode?: string }) => {
            setSelectedRackCode(data?.rackCode || '');
            setSelectedPartNumber(data?.partNumber || '');
            setTargetLaneCode(data?.targetLaneCode || '');
            setActionType(data?.type || 'IN');
        };

        const handleViolation = (data: { laneCode: string; scanned: string; expected: string }) => {
            setAlarm({
                message: `BŁĄD FIFO [Tor ${data.laneCode}] -> Zeskanowano: ${data.scanned} | Wymagany: ${data.expected}`,
                laneCode: data.laneCode,
            });
            setTimeout(() => setAlarm(null), 7000);
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

    const theme = {
        bg: isLight ? 'bg-slate-100 text-slate-900' : 'bg-bw-navy text-bw-sand',
        headerBorder: isLight ? 'border-slate-300' : 'border-slate-800',
        cardBg: isLight ? 'bg-white/90 shadow-md' : 'bg-slate-900/90',
        cardBorder: isLight ? 'border-slate-300' : 'border-slate-800',
        innerBg: isLight ? 'bg-slate-100' : 'bg-slate-950',
        innerBorder: isLight ? 'border-slate-300' : 'border-slate-800/80',
        textPrimary: isLight ? 'text-slate-900' : 'text-white',
        textSecondary: isLight ? 'text-slate-600' : 'text-slate-400',
        selectBg: isLight ? 'bg-white text-teal-700 border-slate-300' : 'bg-slate-900 text-bw-cyan border-slate-800',
        emptySlotBg: isLight ? 'bg-slate-200/50 border-slate-300 text-slate-400' : 'bg-slate-900/70 border-slate-800/60 text-slate-700',
        filledSlotBg: isLight ? 'bg-teal-600 text-white border-teal-500 font-black shadow-sm' : 'bg-bw-cyan text-slate-950 font-black shadow-[0_0_12px_rgba(46,250,217,0.6)] border-2 border-white',
        targetSlotBg: 'bg-bw-cyan text-slate-950 font-black scale-105 border-2 3xl:border-4 border-white shadow-[0_0_30px_#2EFAD9] animate-bounce z-10',
    };

    return (
        <div className={`min-h-screen w-full p-4 3xl:p-6 font-sans select-none flex flex-col justify-between overflow-x-hidden transition-colors duration-300 ${theme.bg}`}>
            <style>{`
        @keyframes cinematicZoomIn {
          0% { opacity: 0; transform: scale3d(0.88, 0.88, 1) translateY(20px); filter: blur(8px); }
          40% { opacity: 0.6; filter: blur(2px); }
          100% { opacity: 1; transform: scale3d(1, 1, 1) translateY(0); filter: blur(0px); }
        }
        .animate-zoom-in { animation: cinematicZoomIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>

            <div className="w-full">
                {/* HEADER */}
                <header className={`mb-4 3xl:mb-6 border-b-2 pb-3 3xl:pb-4 flex items-center justify-between gap-4 3xl:gap-6 w-full ${theme.headerBorder}`}>
                    <div className="flex items-center gap-3 3xl:gap-4">
                        <h1 className="text-xl 2xl:text-2xl 3xl:text-4xl font-black tracking-widest flex items-center gap-2 3xl:gap-3">
                            <span className={isLight ? 'text-teal-600' : 'text-bw-cyan'}>SLIDEX</span>
                            <span className={`text-[10px] 2xl:text-xs 3xl:text-base font-extrabold px-2.5 3xl:px-4 py-0.5 3xl:py-1.5 rounded-full uppercase tracking-widest border flex items-center gap-1.5 3xl:gap-2 ${
                                isLight ? 'bg-teal-100 text-teal-800 border-teal-300' : 'bg-bw-cyan/20 text-bw-cyan border-bw-cyan/40'
                            }`}>
                                <RefreshCw className="w-3.5 h-3.5 3xl:w-5 3xl:h-5" />
                                UNIFIED DASHBOARD ({isLight ? 'LIGHT MODE' : 'DARK MODE'})
                            </span>
                        </h1>

                        <div className="flex items-center gap-1.5 3xl:gap-2 ml-2 3xl:ml-4">
                            <span className={`text-[11px] 2xl:text-xs 3xl:text-sm font-extrabold uppercase ${theme.textSecondary}`}>Strefa:</span>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                className={`font-black text-xs 2xl:text-sm 3xl:text-lg rounded-lg 3xl:rounded-xl px-2.5 3xl:px-4 py-1 3xl:py-2 border focus:outline-none cursor-pointer ${theme.selectBg}`}
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
                                className={`text-xs 2xl:text-sm 3xl:text-base font-bold px-3 3xl:px-4 py-1 3xl:py-2 rounded-lg 3xl:rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 3xl:gap-2 ${
                                    isLight ? 'bg-slate-200 hover:bg-slate-300 text-teal-800 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-bw-cyan border-slate-700'
                                }`}
                            >
                                <ArrowLeft className="w-4 h-4 3xl:w-5 3xl:h-5" />
                                <span>Powrót do Strefy</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 3xl:gap-4">
                        <button
                            onClick={toggleTheme}
                            className={`px-3 3xl:px-4 py-1 3xl:py-2 rounded-xl 3xl:rounded-2xl font-extrabold text-xs 2xl:text-sm 3xl:text-base border transition-all active:scale-95 flex items-center gap-1.5 3xl:gap-2 cursor-pointer ${
                                isLight
                                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
                                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-800'
                            }`}
                        >
                            {isLight ? <Moon className="w-4 h-4 3xl:w-5 3xl:h-5 text-slate-700" /> : <Sun className="w-4 h-4 3xl:w-5 3xl:h-5 text-amber-400" />}
                            <span>{isLight ? 'Dark' : 'Light'}</span>
                        </button>

                        <div className={`flex items-center gap-2 3xl:gap-3 px-3 3xl:px-4 py-1 3xl:py-2 rounded-xl 3xl:rounded-2xl border ${theme.cardBg} ${theme.cardBorder}`}>
                            <span className={`w-2.5 h-2.5 3xl:w-3.5 3xl:h-3.5 rounded-full transition-colors duration-500 ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_12px_#10B981]' : 'bg-rose-500'}`} />
                            <span className={`text-xs 2xl:text-sm 3xl:text-base font-extrabold ${theme.textPrimary}`}>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                        </div>
                    </div>
                </header>

                {/* BANER STATUSOWY */}
                <div className="mb-4 3xl:mb-6 h-14 3xl:h-20 flex items-center justify-between gap-4 3xl:gap-6 w-full">
                    <div className="flex-1 h-full">
                        {alarm ? (
                            <div className="w-full h-full bg-rose-600 text-white font-black text-sm 2xl:text-base 3xl:text-xl px-4 3xl:px-6 rounded-xl 3xl:rounded-2xl border-2 3xl:border-4 border-rose-400 flex items-center justify-between animate-pulse shadow-2xl">
                                <div className="flex items-center gap-3 3xl:gap-4 truncate">
                                    <AlertTriangle className="w-5 h-5 3xl:w-8 3xl:h-8 shrink-0" />
                                    <span className="truncate tracking-wide">{alarm.message}</span>
                                </div>
                                <span className="text-[10px] 2xl:text-xs 3xl:text-sm bg-black/50 px-2.5 3xl:px-4 py-1 3xl:py-2 rounded-lg font-bold uppercase tracking-widest shrink-0 ml-3">BLOKADA FIFO</span>
                            </div>
                        ) : highlightedPartNumber ? (
                            <div className="w-full h-full bg-bw-cyan text-slate-950 font-black text-sm 2xl:text-base 3xl:text-xl px-4 3xl:px-6 rounded-xl 3xl:rounded-2xl border-2 3xl:border-4 border-white flex items-center justify-between shadow-[0_0_30px_#2EFAD9] transition-all duration-300 transform scale-[1.005]">
                                <div className="flex items-center gap-3 3xl:gap-4 truncate">
                                    <Target className="w-5 h-5 3xl:w-8 3xl:h-8 animate-bounce shrink-0" />
                                    <span className="truncate flex items-center gap-2">
                                        PODŚWIETLANIE P/N: <strong className="font-mono text-base 2xl:text-xl 3xl:text-3xl underline tracking-tight">{highlightedPartNumber}</strong>
                                    </span>
                                    <span className="font-mono bg-slate-950 text-bw-cyan px-2.5 3xl:px-4 py-1 3xl:py-1.5 rounded-lg 3xl:rounded-xl text-xs 2xl:text-sm 3xl:text-base ml-2 3xl:ml-4 truncate">Lokalizacje oznaczone na siatce</span>
                                </div>
                                <button onClick={() => setHighlightedPartNumber(null)} className="bg-slate-950 hover:bg-slate-900 text-bw-cyan font-extrabold text-xs 2xl:text-sm 3xl:text-base px-3 3xl:px-4 py-1.5 3xl:py-2 rounded-lg 3xl:rounded-xl border border-bw-cyan/40 3xl:border-2 transition-all active:scale-95 shrink-0 ml-3 cursor-pointer flex items-center gap-1.5 3xl:gap-2">
                                    <X className="w-4 h-4 3xl:w-5 3xl:h-5" />
                                    <span>Wyczyść filtr P/N</span>
                                </button>
                            </div>
                        ) : selectedPartNumber && activeRack ? (
                            <div className="w-full h-full bg-bw-cyan text-slate-950 font-black text-sm 2xl:text-base 3xl:text-xl px-4 3xl:px-6 rounded-xl 3xl:rounded-2xl border-2 3xl:border-4 border-white flex items-center justify-between animate-pulse animate-zoom-in shadow-2xl">
                                <div className="flex items-center gap-3 3xl:gap-4 truncate">
                                    {actionType === 'OUT' ? <LogOut className="w-5 h-5 3xl:w-8 3xl:h-8 shrink-0" /> : <LogIn className="w-5 h-5 3xl:w-8 3xl:h-8 shrink-0" />}
                                    <span className="flex items-center gap-2">
                                        {actionType === 'OUT' ? 'WYDANIE P/N: ' : 'ZAŁADUNEK P/N: '}
                                        <strong className="font-mono text-base 2xl:text-xl 3xl:text-3xl underline tracking-tight">{selectedPartNumber}</strong>
                                    </span>
                                    <span className="font-mono bg-slate-950 text-bw-cyan px-2.5 3xl:px-4 py-1 3xl:py-1.5 rounded-lg 3xl:rounded-xl text-xs 2xl:text-sm 3xl:text-base ml-2 3xl:ml-4 truncate">
                                        {targetLane ? `DOCELOWY TOR: ${activeRack.code} • S${targetLane.shelf}-C${targetLane.column} (${targetLane.code})` : 'Brak wolnego toru'}
                                    </span>
                                </div>
                                <span className="text-[10px] 2xl:text-xs 3xl:text-sm bg-slate-950 text-bw-cyan px-2 py-1 3xl:px-3 3xl:py-1.5 rounded-md 3xl:rounded-lg uppercase font-bold tracking-wider">
                                    {actionType === 'OUT' ? 'SCAN-OUT ACTIVE' : 'SCAN-IN ACTIVE'}
                                </span>
                            </div>
                        ) : (
                            <div className={`w-full h-full border 3xl:border-2 rounded-xl 3xl:rounded-2xl flex items-center px-4 3xl:px-6 justify-between transition-all duration-300 ${theme.cardBg} ${theme.cardBorder}`}>
                                <div className="flex items-center gap-3 3xl:gap-4">
                                    <RefreshCw className="w-5 h-5 3xl:w-8 3xl:h-8 text-bw-cyan" />
                                    <div>
                                        <h2 className={`text-base 2xl:text-lg 3xl:text-2xl font-black leading-tight ${theme.textPrimary}`}>MONITOR HALI (WJAZD & WYJAZD)</h2>
                                        <span className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono mt-0.5 3xl:mt-1 block ${isLight ? 'text-teal-700 font-bold' : 'text-bw-cyan'}`}>Zdefiniowane regały: {filteredRacks.length}</span>
                                    </div>
                                </div>
                                <span className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono font-bold tracking-wider ${theme.textSecondary}`}>CZEKAM NA SKANOWANIE</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 3xl:gap-4 h-full shrink-0">
                        <div className={`h-full px-4 3xl:px-6 rounded-xl 3xl:rounded-2xl border 3xl:border-2 flex flex-col justify-center text-right ${theme.innerBg} ${isLight ? 'border-teal-300' : 'border-bw-cyan/60'}`}>
                            <span className={`text-[9px] 2xl:text-xs uppercase font-extrabold tracking-wider ${theme.textSecondary}`}>Łącznie Sztuk</span>
                            <strong className={`font-mono text-lg 2xl:text-xl 3xl:text-3xl font-black ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>{totalPiecesInGroup} szt.</strong>
                        </div>
                        <div className={`h-full px-4 3xl:px-6 rounded-xl 3xl:rounded-2xl border 3xl:border-2 flex flex-col justify-center text-right ${theme.innerBg} ${theme.innerBorder}`}>
                            <span className={`text-[9px] 2xl:text-xs uppercase font-extrabold tracking-wider ${theme.textSecondary}`}>Pojemniki</span>
                            <strong className={`font-mono text-base 2xl:text-lg 3xl:text-2xl font-black ${theme.textPrimary}`}>{totalBoxesInGroup} box</strong>
                        </div>
                    </div>
                </div>

                {/* SIATKA REGAŁÓW */}
                <main className="relative w-full space-y-6 3xl:space-y-8">
                    {activeRack ? (
                        <div className="space-y-4 3xl:space-y-6">
                            {/* 🗺️ MINI-MAPA STREFY - WIDOCZNA TYLKO W TRYBIE ZOOM */}
                            {filteredRacks.length > 0 && (
                                <div className={`p-3 3xl:p-4 rounded-xl 3xl:rounded-2xl border 3xl:border-2 transition-all duration-300 ${theme.cardBg} ${theme.cardBorder}`}>
                                    <div className="flex items-center justify-between mb-2 3xl:mb-3 text-xs 3xl:text-sm font-mono font-bold">
                                        <span className={`uppercase tracking-wider flex items-center gap-1.5 3xl:gap-2 ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>
                                            <MapIcon className="w-4 h-4 3xl:w-5 3xl:h-5" />
                                            <span>MAPA STREFY ({filteredRacks.length} REGAŁY)</span>
                                        </span>
                                        <span className={theme.textSecondary}>KLIKNIJ REGAŁ, ABY PRZEŁĄCZYĆ ZOOM</span>
                                    </div>

                                    <div className="flex items-center gap-3 3xl:gap-4 overflow-x-auto py-2 px-1">
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
                                                    className={`flex-1 min-w-[110px] 3xl:min-w-[150px] py-2.5 3xl:py-3.5 px-3 3xl:px-4 rounded-lg 3xl:rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                                                        isSelected
                                                            ? 'bg-bw-cyan text-slate-950 font-black shadow-[0_0_20px_rgba(46,250,217,0.7)]'
                                                            : hasTargetPN
                                                                ? isLight
                                                                    ? 'bg-teal-100 text-teal-900 border border-teal-400 animate-pulse font-bold'
                                                                    : 'bg-bw-cyan/20 text-bw-cyan border border-bw-cyan/60 animate-pulse font-bold'
                                                                : `${theme.innerBg} ${theme.textPrimary} border ${theme.cardBorder} hover:border-bw-cyan`
                                                    }`}
                                                >
                                                    <Building2 className={`w-4 h-4 3xl:w-6 3xl:h-6 mb-1 ${
                                                        isSelected ? 'text-slate-950' : (isLight ? 'text-teal-600' : 'text-bw-cyan')
                                                    }`} />
                                                    <span className="text-xs 2xl:text-sm 3xl:text-base font-mono font-black tracking-wider truncate max-w-full">
                                                        {r.code}
                                                    </span>
                                                    <span className={`text-[10px] 3xl:text-[11px] font-mono block mt-0.5 ${
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

                            {/* WIDOK SZCZEGÓŁOWY REGAŁU (ZOOM) */}
                            <div className={`animate-zoom-in p-5 3xl:p-8 rounded-2xl 3xl:rounded-3xl border-2 3xl:border-4 shadow-2xl overflow-x-auto w-full ${theme.cardBg} ${isLight ? 'border-teal-400' : 'border-bw-cyan/40'}`}>
                                <div className={`flex items-center justify-between mb-4 3xl:mb-6 pb-3 3xl:pb-4 border-b 3xl:border-b-2 ${theme.cardBorder}`}>
                                    <div className="flex items-center gap-3 3xl:gap-4">
                                        <Building2 className="w-6 h-6 3xl:w-10 3xl:h-10 text-bw-cyan" />
                                        <div>
                                            <h2 className={`text-xl 2xl:text-2xl 3xl:text-4xl font-black ${theme.textPrimary}`}>{activeRack.name} ({activeRack.code})</h2>
                                            <span className={`text-xs 2xl:text-sm 3xl:text-base font-mono font-bold block mt-0.5 3xl:mt-1 ${theme.textSecondary}`}>Siatka torów regału</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedRackCode('')}
                                        className={`font-bold text-xs 2xl:text-sm 3xl:text-base px-4 3xl:px-6 py-2 3xl:py-3 rounded-xl 3xl:rounded-2xl transition-all active:scale-95 flex items-center gap-1.5 3xl:gap-2 ${
                                            isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        <X className="w-4 h-4 3xl:w-6 3xl:h-6" />
                                        <span>Zamknij Zoom</span>
                                    </button>
                                </div>

                                <div className="min-w-[850px] 3xl:min-w-[1000px]">
                                    <div className={`grid grid-cols-[45px_repeat(auto-fit,minmax(0,1fr))] 3xl:grid-cols-[60px_repeat(auto-fit,minmax(0,1fr))] gap-4 3xl:gap-6 mb-3 3xl:mb-4 text-center text-xs 2xl:text-sm 3xl:text-lg font-black uppercase tracking-wider ${theme.textSecondary}`}>
                                        <div></div>
                                        {Array.from({ length: activeRack.totalColumns }, (_, i) => i + 1).map((col) => (
                                            <div key={col} className={`py-2 3xl:py-3 rounded-lg 3xl:rounded-xl border 3xl:border-2 ${theme.innerBg} ${theme.innerBorder} ${theme.textPrimary}`}>KOLUMNA {col}</div>
                                        ))}
                                    </div>

                                    {Array.from({ length: activeRack.totalShelves }, (_, i) => activeRack.totalShelves - i).map((shelf) => (
                                        <div key={shelf} className="grid grid-cols-[45px_repeat(auto-fit,minmax(0,1fr))] 3xl:grid-cols-[60px_repeat(auto-fit,minmax(0,1fr))] gap-4 3xl:gap-6 mb-4 3xl:mb-6 items-stretch">
                                            <div className={`border 3xl:border-2 rounded-xl 3xl:rounded-2xl flex items-center justify-center p-1 3xl:p-2 ${theme.innerBg} ${theme.innerBorder}`}>
                                                <span className={`text-xl 2xl:text-2xl 3xl:text-4xl font-black font-mono ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>{shelf}</span>
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
                                                        className={`p-3 3xl:p-5 rounded-2xl 3xl:rounded-3xl border 3xl:border-2 transition-all duration-300 relative flex flex-col justify-between min-h-[220px] 3xl:min-h-[280px] ${
                                                            isViolated
                                                                ? 'bg-rose-950 border-rose-500 ring-4 ring-rose-500/50 animate-pulse z-10 text-white'
                                                                : isLaneHighlighted
                                                                    ? `${theme.cardBg} border-bw-cyan ring-4 ring-bw-cyan/60 z-10 scale-[1.01]`
                                                                    : selectedPartNumber
                                                                        ? `${theme.innerBg} border-slate-300 opacity-30`
                                                                        : currentBoxes > 0
                                                                            ? `${theme.innerBg} ${theme.cardBorder}`
                                                                            : `${theme.innerBg} border-dashed ${theme.cardBorder}`
                                                        }`}
                                                    >
                                                        <div className={`flex justify-between items-center pb-2 3xl:pb-3 border-b 3xl:border-b-2 ${theme.cardBorder} gap-2 3xl:gap-3`}>
                                                            <div>
                                                                <span className={`text-xs 2xl:text-sm 3xl:text-lg font-black font-mono block ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>S{shelf}-C{col}</span>
                                                                <div className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono font-bold ${theme.textSecondary}`}>{lane?.code}</div>
                                                            </div>
                                                            <div className="flex-1 text-center px-1">
                                                                {lanePartNumber ? (
                                                                    <span className={`inline-block font-mono font-black ${getPNFontSize(lanePartNumber, isLaneHighlighted)} px-2.5 3xl:px-3 py-0.5 3xl:py-1 rounded-lg 3xl:rounded-xl transition-all duration-300 truncate max-w-full ${
                                                                        isLaneHighlighted
                                                                            ? 'bg-bw-cyan text-slate-950 shadow-[0_0_20px_#2EFAD9] scale-105'
                                                                            : isLight
                                                                                ? 'bg-teal-100 border 3xl:border-2 border-teal-300 text-teal-900'
                                                                                : 'bg-bw-cyan/10 border 3xl:border-2 border-bw-cyan/40 text-white'
                                                                    }`}>
                                                                        {lanePartNumber}
                                                                    </span>
                                                                ) : (
                                                                    <span className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono font-bold uppercase ${theme.textSecondary}`}>[ WOLNY TOR ]</span>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className={`text-xl 2xl:text-2xl 3xl:text-4xl font-black font-mono leading-none ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>
                                                                    {totalPiecesInLane} <span className={`text-xs 2xl:text-sm 3xl:text-lg ${theme.textSecondary}`}>szt.</span>
                                                                </div>
                                                                <span className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono font-bold block mt-0.5 3xl:mt-1 ${theme.textSecondary}`}>({currentBoxes}/{capacity} box)</span>
                                                            </div>
                                                        </div>

                                                        <div className="my-2 3xl:my-4 grid grid-cols-5 gap-2 3xl:gap-3 items-stretch min-h-[90px] 3xl:min-h-[120px]">
                                                            {Array.from({ length: capacity }, (_, slotIndex) => {
                                                                const box = lane?.materials?.[slotIndex];
                                                                const isFifoHead = slotIndex === 0 && Boolean(box);

                                                                return (
                                                                    <div
                                                                        key={box?.id || slotIndex}
                                                                        className={`p-2 3xl:p-3 rounded-xl 3xl:rounded-2xl border 3xl:border-2 flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                                                                            box
                                                                                ? isLaneHighlighted && isFifoHead
                                                                                    ? theme.targetSlotBg
                                                                                    : isFifoHead
                                                                                        ? isLight
                                                                                            ? 'bg-teal-700 text-white border-2 border-teal-900 ring-2 ring-teal-400'
                                                                                            : 'bg-slate-900 border-2 border-bw-cyan ring-2 ring-bw-cyan/60 text-white'
                                                                                        : isLight
                                                                                            ? 'bg-slate-200 border border-slate-400 text-slate-900'
                                                                                            : 'bg-slate-900/90 border border-slate-600 text-white'
                                                                                : isLight
                                                                                    ? 'border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[10px] 3xl:text-xs font-black uppercase'
                                                                                    : 'border border-dashed border-slate-800/80 rounded-xl 3xl:rounded-2xl flex flex-col items-center justify-center text-slate-600 text-[10px] 3xl:text-xs font-black uppercase'
                                                                        }`}
                                                                    >
                                                                        {box ? (
                                                                            <>
                                                                                <div className="flex items-center justify-between border-b border-slate-500/30 pb-1">
                                                                                    <span className={`text-[9px] 2xl:text-xs 3xl:text-sm font-black uppercase ${
                                                                                        isLaneHighlighted && isFifoHead ? 'text-slate-950' : isFifoHead ? (isLight ? 'text-amber-300' : 'text-bw-cyan') : theme.textSecondary
                                                                                    }`}>
                                                                                        {isLaneHighlighted && isFifoHead
                                                                                            ? (actionType === 'OUT' ? 'POBIERZ' : 'WŁÓŻ')
                                                                                            : isFifoHead
                                                                                                ? '★ FIFO'
                                                                                                : `#${slotIndex + 1}`}
                                                                                    </span>
                                                                                    <span className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono font-black px-1.5 3xl:px-2 py-0.5 rounded-md 3xl:rounded-lg ${
                                                                                        isLaneHighlighted && isFifoHead ? 'bg-slate-950 text-bw-cyan' : isLight ? 'bg-white text-teal-800 border' : 'text-bw-cyan bg-bw-cyan/10 border border-bw-cyan/30'
                                                                                    }`}>
                                                                                        {getItemQuantity(box)} szt
                                                                                    </span>
                                                                                </div>
                                                                                <div className="my-auto py-1 3xl:py-2 text-center">
                                                                                    <div className={`text-xs 2xl:text-sm 3xl:text-base font-mono font-black tracking-wide truncate ${
                                                                                        isLaneHighlighted && isFifoHead ? 'text-slate-950' : theme.textPrimary
                                                                                    }`}>
                                                                                        {box.barcode}
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <div className="m-auto text-center">
                                                                                <span className="block text-[9px] 3xl:text-xs text-slate-600 font-bold">SLOT</span>
                                                                                <span className="block text-xs 3xl:text-sm text-slate-500 font-black">{slotIndex + 1}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className={`w-full h-2 3xl:h-3 rounded-full overflow-hidden border ${theme.innerBg} ${theme.cardBorder}`}>
                                                            <div className={`h-full transition-all duration-500 ease-out ${isLight ? 'bg-teal-600' : 'bg-bw-cyan'}`} style={{ width: `${(currentBoxes / capacity) * 100}%` }} />
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
                        /* WIDOK OGÓLNY REGAŁÓW (KAFELKI) - RESPONSYWNA SIATKA (Mniejsze na 1080p, Wielkie na 4K) */
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] 3xl:grid-cols-[repeat(auto-fit,minmax(450px,1fr))] gap-5 3xl:gap-8 w-full animate-zoom-in">
                            {filteredRacks.map((rack) => (
                                <div
                                    key={rack.id}
                                    onClick={() => setSelectedRackCode(rack.code)}
                                    className={`p-4 3xl:p-6 rounded-2xl 3xl:rounded-3xl border-2 transition-all duration-300 cursor-pointer shadow-xl 3xl:shadow-2xl ${theme.cardBg} ${theme.cardBorder} ${
                                        isLight ? 'hover:border-teal-500' : 'hover:border-bw-cyan'
                                    }`}
                                >
                                    <div className={`flex items-center justify-between mb-3 3xl:mb-4 pb-2 3xl:pb-3 border-b 3xl:border-b-2 ${theme.cardBorder}`}>
                                        <span className={`text-xs 2xl:text-sm 3xl:text-xl font-mono font-black ${isLight ? 'text-teal-700' : 'text-bw-cyan'}`}>{rack.code}</span>
                                        <h3 className={`text-sm 2xl:text-base 3xl:text-2xl font-black ${theme.textPrimary}`}>{rack.name}</h3>
                                    </div>
                                    <div className={`grid gap-2 3xl:gap-3 mb-4 3xl:mb-6 p-2.5 3xl:p-4 rounded-xl 3xl:rounded-2xl border ${theme.innerBg} ${theme.innerBorder}`} style={{ gridTemplateRows: `repeat(${rack.totalShelves}, minmax(0, 1fr))` }}>
                                        {Array.from({ length: rack.totalShelves }, (_, sIdx) => {
                                            const shelfNum = rack.totalShelves - sIdx;
                                            return (
                                                <div key={shelfNum} className="grid gap-2 3xl:gap-3 w-full" style={{ gridTemplateColumns: `repeat(${rack.totalColumns}, minmax(0, 1fr))` }}>
                                                    {Array.from({ length: rack.totalColumns }, (_, cIdx) => {
                                                        const colNum = cIdx + 1;
                                                        const lane = rack.lanes.find((l) => l.shelf === shelfNum && l.column === colNum);
                                                        const hasStock = Boolean(lane && lane.materials?.length > 0);
                                                        const lanePN = lane?.materials?.[0]?.partNumber;
                                                        const isHighlightedByChart = Boolean(highlightedPartNumber && lanePN?.toUpperCase().trim() === highlightedPartNumber.toUpperCase().trim());

                                                        return (
                                                            <div
                                                                key={colNum}
                                                                className={`h-12 2xl:h-16 3xl:h-28 rounded-lg 3xl:rounded-2xl flex items-center justify-center font-mono font-black transition-all duration-500 ease-out truncate px-1 3xl:px-1.5 ${
                                                                    isHighlightedByChart
                                                                        ? `bg-bw-cyan text-slate-950 ${getPNFontSize(lanePN, true)} font-black shadow-[0_0_35px_#2EFAD9] border-2 3xl:border-4 border-white scale-105 z-10 animate-pulse`
                                                                        : highlightedPartNumber
                                                                            ? 'opacity-20 transform scale-95'
                                                                            : hasStock
                                                                                ? `${theme.filledSlotBg} ${getPNFontSize(lanePN, false)}`
                                                                                : `${theme.emptySlotBg} text-xs 2xl:text-sm 3xl:text-lg`
                                                                }`}
                                                            >
                                                                {hasStock ? (lanePN || 'OK') : '•'}
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
                        <div className={`p-5 3xl:p-8 rounded-2xl 3xl:rounded-3xl border-2 shadow-2xl w-full animate-zoom-in mt-6 3xl:mt-10 transition-all duration-300 ${theme.cardBg} ${theme.cardBorder}`}>
                            <div className={`flex items-center justify-between mb-6 3xl:mb-8 pb-3 3xl:pb-4 border-b 3xl:border-b-2 flex-wrap gap-4 ${theme.cardBorder}`}>
                                <div className="flex items-center gap-3 3xl:gap-4">
                                    <BarChart3 className="w-6 h-6 3xl:w-10 3xl:h-10 text-bw-cyan" />
                                    <div>
                                        <h3 className={`text-lg 2xl:text-xl 3xl:text-3xl font-black tracking-wide ${theme.textPrimary}`}>
                                            STATYSTYKA STREFY • STANY MATERIAŁOWE PER PART NUMBER
                                        </h3>
                                        <span className={`text-xs 2xl:text-sm 3xl:text-base font-mono block mt-0.5 3xl:mt-1 ${theme.textSecondary}`}>
                                            Kliknij na słupek, aby podświetlić lokalizację danego Part Numberu w całej strefie
                                        </span>
                                    </div>
                                </div>

                                <span className={`text-xs 2xl:text-sm 3xl:text-xl font-mono font-black border-2 px-4 3xl:px-6 py-2 3xl:py-3 rounded-xl 3xl:rounded-2xl shadow-md ${
                                    isLight ? 'bg-teal-50 text-teal-800 border-teal-300' : 'bg-bw-cyan/10 text-bw-cyan border-bw-cyan/40'
                                }`}>
                                    TOTAL: {totalPiecesInGroup} szt. ({totalBoxesInGroup} box)
                                </span>
                            </div>

                            <div className="overflow-x-auto pb-4 pt-2">
                                <div className={`flex items-end gap-5 3xl:gap-8 min-w-max h-[300px] 3xl:h-[450px] pt-12 3xl:pt-16 pb-3 3xl:pb-4 px-4 3xl:px-6 border-b-2 ${theme.cardBorder}`}>
                                    {partNumberStats.map((item) => {
                                        const heightPercentage = Math.round((item.totalQty / maxPNQuantity) * 100);
                                        const isSelected = highlightedPartNumber === item.partNumber;

                                        return (
                                            <div
                                                key={item.partNumber}
                                                onClick={() => setHighlightedPartNumber(isSelected ? null : item.partNumber)}
                                                className={`flex flex-col items-center h-full justify-end min-w-[120px] 2xl:min-w-[140px] 3xl:min-w-[200px] group cursor-pointer transition-all duration-300 ease-out ${
                                                    isSelected ? '-translate-y-2 3xl:-translate-y-3 scale-105 z-10' : 'hover:-translate-y-1'
                                                }`}
                                            >
                                                <div className="mb-2 3xl:mb-4 text-center transition-all duration-300">
                                                    <span className={`text-xl 2xl:text-2xl 3xl:text-4xl font-mono font-black block leading-none transition-colors duration-300 ${
                                                        isSelected
                                                            ? (isLight ? 'text-teal-800' : 'text-white drop-shadow-[0_0_15px_#2EFAD9]')
                                                            : (isLight ? 'text-teal-600 group-hover:text-teal-900' : 'text-bw-cyan group-hover:text-white')
                                                    }`}>
                                                        {item.totalQty}
                                                    </span>
                                                    <span className={`text-[10px] 2xl:text-xs 3xl:text-sm font-mono font-bold uppercase block mt-1 3xl:mt-2 tracking-wider ${theme.textSecondary}`}>
                                                        {item.boxCount} box
                                                    </span>
                                                </div>

                                                <div className={`w-full rounded-t-xl 3xl:rounded-t-2xl overflow-hidden border-x-2 border-t-2 transition-all duration-300 flex flex-col justify-end h-full p-1.5 3xl:p-2 shadow-inner ${theme.innerBg} ${
                                                    isSelected ? 'border-bw-cyan ring-4 ring-bw-cyan/50 shadow-[0_0_25px_rgba(46,250,217,0.3)]' : theme.cardBorder
                                                }`}>
                                                    <div
                                                        className={`w-full rounded-t-lg 3xl:rounded-t-xl transition-all duration-500 ease-out ${
                                                            isSelected
                                                                ? 'bg-bw-cyan shadow-[0_0_25px_#2EFAD9]'
                                                                : isLight
                                                                    ? 'bg-gradient-to-t from-teal-500 to-teal-400 group-hover:brightness-110'
                                                                    : 'bg-gradient-to-t from-bw-cyan/70 to-bw-cyan shadow-[0_0_20px_rgba(46,250,217,0.4)] group-hover:brightness-125'
                                                        }`}
                                                        style={{ height: `${Math.max(heightPercentage, 10)}%` }}
                                                    />
                                                </div>

                                                <div className={`mt-3 3xl:mt-5 text-center w-full py-2 3xl:py-3 px-2 rounded-xl 3xl:rounded-2xl border-2 transition-all duration-300 shadow-md ${
                                                    isSelected
                                                        ? 'bg-bw-cyan text-slate-950 border-white font-black shadow-[0_0_20px_#2EFAD9]'
                                                        : `${theme.innerBg} ${theme.textPrimary} ${theme.cardBorder}`
                                                }`}>
                                                    <span className={`font-mono font-black block truncate ${getPNFontSize(item.partNumber, isSelected)}`}>
                                                        {item.partNumber}
                                                    </span>
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