import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config/api';

// 🎨 Import wektorowych ikon z lucide-react
import {
    LogOut,
    LogIn,
    RotateCcw,
    MapPin,
    Smartphone,
    Building2,
    Search,
    Map,
    Target,
    AlertTriangle,
    Check,
    Lock,
    ArrowLeft
} from 'lucide-react';

// 🔌 Inicjalizacja połączenia WebSocket ze wsparciem auto-reconnect
const socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
});

interface Material {
    id: string;
    barcode: string;
    partNumber: string;
    entryTime: string;
    quantity?: number;
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

interface Rack {
    id: string;
    code: string;
    name: string;
    groupId?: string | null;
    totalShelves: number;
    totalColumns: number;
    lanes: Lane[];
}

export default function ScanOutApp() {
    const [racks, setRacks] = useState<Rack[]>([]);
    const [groups, setGroups] = useState<RackGroup[]>([]);

    // 📍 STAN I ZAPIS PRZYPISANEJ STREFY W MEMORY SKANERA (LOCALSTORAGE)
    const [assignedGroupId, setAssignedGroupId] = useState<string>(
        localStorage.getItem('SCANNER_GROUP_ID') || 'ALL'
    );

    const [selectedRackCode, setSelectedRackCode] = useState<string>('');
    const [selectedPartNumber, setSelectedPartNumber] = useState<string>('');

    const [laneCode, setLaneCode] = useState('');
    const [barcode, setBarcode] = useState('');

    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    const laneInputRef = useRef<HTMLInputElement>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        laneInputRef.current?.focus();
        void fetchGroups();
        void fetchRacks();

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
            const res = await fetch(`${API_BASE_URL}/fifo/groups`);
            if (res.ok) {
                const data: RackGroup[] = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error('Błąd pobierania stref:', err);
        }
    };

