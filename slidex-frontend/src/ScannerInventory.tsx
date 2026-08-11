import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config/api';

// 🎨 Import wektorowych ikon z lucide-react
import {
    Search,
    RefreshCw,
    ArrowLeft,
    MapPin,
    Tv,
    X,
    Target,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

const socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
});

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

interface Rack {
    id: string;
    code: string;
    name: string;
    groupId?: string | null;
    lanes: Lane[];
}

export interface RackGroup {
    id: string;
    code: string;
    name: string;
}

const getItemQuantity = (material?: Material | null): number => {
    if (!material) return 0;
    const qty = Number(material.quantity);
    return isNaN(qty) || qty <= 0 ? 1 : qty;
};

export default function ScanInventory() {
    const [racks, setRacks] = useState<Rack[]>([]);
    const [groups, setGroups] = useState<RackGroup[]>([]);
    const [assignedGroupId, setAssignedGroupId] = useState<string>(
        localStorage.getItem('SCANNER_GROUP_ID') || 'ALL'
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPN, setSelectedPN] = useState<string | null>(null);
    const [activeHighlightPN, setActiveHighlightPN] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        void fetchGroups();
        void fetchRacks();
        searchInputRef.current?.focus();
    }, []);

    const fetchGroups = async (): Promise<void> => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/groups`);
            if (res.ok) {
                const data: RackGroup[] = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error('Błąd pobierania stref:', err);
        }
    };

    const fetchRacks = async (): Promise<void> => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/overview`);
            if (res.ok) {
                const data: Rack[] = await res.json();
                setRacks(data);
            }
        } catch (err) {
            console.error('Błąd pobierania regałów:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGroupChange = (groupId: string) => {
        setAssignedGroupId(groupId);
        localStorage.setItem('SCANNER_GROUP_ID', groupId);
    };

    // 🎯 WYSYŁANIE HIGHLIGHTU NA OBA DASHBOARDY TV (IN oraz OUT)
    const handleHighlightOnTV = (pn: string, targetRackCode?: string, targetLaneCode?: string) => {
        const isClearing = activeHighlightPN === pn && !targetLaneCode;
        const newPN = isClearing ? '' : pn;

        setActiveHighlightPN(isClearing ? null : pn);

        const basePayload = {
            groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
            rackCode: newPN ? targetRackCode || '' : '',
            partNumber: newPN,
            targetLaneCode: newPN ? targetLaneCode || '' : '',
        };

        if (!socket.connected) {
            socket.connect();
        }

        // 1. Emitujemy dla DashboardIn
        socket.emit('pick:highlight', { ...basePayload, type: 'IN' });

        // 2. Emitujemy dla DashboardOut
        socket.emit('pick:highlight', { ...basePayload, type: 'OUT' });
    };

    // ✕ CZYSZCZENIE PODŚWIETLENIA NA OBU DASHBOARDACH
    const handleClearHighlight = () => {
        setActiveHighlightPN(null);
        const basePayload = {
            groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
            rackCode: '',
            partNumber: '',
            targetLaneCode: '',
        };

        if (!socket.connected) {
            socket.connect();
        }

        socket.emit('pick:highlight', { ...basePayload, type: 'IN' });
        socket.emit('pick:highlight', { ...basePayload, type: 'OUT' });
    };

    const filteredRacks = assignedGroupId === 'ALL'
        ? racks
        : racks.filter((r) => r.groupId === assignedGroupId);

    const partNumberDetails = (() => {
        const map = new Map<
            string,
            {
                totalQty: number;
                boxCount: number;
                locations: Array<{
                    rackCode: string;
                    rackName: string;
                    laneCode: string;
                    shelf: number;
                    column: number;
                    count: number;
                    qty: number;
                    oldestEntry: string;
                }>;
            }
        >();

        filteredRacks.forEach((rack) => {
            rack.lanes.forEach((lane) => {
                if (!lane.materials || lane.materials.length === 0) return;

                lane.materials.forEach((m) => {
                    const pn = m.partNumber.toUpperCase().trim();
                    if (!pn) return;

                    const qty = getItemQuantity(m);
                    const current = map.get(pn) || { totalQty: 0, boxCount: 0, locations: [] };

                    let loc = current.locations.find((l) => l.laneCode === lane.code);
                    if (!loc) {
                        loc = {
                            rackCode: rack.code,
                            rackName: rack.name,
                            laneCode: lane.code,
                            shelf: lane.shelf,
                            column: lane.column,
                            count: 0,
                            qty: 0,
                            oldestEntry: m.entryTime,
                        };
                        current.locations.push(loc);
                    }

                    loc.count += 1;
                    loc.qty += qty;

                    if (new Date(m.entryTime).getTime() < new Date(loc.oldestEntry).getTime()) {
                        loc.oldestEntry = m.entryTime;
                    }

                    map.set(pn, {
                        totalQty: current.totalQty + qty,
                        boxCount: current.boxCount + 1,
                        locations: current.locations,
                    });
                });
            });
        });

        return Array.from(map.entries())
            .map(([pn, data]) => ({
                partNumber: pn,
                totalQty: data.totalQty,
                boxCount: data.boxCount,
                locations: data.locations.sort(
                    (a, b) => new Date(a.oldestEntry).getTime() - new Date(b.oldestEntry).getTime()
                ),
            }))
            .filter((item) =>
                searchQuery ? item.partNumber.includes(searchQuery.toUpperCase().trim()) : true
            )
            .sort((a, b) => b.totalQty - a.totalQty);
    })();

    const totalPiecesInZone = filteredRacks.reduce(
        (acc, r) =>
            acc +
            r.lanes.reduce(
                (lAcc, l) => lAcc + (l.materials || []).reduce((mAcc, m) => mAcc + getItemQuantity(m), 0),
                0
            ),
        0
    );

    return (
        <div className="h-screen w-full bg-bw-navy text-bw-sand p-1.5 sm:p-3 font-sans select-none flex flex-col justify-between overflow-hidden">
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-hidden">
                {/* NAGŁÓWEK */}
                <header className="flex items-center justify-between border-b border-slate-800 pb-1 sm:pb-2 mb-1.5 sm:mb-2 shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <Search className="w-4 h-4 sm:w-5 sm:h-5 text-bw-cyan shrink-0" />
                        <div>
                            <h1 className="text-xs sm:text-base font-black text-bw-cyan tracking-wider leading-tight">
                                INVENTORY & LOCATOR
                            </h1>
                            <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 font-bold block">
                                STANY MATERIAŁOWE • LIVE TV HIGHLIGHT
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                            onClick={() => void fetchRacks()}
                            className="bg-slate-900 hover:bg-slate-800 text-bw-sand font-bold text-[10px] sm:text-xs p-1 sm:p-1.5 rounded-md sm:rounded-lg border border-slate-800 active:scale-95 flex items-center justify-center cursor-pointer"
                        >
                            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                        <a
                            href="/scanner"
                            className="bg-bw-cyan/10 hover:bg-bw-cyan/20 text-bw-cyan font-bold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border border-bw-cyan/40 active:scale-95 flex items-center gap-1"
                        >
                            <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>Menu</span>
                        </a>
                    </div>
                </header>

                {/* PRZYPISANA STREFA & PODSUMOWANIE */}
                <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1.5 sm:mb-2 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0">
                    <div className="flex-1">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                            <span>Strefa:</span>
                        </label>
                        <select
                            value={assignedGroupId}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            className="w-full bg-slate-950 text-bw-cyan font-black text-[11px] sm:text-xs rounded-md sm:rounded-lg p-1 sm:p-1.5 border border-slate-700 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">Wszystkie Strefy (Cała Hala)</option>
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.code} ({g.name})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-slate-950 px-2 sm:px-3 py-1 rounded-md sm:rounded-lg border border-slate-800 text-right shrink-0">
                        <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase block">Łącznie</span>
                        <span className="text-[11px] sm:text-xs font-mono font-black text-bw-cyan">{totalPiecesInZone} szt.</span>
                    </div>
                </div>

                {/* BANER INFORMUJĄCY O AKTYWNYM PODŚWIETLENIU NA OBU TV */}
                {activeHighlightPN && (
                    <div className="bg-bw-cyan text-slate-950 p-1.5 sm:p-2 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 border-2 border-white shadow-[0_0_12px_#2EFAD9] flex items-center justify-between animate-pulse shrink-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                            <Tv className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-950" />
                            <div className="truncate">
                                <span className="text-[7px] sm:text-[8px] uppercase font-extrabold text-slate-900 block">
                                    PODŚWIETLANIE NA OBU DASHBOARDARACH:
                                </span>
                                <span className="text-[11px] sm:text-xs font-mono font-black truncate underline">
                                    {activeHighlightPN}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleClearHighlight}
                            className="bg-slate-950 text-bw-cyan font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border border-bw-cyan/40 hover:bg-slate-900 active:scale-95 shrink-0 ml-1.5 flex items-center gap-1 cursor-pointer"
                        >
                            <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>WYCZYŚĆ TV</span>
                        </button>
                    </div>
                )}

                {/* WYSZUKIWARKA P/N */}
                <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1.5 sm:mb-2 shrink-0">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="ZESKANUJ LUB WPISZ P/N..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-mono font-black text-bw-cyan focus:outline-none focus:border-bw-cyan uppercase"
                    />
                </div>

                {/* LISTA PART NUMBERÓW Z LOKALIZATORAMI */}
                <div className="flex-1 overflow-y-auto space-y-1.5 sm:space-y-2 pr-0.5">
                    {loading ? (
                        <div className="text-center py-6 text-[11px] sm:text-xs font-mono text-slate-500 animate-pulse">
                            Ładowanie danych...
                        </div>
                    ) : partNumberDetails.length === 0 ? (
                        <div className="text-center py-6 text-[11px] sm:text-xs font-mono text-slate-500">
                            Brak materiałów w wybranej strefie
                        </div>
                    ) : (
                        partNumberDetails.map((item) => {
                            const isExpanded = selectedPN === item.partNumber;
                            const isHighlighted = activeHighlightPN === item.partNumber;
                            const oldestLocation = item.locations[0];

                            return (
                                <div
                                    key={item.partNumber}
                                    className={`bg-slate-900/90 border rounded-lg sm:rounded-xl overflow-hidden transition-all ${
                                        isHighlighted
                                            ? 'border-bw-cyan ring-2 ring-bw-cyan/80 bg-slate-850'
                                            : isExpanded
                                                ? 'border-bw-cyan ring-1 ring-bw-cyan/40'
                                                : 'border-slate-800'
                                    }`}
                                >
                                    {/* PASKOWY NAGŁÓWEK REKORDU */}
                                    <div className="p-2 sm:p-3 flex items-center justify-between gap-1.5 sm:gap-2">
                                        <div
                                            onClick={() => setSelectedPN(isExpanded ? null : item.partNumber)}
                                            className="flex-1 cursor-pointer truncate"
                                        >
                                            <span className="text-[11px] sm:text-xs font-mono font-black text-white block truncate">
                                                {item.partNumber}
                                            </span>
                                            <span className="text-[8px] sm:text-[10px] font-mono text-slate-400 font-bold block mt-0.5">
                                                Lokalizacji: {item.locations.length} torów
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                            <div
                                                onClick={() => setSelectedPN(isExpanded ? null : item.partNumber)}
                                                className="text-right cursor-pointer"
                                            >
                                                <span className="text-xs sm:text-sm font-mono font-black text-bw-cyan leading-none block">
                                                    {item.totalQty} <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold">szt.</span>
                                                </span>
                                                <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 font-bold block">
                                                    {item.boxCount} box
                                                </span>
                                            </div>

                                            {/* PRZYCISK HIGHLIGHTU NA OBA TV */}
                                            <button
                                                onClick={() =>
                                                    handleHighlightOnTV(
                                                        item.partNumber,
                                                        oldestLocation?.rackCode,
                                                        oldestLocation?.laneCode
                                                    )
                                                }
                                                className={`px-2 py-1 rounded-md sm:rounded-lg border font-black text-[9px] sm:text-[10px] font-mono transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                                                    isHighlighted
                                                        ? 'bg-bw-cyan text-slate-950 border-white shadow-[0_0_10px_#2EFAD9]'
                                                        : 'bg-slate-950 text-bw-cyan border-slate-700 hover:border-bw-cyan'
                                                }`}
                                            >
                                                <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                <span>{isHighlighted ? 'ACTIVE' : 'OBA TV'}</span>
                                            </button>

                                            <span
                                                onClick={() => setSelectedPN(isExpanded ? null : item.partNumber)}
                                                className="text-slate-500 text-xs font-bold cursor-pointer ml-0.5"
                                            >
                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />}
                                            </span>
                                        </div>
                                    </div>

                                    {/* DETAILS: LISTA DOKŁADNYCH TORÓW */}
                                    {isExpanded && (
                                        <div className="bg-slate-950 p-1.5 sm:p-2 border-t border-slate-800/80 space-y-1 sm:space-y-1.5 animate-in slide-in-from-top-2">
                                            <span className="text-[7px] sm:text-[8px] font-mono font-black text-bw-cyan uppercase block px-0.5 flex items-center gap-1">
                                                <Target className="w-2.5 h-2.5" />
                                                <span>REKOMENDACJA FIFO (NAJSTARSZE POZYCJE NA GÓRZE):</span>
                                            </span>

                                            {item.locations.map((loc, idx) => (
                                                <div
                                                    key={loc.laneCode}
                                                    className="bg-slate-900 p-1.5 sm:p-2 rounded-md sm:rounded-lg border border-slate-800 flex items-center justify-between gap-1.5"
                                                >
                                                    <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                                                        <span className="text-[10px] sm:text-xs font-black font-mono bg-bw-cyan/20 text-bw-cyan border border-bw-cyan/40 px-1 py-0.2 rounded shrink-0">
                                                            #{idx + 1}
                                                        </span>
                                                        <div className="truncate">
                                                            <div className="text-[11px] sm:text-xs font-mono font-black text-white truncate">
                                                                {loc.laneCode}
                                                            </div>
                                                            <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 block truncate">
                                                                {loc.rackCode} • S{loc.shelf}-C{loc.column}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                        <div className="text-right">
                                                            <span className="text-[11px] sm:text-xs font-mono font-black text-white block">
                                                                {loc.qty} szt. ({loc.count} box)
                                                            </span>
                                                            <span className="text-[7px] sm:text-[8px] font-mono text-slate-500 block">
                                                                {new Date(loc.oldestEntry).toLocaleTimeString([], {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}
                                                            </span>
                                                        </div>

                                                        <button
                                                            onClick={() =>
                                                                handleHighlightOnTV(item.partNumber, loc.rackCode, loc.laneCode)
                                                            }
                                                            className="bg-slate-950 hover:bg-slate-800 border border-bw-cyan/40 text-bw-cyan text-[8px] sm:text-[9px] font-mono font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded active:scale-95 flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                            <span>CEL</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}