    const fetchRacks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/overview`);
            if (res.ok) {
                const data: Rack[] = await res.json();
                setRacks(data);

                const filtered = assignedGroupId === 'ALL' ? data : data.filter(r => r.groupId === assignedGroupId);
                if (filtered.length > 0 && !selectedRackCode) {
                    setSelectedRackCode(filtered[0].code);
                }
            }
        } catch (err) {
            console.error('Błąd pobierania regałów:', err);
        }
    };

    const handleGroupChange = (groupId: string) => {
        setAssignedGroupId(groupId);
        localStorage.setItem('SCANNER_GROUP_ID', groupId);

        const filtered = groupId === 'ALL' ? racks : racks.filter(r => r.groupId === groupId);
        if (filtered.length > 0) {
            setSelectedRackCode(filtered[0].code);
        }
        setSelectedPartNumber('');
        setLaneCode('');
        emitHighlight('', '', '');
    };

    const emitHighlight = (rackCode: string, partNumber: string, targetLaneCode: string) => {
        const payload = {
            type: 'OUT',
            groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
            rackCode: rackCode || '',
            partNumber: partNumber ? partNumber.toUpperCase().trim() : '',
            targetLaneCode: targetLaneCode ? targetLaneCode.toUpperCase().trim() : '',
        };

        if (socket.connected) {
            socket.emit('pick:highlight', payload);
            socket.emit('pick:light', payload);
        } else {
            socket.connect();
            socket.emit('pick:highlight', payload);
            socket.emit('pick:light', payload);
        }
    };

    const filteredRacks = assignedGroupId === 'ALL'
        ? racks
        : racks.filter((r) => r.groupId === assignedGroupId);

    const activeRack = filteredRacks.find((r) => r.code === selectedRackCode) || filteredRacks[0] || racks[0];

    const availablePartNumbersInZone = (() => {
        const allMaterialsInZone = filteredRacks.flatMap(rack =>
            rack.lanes.flatMap(lane => lane.materials || [])
        );

        const uniquePNs = Array.from(
            new Set(
                allMaterialsInZone.map(m => m.partNumber.toUpperCase().trim())
            )
        ).filter(Boolean);

        return uniquePNs.sort();
    })();

    const scannedLane = activeRack
        ? activeRack.lanes.find((l) => l.code.toUpperCase().trim() === laneCode.toUpperCase().trim())
        : null;

    const targetBoxFromLane = scannedLane && scannedLane.materials?.length > 0
        ? scannedLane.materials[0]
        : null;

    const handleLaneChange = (val: string) => {
        const formattedLane = val.toUpperCase().trim();
        setLaneCode(formattedLane);

        const matchedLane = activeRack?.lanes.find((l) => l.code.toUpperCase().trim() === formattedLane);
        if (matchedLane) {
            const headBox = matchedLane.materials?.[0];
            const activePN = headBox?.partNumber || selectedPartNumber || '';

            emitHighlight(selectedRackCode, activePN, matchedLane.code);

            if (headBox && !selectedPartNumber) {
                setSelectedPartNumber(headBox.partNumber.toUpperCase().trim());
            }
        } else if (!formattedLane) {
            emitHighlight('', '', '');
        }
    };

    const handleSelectPartNumber = (pn: string) => {
        const formattedPN = pn.toUpperCase().trim();
        setSelectedPartNumber(formattedPN);

        if (!formattedPN) {
            setLaneCode('');
            emitHighlight('', '', '');
            return;
        }

        const candidateLanes: { rackCode: string; laneCode: string; entryTime: number }[] = [];

        filteredRacks.forEach((rack) => {
            rack.lanes.forEach((lane) => {
                const headBox = lane.materials?.[0];
                if (headBox && headBox.partNumber.toUpperCase().trim() === formattedPN) {
                    candidateLanes.push({
                        rackCode: rack.code,
                        laneCode: lane.code,
                        entryTime: new Date(headBox.entryTime).getTime(),
                    });
                }
            });
        });

        candidateLanes.sort((a, b) => a.entryTime - b.entryTime);

        if (candidateLanes.length > 0) {
            const oldest = candidateLanes[0];
            if (oldest.rackCode !== selectedRackCode) {
                setSelectedRackCode(oldest.rackCode);
            }
            setLaneCode(oldest.laneCode);
            emitHighlight(oldest.rackCode, formattedPN, oldest.laneCode);
            barcodeInputRef.current?.focus();
        } else {
            setLaneCode('');
            emitHighlight('', formattedPN, '');
            setFeedback({
                type: 'error',
                message: `P/N ${formattedPN} jest w strefie, ale żaden tor nie ma go na pozycji FIFO. Wydanie zablokowane.`
            });
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!laneCode || !barcode) {
            setFeedback({
                type: 'error',
                message: 'Zeskanuj Kod Toru oraz Kod Pobieranego Boxa!',
            });
            return;
        }

        setLoading(true);
        setFeedback(null);

        try {
            const res = await fetch(`${API_BASE_URL}/fifo/scan-out`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    laneCode: laneCode.trim(),
                    barcode: barcode.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Błąd weryfikacji FIFO przy wyjeździe.');
            }

            setFeedback({
                type: 'success',
                message: `WYDANIE POPRAWNE (FIFO OK)! Tor: ${laneCode.toUpperCase()} | Pobrano: ${barcode}`,
            });

            emitHighlight('', '', '');

            setBarcode('');
            setSelectedPartNumber('');
            setLaneCode('');
            await fetchRacks();
            laneInputRef.current?.focus();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Wystąpił nieznany błąd';
            setFeedback({
                type: 'error',
                message: errorMsg,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setLaneCode('');
        setBarcode('');
        setSelectedPartNumber('');
        emitHighlight('', '', '');
        setFeedback(null);
        laneInputRef.current?.focus();
    };

    const handleInputFocus = (
        e: React.FocusEvent<HTMLInputElement>,
        clearFn?: () => void
    ) => {
        e.target.setAttribute('readonly', 'readonly');
        setTimeout(() => {
            e.target.removeAttribute('readonly');
        }, 100);

        if (clearFn) {
            clearFn();
        }
    };

    const shelvesCount = activeRack?.totalShelves || 4;
    const colsCount = activeRack?.totalColumns || 6;

    return (
        <div className="scanner-view min-h-dvh w-full bg-bw-navy text-bw-sand p-3 sm:p-4 font-sans select-none flex flex-col justify-between relative">
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-y-auto pr-0.5">
                {/* NAGŁÓWEK */}
                <header className="flex items-center justify-between border-b border-slate-800 pb-1 sm:pb-2 mb-1 sm:mb-2 shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-bw-cyan shrink-0" />
                        <div>
                            <h1 className="text-xs sm:text-base lg:text-lg font-black text-bw-cyan tracking-wider leading-tight">
                                SCAN OUT TERMINAL
                            </h1>
                            <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 font-bold block">
                                SLIDEX • MINI-MAP VISUALIZER
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                        <a
                            href="/scanner/scan-in"
                            className="bg-bw-cyan/10 hover:bg-bw-cyan/20 text-bw-cyan font-bold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-bw-cyan/40 transition-all flex items-center gap-1 active:scale-95"
                        >
                            <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>Scan In</span>
                        </a>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="bg-slate-900 hover:bg-slate-800 text-bw-sand font-bold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-800 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>Reset</span>
                        </button>
                    </div>
                </header>

                {/* Wybór Strefy */}
                <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1 sm:mb-2 flex items-center justify-between gap-2 shrink-0">
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

                    <span className="text-[8px] sm:text-[9px] bg-bw-cyan/10 text-bw-cyan border border-bw-cyan/30 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded font-mono font-bold shrink-0 self-end mb-0.5 flex items-center gap-1">
                        <Smartphone className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>SKANER</span>
                    </span>
                </div>

                {/* FEEDBACK BANER */}
                {feedback && (
                    <div
                        className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl mb-1 sm:mb-2 text-center font-bold text-[10px] sm:text-xs border shadow-lg animate-pulse whitespace-pre-line shrink-0 flex items-center justify-center gap-1.5 ${
                            feedback.type === 'success'
                                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                                : 'bg-rose-950/90 border-rose-500 text-rose-300'
                        }`}
                    >
                        {feedback.type === 'success' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                        <span>{feedback.message}</span>
                    </div>
                )}

                {/* REGAŁ I P/N SELEKTOR */}
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-1 sm:mb-2 shrink-0">
                    <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                            <span>Regał:</span>
                        </label>
                        <select
                            value={selectedRackCode}
                            onChange={(e) => {
                                setSelectedRackCode(e.target.value);
                                setSelectedPartNumber('');
                                setLaneCode('');
                                emitHighlight('', '', '');
                            }}
                            className="w-full bg-slate-950 text-bw-cyan font-black text-[11px] sm:text-xs rounded-md sm:rounded-lg p-1 sm:p-1.5 border border-slate-700 focus:outline-none cursor-pointer"
                        >
                            {filteredRacks.map((r) => (
                                <option key={r.id} value={r.code}>
                                    {r.code} - {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-bw-cyan/60 shadow-md">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan mb-0.5 flex items-center gap-1">
                            <Search className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-bw-cyan" />
                            <span>P/N w Strefie:</span>
                        </label>
                        <select
                            value={selectedPartNumber}
                            onChange={(e) => handleSelectPartNumber(e.target.value)}
                            className="w-full bg-slate-950 text-white font-black font-mono text-[11px] sm:text-xs rounded-md sm:rounded-lg p-1 sm:p-1.5 border border-slate-700 focus:outline-none focus:border-bw-cyan cursor-pointer"
                        >
                            <option value="">-- Wybierz --</option>
                            {availablePartNumbersInZone.map((pn) => (
                                <option key={pn} value={pn}>
                                    {pn}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* MAPA STREFY */}
                {filteredRacks.length > 0 && (
                    <div className="bg-slate-950/90 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800 mb-1 sm:mb-2 shrink-0">
                        <div className="flex items-center justify-between mb-1 text-[8px] sm:text-[9px] font-mono text-slate-400">
                            <span className="font-bold uppercase tracking-wider text-bw-cyan flex items-center gap-1">
                                <Map className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>MAPA STREFY ({filteredRacks.length} REGAŁY)</span>
                            </span>
                            <span className="text-[7px] sm:text-[8px] text-slate-500">ZMIENIAJ REGAŁ</span>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto p-0.5">
                            {filteredRacks.map((r) => {
                                const isSelected = r.code === activeRack?.code;
                                const hasPN = selectedPartNumber && r.lanes.some(l =>
                                    l.materials?.[0]?.partNumber.toUpperCase().trim() === selectedPartNumber
                                );

                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => {
                                            setSelectedRackCode(r.code);
                                            setLaneCode('');
                                            emitHighlight(r.code, selectedPartNumber, '');
                                        }}
                                        className={`flex-1 min-w-[65px] sm:min-w-[75px] py-1 sm:py-2 px-1.5 sm:px-2 rounded-md sm:rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-bw-cyan text-slate-950 border-bw-cyan font-black shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)]'
                                                : hasPN
                                                    ? 'bg-bw-cyan/20 text-bw-cyan border-bw-cyan/60 animate-pulse font-bold'
                                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 font-medium'
                                        }`}
                                    >
                                        {isSelected ? <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 mb-0.5 text-slate-950" /> : <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mb-0.5 text-slate-400" />}
                                        <span className="text-[9px] sm:text-[10px] font-mono tracking-wider truncate max-w-full">
                                            {r.code}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* MINI-SCHEMAT SIATKI AKTYWNEGO REGAŁU */}
                {activeRack && (
                    <div className="bg-slate-950/80 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1 sm:mb-2 shadow-inner shrink-0">
                        <div className="flex items-center justify-between mb-0.5 sm:mb-1 text-[8px] sm:text-[9px] font-mono text-slate-400">
                            <span className="font-bold">SIATKA TORÓW REGAŁU ({activeRack.code})</span>
                            {scannedLane ? (
                                <span className="text-bw-cyan font-black animate-pulse flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-bw-cyan" />
                                    <span>S{scannedLane.shelf}-C{scannedLane.column} ({scannedLane.code})</span>
                                </span>
                            ) : (
                                <span>Podświetlenie toru</span>
                            )}
                        </div>

                        <div className="grid gap-0.5 sm:gap-1" style={{ gridTemplateRows: `repeat(${shelvesCount}, minmax(0, 1fr))` }}>
                            {Array.from({ length: shelvesCount }, (_, sIdx) => {
                                const shelfNum = shelvesCount - sIdx;
                                return (
                                    <div key={shelfNum} className="grid gap-0.5 sm:gap-1" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}>
                                        {Array.from({ length: colsCount }, (_, cIdx) => {
                                            const colNum = cIdx + 1;
                                            const laneForCell = activeRack.lanes.find(
                                                (l) => l.shelf === shelfNum && l.column === colNum
                                            );
                                            const isTarget = scannedLane && scannedLane.id === laneForCell?.id;
                                            const hasStock = laneForCell && laneForCell.materials?.length > 0;

                                            return (
                                                <div
                                                    key={colNum}
                                                    className={`h-4 sm:h-5.5 rounded flex items-center justify-center font-mono text-[7px] sm:text-[8px] font-bold border transition-all ${
                                                        isTarget
                                                            ? 'bg-bw-cyan text-slate-950 border-bw-cyan font-black shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5)] z-10'
                                                            : hasStock
                                                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                                                : 'bg-slate-900/40 text-slate-700 border-slate-900/60'
                                                    }`}
                                                >
                                                    {isTarget ? <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-950" /> : `S${shelfNum}C${colNum}`}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* PODŚWIETLONY BOX DO POBRANIA */}
                {targetBoxFromLane ? (
                    <div className="bg-bw-cyan text-slate-950 p-1.5 sm:p-2 rounded-lg sm:rounded-xl mb-1 sm:mb-2 border-2 border-white shadow-[0_0_12px_#2EFAD9] flex items-center justify-between animate-pulse shrink-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                            <Target className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <div className="truncate">
                                <span className="text-[7px] sm:text-[8px] uppercase font-extrabold text-slate-900 block">
                                    BOX W LOKALIZACJI FIFO:
                                </span>
                                <div className="text-[11px] sm:text-xs font-mono font-black truncate">
                                    KOD: <span className="underline">{targetBoxFromLane.barcode}</span> | P/N: {targetBoxFromLane.partNumber}
                                </div>
                            </div>
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-mono font-black bg-slate-950 text-bw-cyan px-1 sm:px-1.5 py-0.5 rounded ml-1 sm:ml-2 shrink-0">
                            {targetBoxFromLane.quantity || 1} szt
                        </span>
                    </div>
                ) : laneCode && scannedLane && scannedLane.materials?.length === 0 ? (
                    <div className="bg-rose-950/90 text-rose-300 p-1 sm:p-1.5 rounded-lg sm:rounded-xl mb-1 sm:mb-2 text-[10px] sm:text-xs font-bold text-center border border-rose-800 shrink-0 flex items-center justify-center gap-1 sm:gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                        <span>Tor {laneCode} jest pusty! Brak materiału.</span>
                    </div>
                ) : null}

                {/* FORMULARZ SKANOWANIA */}
                <form onSubmit={handleSubmit} className="space-y-1.5 sm:space-y-2 shrink-0">
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        {/* 1. TOR */}
                        <div className="bg-slate-900/90 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800 focus-within:border-bw-cyan transition-all">
                            <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan tracking-wider mb-0.5 flex items-center justify-between">
                                <span>1. Kod Toru</span>
                                <span className="text-[7px] sm:text-[8px] text-slate-500 font-normal flex items-center gap-0.5">
                                    <Lock className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> SKANUJ
                                </span>
                            </label>
                            <input
                                ref={laneInputRef}
                                type="text"
                                required
                                inputMode="none"
                                onFocus={(e) => handleInputFocus(e, () => setLaneCode(''))}
                                placeholder="Zeskanuj tor..."
                                value={laneCode}
                                onChange={(e) => handleLaneChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        barcodeInputRef.current?.focus();
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-black text-white focus:outline-none uppercase cursor-pointer"
                            />
                        </div>

                        {/* 2. BOX */}
                        <div className="bg-slate-900/90 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-800 focus-within:border-bw-cyan transition-all">
                            <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan tracking-wider mb-0.5 flex items-center justify-between">
                                <span>2. Kod Boxa</span>
                                <span className="text-[7px] sm:text-[8px] text-slate-500 font-normal flex items-center gap-0.5">
                                    <Lock className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> SKANUJ
                                </span>
                            </label>
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                required
                                inputMode="none"
                                onFocus={(e) => handleInputFocus(e, () => setBarcode(''))}
                                placeholder="Zeskanuj box..."
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleSubmit();
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-black text-white focus:outline-none uppercase cursor-pointer"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-bw-cyan text-slate-950 font-black text-[11px] sm:text-xs py-2 sm:py-2.5 rounded-lg sm:rounded-xl shadow-lg hover:bg-bw-cyan/90 active:scale-98 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <span>WERYFIKACJA FIFO...</span>
                        ) : (
                            <>
                                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
                                <span>POBIERZ MATERIAŁ (SCAN OUT)</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            <footer className="mt-0.5 sm:mt-1 pt-0.5 sm:pt-1 border-t border-slate-800/80 flex items-center justify-between text-[8px] sm:text-[9px] font-mono text-slate-500 shrink-0">
                <a href="/" className="font-bold text-slate-400 hover:text-bw-cyan transition-all flex items-center gap-1">
                    <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>Powrót do TV</span>
                </a>
                <span>BW SLIDEX v2.0</span>
            </footer>
        </div>
    );
}
