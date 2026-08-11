import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config/api';

// 🎨 Import wektorowych ikon z lucide-react
import {
    LogIn,
    LogOut,
    RotateCcw,
    MapPin,
    Building2,
    Target,
    AlertTriangle,
    Keyboard,
    Delete,
    Check,
    ArrowLeft,
    X,
    QrCode,
    Scan,
    Map
} from 'lucide-react';

const socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
});

interface Material {
    id: string;
    partNumber: string;
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
    totalShelves: number;
    totalColumns: number;
    laneCapacity: number;
    lanes: Lane[];
}

export interface RackGroup {
    id: string;
    code: string;
    name: string;
}

export default function ScanInApp() {
    const [racks, setRacks] = useState<Rack[]>([]);
    const [groups, setGroups] = useState<RackGroup[]>([]);

    const [assignedGroupId, setAssignedGroupId] = useState<string>(
        localStorage.getItem('SCANNER_GROUP_ID') || 'ALL'
    );

    const [selectedRackCode, setSelectedRackCode] = useState<string>('');

    const [partNumber, setPartNumber] = useState('');
    const [laneCode, setLaneCode] = useState('');
    const [barcode, setBarcode] = useState('');
    const [quantity, setQuantity] = useState<string>('');

    // ⚡ NOWOŚĆ: Stan dla modalu skanowania strefy
    const [isZoneScanOpen, setIsZoneScanOpen] = useState(false);
    const [scannedZoneInput, setScannedZoneInput] = useState('');

    const [suggestedLane, setSuggestedLane] = useState<{
        code: string;
        reason: string;
        currentCount: number;
        capacity: number;
        rackCode: string;
    } | null>(null);

    const [showNumpad, setShowNumpad] = useState(false);

    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    const pnInputRef = useRef<HTMLInputElement>(null);
    const laneInputRef = useRef<HTMLInputElement>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const zoneScanInputRef = useRef<HTMLInputElement>(null);

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
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/overview`);
            if (res.ok) {
                const data: Rack[] = await res.json();
                setRacks(data);
                if (data.length > 0 && !selectedRackCode) {
                    setSelectedRackCode(data[0].code);
                }
            }
        } catch (err) {
            console.error('Błąd pobierania danych regałów:', err);
        }
    };

    // ⚡ Obsługa dopasowania zeskanowanego kodu do Strefy lub Regału
    const handleZoneBarcodeScan = (scannedText: string): boolean => {
        const cleanCode = scannedText.trim().toUpperCase();
        if (!cleanCode) return false;

        // 1. Sprawdzamy czy kod pasuje do konkretnego Regału (Rack Code)
        const matchedRack = racks.find(r => r.code.toUpperCase() === cleanCode);
        if (matchedRack) {
            if (matchedRack.groupId) {
                setAssignedGroupId(matchedRack.groupId);
                localStorage.setItem('SCANNER_GROUP_ID', matchedRack.groupId);
            }
            setSelectedRackCode(matchedRack.code);
            setPartNumber('');
            setLaneCode('');
            setBarcode('');
            setFeedback({
                type: 'success',
                message: `📍 ZESKANOWANO REGAŁ: ${matchedRack.code} (${matchedRack.name})`,
            });
            setIsZoneScanOpen(false);
            setScannedZoneInput('');
            pnInputRef.current?.focus();
            return true;
        }

        // 2. Sprawdzamy czy kod pasuje do Kodów Grupy Strefy (Group Code, np. "SMT")
        const matchedGroup = groups.find(g => g.code.toUpperCase() === cleanCode);
        if (matchedGroup) {
            handleGroupChange(matchedGroup.id);
            setPartNumber('');
            setLaneCode('');
            setBarcode('');
            setFeedback({
                type: 'success',
                message: `📍 ZESKANOWANO STREFĘ: ${matchedGroup.name}`,
            });
            setIsZoneScanOpen(false);
            setScannedZoneInput('');
            pnInputRef.current?.focus();
            return true;
        }

        // 3. Jeśli użytkownik ma strefę o nazwie 'ALL'
        if (cleanCode === 'ALL') {
            handleGroupChange('ALL');
            setIsZoneScanOpen(false);
            setScannedZoneInput('');
            pnInputRef.current?.focus();
            return true;
        }

        setFeedback({
            type: 'error',
            message: `⛔ NIEZNANY KOD STREFY/REGAŁU: "${cleanCode}"`,
        });
        setScannedZoneInput('');
        return false;
    };

    useEffect(() => {
        pnInputRef.current?.focus();
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

    // ⚡ Po otwarciu modalu skanowania strefy, natychmiast daj focus na niewidoczne/aktywowalne pole
    useEffect(() => {
        if (isZoneScanOpen) {
            setTimeout(() => {
                zoneScanInputRef.current?.focus();
            }, 100);
        }
    }, [isZoneScanOpen]);

    const handleGroupChange = (groupId: string) => {
        setAssignedGroupId(groupId);
        localStorage.setItem('SCANNER_GROUP_ID', groupId);

        const filtered = groupId === 'ALL' ? racks : racks.filter(r => r.groupId === groupId);
        if (filtered.length > 0) {
            setSelectedRackCode(filtered[0].code);
        }
    };

    useEffect(() => {
        const formattedPN = partNumber.toUpperCase().trim();

        if (!formattedPN) {
            setSuggestedLane(null);
            setLaneCode('');
            socket.emit('pick:highlight', {
                type: 'IN',
                groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
                rackCode: '',
                partNumber: '',
                targetLaneCode: '',
            });
            return;
        }

        const activeRacksList = assignedGroupId === 'ALL'
            ? racks
            : racks.filter(r => r.groupId === assignedGroupId);

        let foundCandidate: {
            code: string;
            reason: string;
            currentCount: number;
            capacity: number;
            rackCode: string;
        } | null = null;

        for (const rack of activeRacksList) {
            const capacity = rack.laneCapacity || 5;

            for (const lane of rack.lanes) {
                const matCount = lane.materials?.length || 0;
                const hasSamePN = lane.materials?.some((m) => m.partNumber.toUpperCase().trim() === formattedPN);

                if (hasSamePN && matCount < capacity) {
                    foundCandidate = {
                        code: lane.code.toUpperCase().trim(),
                        reason: `Zawiera ten P/N (${matCount}/${capacity} szt.)`,
                        currentCount: matCount,
                        capacity: capacity,
                        rackCode: rack.code,
                    };
                    break;
                }
            }
            if (foundCandidate) break;
        }

        if (!foundCandidate) {
            for (const rack of activeRacksList) {
                const capacity = rack.laneCapacity || 5;

                for (const lane of rack.lanes) {
                    const matCount = lane.materials?.length || 0;
                    if (matCount === 0) {
                        foundCandidate = {
                            code: lane.code.toUpperCase().trim(),
                            reason: `Sugerowany pusty tor (0/${capacity} szt.)`,
                            currentCount: 0,
                            capacity: capacity,
                            rackCode: rack.code,
                        };
                        break;
                    }
                }
                if (foundCandidate) break;
            }
        }

        const targetRackCode = foundCandidate?.rackCode || selectedRackCode || (activeRacksList[0]?.code ?? '');
        const targetLane = foundCandidate ? foundCandidate.code : '';

        if (foundCandidate) {
            setSuggestedLane(foundCandidate);
            setSelectedRackCode(foundCandidate.rackCode);
        } else {
            setSuggestedLane(null);
        }

        const payload = {
            type: 'IN',
            groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
            rackCode: targetRackCode,
            partNumber: formattedPN,
            targetLaneCode: targetLane,
        };

        if (socket.connected) {
            socket.emit('pick:highlight', payload);
        } else {
            socket.connect();
            socket.emit('pick:highlight', payload);
        }

    }, [partNumber, racks, assignedGroupId]);

    const filteredRacks = assignedGroupId === 'ALL'
        ? racks
        : racks.filter(r => r.groupId === assignedGroupId);

    const activeRack = filteredRacks.find((r) => r.code === selectedRackCode) || filteredRacks[0] || racks[0];

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const parsedQty = Number(quantity);

        if (!partNumber || !laneCode || !barcode || !quantity || isNaN(parsedQty) || parsedQty <= 0) {
            setFeedback({
                type: 'error',
                message: '🚨 Wypełnij wszystkie pola: P/N, Tor, Box oraz Ilość sztuk!',
            });
            return;
        }

        setLoading(true);
        setFeedback(null);
        setShowNumpad(false);

        try {
            const res = await fetch(`${API_BASE_URL}/fifo/scan-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    laneCode: laneCode.trim(),
                    barcode: barcode.trim(),
                    partNumber: partNumber.trim(),
                    quantity: parsedQty,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Błąd zapisu na torze.');
            }

            setFeedback({
                type: 'success',
                message: `✅ ZAREJESTROWANO! P/N: ${partNumber} (${parsedQty} szt.) | Tor: ${laneCode.toUpperCase()} | Box: ${barcode}`,
            });

            socket.emit('pick:highlight', {
                type: 'IN',
                groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
                rackCode: '',
                partNumber: '',
                targetLaneCode: '',
            });

            setPartNumber('');
            setLaneCode('');
            setBarcode('');
            setQuantity('');
            setSuggestedLane(null);
            await fetchRacks();
            pnInputRef.current?.focus();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Wystąpił nieznany błąd';
            setFeedback({
                type: 'error',
                message: `⛔ BŁĄD ZAŁADUNKU: ${errorMsg}`,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setPartNumber('');
        setLaneCode('');
        setBarcode('');
        setQuantity('');
        setSuggestedLane(null);
        setShowNumpad(false);
        setFeedback(null);
        socket.emit('pick:highlight', {
            type: 'IN',
            groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
            rackCode: '',
            partNumber: '',
            targetLaneCode: '',
        });
        pnInputRef.current?.focus();
    };

    const handleInputFocus = (
        e: React.FocusEvent<HTMLInputElement>,
        clearFn?: () => void
    ) => {
        setShowNumpad(false);
        e.target.setAttribute('readonly', 'readonly');
        setTimeout(() => {
            e.target.removeAttribute('readonly');
        }, 100);

        if (clearFn) {
            clearFn();
        }
    };

    const handleNumpadKey = (val: string) => {
        if (val === 'BACK') {
            setQuantity((prev) => prev.slice(0, -1));
        } else if (val === 'CLEAR') {
            setQuantity('');
        } else {
            setQuantity((prev) => (prev.length < 5 ? prev + val : prev));
        }
    };

    const scannedLane = activeRack
        ? activeRack.lanes.find((l) => l.code.toUpperCase().trim() === laneCode.toUpperCase().trim())
        : null;

    const shelvesCount = activeRack?.totalShelves || 4;
    const colsCount = activeRack?.totalColumns || 6;

    return (
        <div className="scanner-view min-h-dvh w-full bg-bw-navy text-bw-sand p-3 sm:p-4 font-sans select-none flex flex-col justify-between relative">
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-y-auto pr-0.5">
                {/* HEADER */}
                <header className="flex items-center justify-between border-b border-slate-800 pb-1 sm:pb-2 mb-1 sm:mb-2 shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-bw-cyan shrink-0" />
                        <div>
                            <h1 className="text-xs sm:text-base lg:text-lg font-black text-bw-cyan tracking-wider leading-tight">
                                SCAN IN TERMINAL
                            </h1>
                            <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 font-bold block">
                                SLIDEX • LIVE HIGHLIGHT
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                        <a
                            href="/scanner/scan-out"
                            className="bg-bw-cyan/10 hover:bg-bw-cyan/20 text-bw-cyan font-bold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-bw-cyan/40 transition-all flex items-center gap-1 active:scale-95"
                        >
                            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>Scan Out</span>
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

                {/* PASEK STREFY Z PRZYCISKIEM SKANOWANIA */}
                <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1 sm:mb-2 flex items-center justify-between gap-1.5 shrink-0">
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

                    {/* ⚡ PRZYCISK: SKANUJ KOD STREFY */}
                    <button
                        type="button"
                        onClick={() => setIsZoneScanOpen(true)}
                        className="bg-bw-cyan text-slate-950 font-black text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-bw-cyan hover:bg-bw-cyan/90 transition-all flex items-center gap-1.5 shrink-0 self-end mb-0.5 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(46,250,217,0.3)]"
                    >
                        <Scan className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
                        <span>SKANUJ STREFĘ</span>
                    </button>
                </div>

                {/* BANER ALARMOWY / KOMUNIKAT BŁĘDU */}
                {feedback && (
                    <div
                        className={`p-2 sm:p-3 rounded-lg sm:rounded-xl mb-1 sm:mb-2 font-mono text-[10px] sm:text-xs font-black border-2 shadow-xl flex items-start justify-between gap-1.5 sm:gap-2 shrink-0 animate-bounce ${
                            feedback.type === 'success'
                                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
                                : 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                        }`}
                    >
                        <div className="flex items-start gap-1.5 sm:gap-2.5">
                            {feedback.type === 'success' ? (
                                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                            )}
                            <div className="leading-tight break-words">
                                <div className="text-[8px] sm:text-[9px] uppercase tracking-wider font-extrabold mb-0.5 opacity-80">
                                    {feedback.type === 'success' ? 'STATUS OPERACJI' : '⛔ OSTRZEŻENIE'}
                                </div>
                                {feedback.message}
                            </div>
                        </div>

                        <button
                            onClick={() => setFeedback(null)}
                            className="p-0.5 sm:p-1 rounded-lg hover:bg-black/30 text-slate-300 transition-colors shrink-0 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                )}

                {/* WYBÓR REGAŁU */}
                <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1 sm:mb-2 shrink-0">
                    <label className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                        <span>Regał Do Przyjęcia:</span>
                    </label>
                    <select
                        value={selectedRackCode}
                        onChange={(e) => {
                            setSelectedRackCode(e.target.value);
                            setLaneCode('');
                            if (partNumber) {
                                socket.emit('pick:highlight', {
                                    type: 'IN',
                                    groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
                                    rackCode: e.target.value,
                                    partNumber: partNumber.toUpperCase().trim(),
                                    targetLaneCode: '',
                                });
                            }
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

                {/* MAPA STREFY / WYBÓR REGAŁU */}
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
                            {filteredRacks.map((rack) => {
                                const isSelected = rack.code === activeRack?.code;
                                const formattedPN = partNumber.toUpperCase().trim();
                                const hasPN = Boolean(formattedPN) && rack.lanes.some((lane) =>
                                    lane.materials?.some((material) => material.partNumber.toUpperCase().trim() === formattedPN)
                                );

                                return (
                                    <button
                                        type="button"
                                        key={rack.id}
                                        onClick={() => {
                                            setSelectedRackCode(rack.code);
                                            setLaneCode('');
                                            socket.emit('pick:highlight', {
                                                type: 'IN',
                                                groupId: assignedGroupId === 'ALL' ? undefined : assignedGroupId,
                                                rackCode: rack.code,
                                                partNumber: formattedPN,
                                                targetLaneCode: '',
                                            });
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
                                        <span className="text-[9px] sm:text-[10px] font-mono tracking-wider truncate max-w-full">{rack.code}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* SUGEROWANY TOR */}
                {suggestedLane ? (
                    <div className="bg-bw-cyan text-slate-950 p-1.5 sm:p-2 rounded-lg sm:rounded-xl mb-1 sm:mb-2 border-2 border-white shadow-[0_0_12px_#2EFAD9] flex items-center justify-between animate-pulse shrink-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                            <Target className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <div className="truncate">
                                <span className="text-[7px] sm:text-[8px] uppercase font-extrabold text-slate-900 block">
                                    SUGEROWANA LOKALIZACJA:
                                </span>
                                <div className="text-[11px] sm:text-xs font-mono font-black truncate">
                                    TOR: <span className="underline">{suggestedLane.code}</span> ({suggestedLane.reason})
                                </div>
                            </div>
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-mono font-black bg-slate-950 text-bw-cyan px-1 sm:px-1.5 py-0.5 rounded ml-1 sm:ml-2 shrink-0">
                            {suggestedLane.currentCount}/{suggestedLane.capacity}
                        </span>
                    </div>
                ) : partNumber ? (
                    <div className="bg-amber-950/80 text-amber-300 p-1 sm:p-1.5 rounded-lg sm:rounded-xl mb-1 sm:mb-2 text-[10px] sm:text-xs font-bold text-center border border-amber-700 shrink-0 flex items-center justify-center gap-1 sm:gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                        <span>Brak dedykowanego toru. Zeskanuj wolne miejsce.</span>
                    </div>
                ) : null}

                {/* MAPA REGAŁU */}
                {activeRack && (
                    <div className="bg-slate-950/80 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 mb-1 sm:mb-2 shadow-inner shrink-0">
                        <div className="flex items-center justify-between mb-0.5 sm:mb-1 text-[8px] sm:text-[9px] font-mono text-slate-400">
                            <span className="font-bold">MAPA REGAŁU ({activeRack.code})</span>
                            {scannedLane ? (
                                <span className="text-bw-cyan font-black animate-pulse flex items-center gap-1">
                                    <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    <span>CEL: S{scannedLane.shelf}-C{scannedLane.column} ({scannedLane.code})</span>
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
                                                    {isTarget ? <LogIn className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-950" /> : `S${shelfNum}C${colNum}`}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* FORMULARZ SKANOWANIA */}
                <form onSubmit={handleSubmit} className="space-y-1.5 sm:space-y-2 shrink-0 relative">
                    <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 focus-within:border-bw-cyan transition-all">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan tracking-wider mb-0.5 flex items-center justify-between">
                            <span>1. Part Number (P/N)</span>
                            <span className="text-[7px] sm:text-[8px] text-slate-500 font-normal">KROK 1</span>
                        </label>
                        <input
                            ref={pnInputRef}
                            type="text"
                            required
                            inputMode="none"
                            onFocus={(e) => handleInputFocus(e, () => setPartNumber(''))}
                            placeholder="Zeskanuj etykietę P/N..."
                            value={partNumber}
                            onChange={(e) => setPartNumber(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    laneInputRef.current?.focus();
                                }
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-black text-bw-cyan focus:outline-none uppercase cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 focus-within:border-bw-cyan transition-all">
                            <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan tracking-wider mb-0.5 flex items-center justify-between">
                                <span>2. Kod Toru</span>
                                <span className="text-[7px] sm:text-[8px] text-slate-500 font-normal">KROK 2</span>
                            </label>
                            <input
                                ref={laneInputRef}
                                type="text"
                                required
                                inputMode="none"
                                onFocus={(e) => handleInputFocus(e)}
                                placeholder="Zeskanuj tor..."
                                value={laneCode}
                                onChange={(e) => setLaneCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        barcodeInputRef.current?.focus();
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-black text-white focus:outline-none uppercase cursor-pointer"
                            />
                        </div>

                        <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 focus-within:border-bw-cyan transition-all">
                            <label className="block text-[8px] sm:text-[9px] font-black uppercase text-bw-cyan tracking-wider mb-0.5 flex items-center justify-between">
                                <span>3. Kod Boxa</span>
                                <span className="text-[7px] sm:text-[8px] text-slate-500 font-normal">KROK 3</span>
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
                                        setShowNumpad(true);
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-black text-white focus:outline-none cursor-pointer"
                            />
                        </div>
                    </div>

                    <div
                        onClick={() => {
                            setQuantity('');
                            setShowNumpad(true);
                        }}
                        className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all cursor-pointer ${
                            showNumpad
                                ? 'bg-slate-900 border-bw-cyan ring-1 sm:ring-2 ring-bw-cyan/30'
                                : 'bg-slate-900/90 border-slate-800'
                        }`}
                    >
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-300 mb-0.5 flex items-center justify-between">
                            <span>4. Ilość szt. w Boxie</span>
                            <span className="text-[7px] sm:text-[8px] text-bw-cyan font-bold flex items-center gap-1">
                                <Keyboard className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>NUMPAD</span>
                            </span>
                        </label>
                        <input
                            type="text"
                            readOnly
                            placeholder="Kliknij, aby wpisać..."
                            value={quantity ? `${quantity} szt.` : ''}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md sm:rounded-lg px-2 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono font-black text-bw-cyan focus:outline-none cursor-pointer"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-bw-cyan text-slate-950 font-black text-[11px] sm:text-xs py-2 sm:py-2.5 rounded-lg sm:rounded-xl shadow-lg hover:bg-bw-cyan/90 active:scale-98 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <span>ZAPISYWANIE...</span>
                        ) : (
                            <>
                                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
                                <span>ZAREJESTROWANIE (SCAN IN)</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* ⚡ MODAL SKANOWANIA KODU STREFY ZEBRA */}
            {isZoneScanOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-slate-900 border-2 border-bw-cyan rounded-2xl p-4 max-w-sm w-full shadow-[0_0_30px_rgba(46,250,217,0.3)] text-center relative">
                        <button
                            onClick={() => {
                                setIsZoneScanOpen(false);
                                pnInputRef.current?.focus();
                            }}
                            className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="w-12 h-12 bg-bw-cyan/10 text-bw-cyan rounded-full flex items-center justify-center mx-auto mb-3 border border-bw-cyan/40">
                            <QrCode className="w-6 h-6 animate-pulse" />
                        </div>

                        <h3 className="text-sm font-black text-bw-cyan uppercase tracking-wider mb-1">
                            SKANOWANIE STREFY / REGAŁU
                        </h3>
                        <p className="text-[11px] text-slate-300 mb-4 font-mono">
                            Naciśnij żółty przycisk skanera na TC27 i nakieruj na kod strefy (np. SMT, SMT-RACK01).
                        </p>

                        <input
                            ref={zoneScanInputRef}
                            type="text"
                            inputMode="none"
                            value={scannedZoneInput}
                            onChange={(e) => setScannedZoneInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleZoneBarcodeScan(scannedZoneInput);
                                }
                            }}
                            placeholder="OCZEKIWANIE NA SKAN..."
                            className="w-full bg-slate-950 border-2 border-bw-cyan rounded-xl px-3 py-2.5 text-center font-mono font-black text-sm text-bw-cyan focus:outline-none uppercase tracking-widest mb-3"
                        />

                        <button
                            onClick={() => {
                                setIsZoneScanOpen(false);
                                pnInputRef.current?.focus();
                            }}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-xl border border-slate-700 transition-colors"
                        >
                            Anuluj
                        </button>
                    </div>
                </div>
            )}

            {/* NUMPAD */}
            {showNumpad && (
                <div className="bg-slate-950/95 border-t-2 border-bw-cyan p-1.5 sm:p-2 mt-1 rounded-t-xl sm:rounded-t-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 shrink-0 z-50">
                    <div className="flex items-center justify-between mb-1 px-1">
                        <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-400">
                            ILOŚĆ: <strong className="text-bw-cyan text-sm sm:text-base ml-1">{quantity || '0'}</strong>
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowNumpad(false)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md cursor-pointer"
                        >
                            Zamknij
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                        {['1', '2', '3'].map((num) => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => handleNumpadKey(num)}
                                className="bg-slate-900 hover:bg-slate-800 active:bg-bw-cyan active:text-slate-950 text-white font-mono font-black text-sm sm:text-base py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 transition-all cursor-pointer"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => handleNumpadKey('BACK')}
                            className="bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-600 text-rose-300 font-bold text-xs py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-rose-900 transition-all flex items-center justify-center cursor-pointer"
                        >
                            <Delete className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        {['4', '5', '6'].map((num) => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => handleNumpadKey(num)}
                                className="bg-slate-900 hover:bg-slate-800 active:bg-bw-cyan active:text-slate-950 text-white font-mono font-black text-sm sm:text-base py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 transition-all cursor-pointer"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => handleNumpadKey('CLEAR')}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-[8px] sm:text-[9px] py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 uppercase cursor-pointer"
                        >
                            CLR
                        </button>

                        {['7', '8', '9'].map((num) => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => handleNumpadKey(num)}
                                className="bg-slate-900 hover:bg-slate-800 active:bg-bw-cyan active:text-slate-950 text-white font-mono font-black text-sm sm:text-base py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 transition-all cursor-pointer"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            type="submit"
                            onClick={(e) => {
                                setShowNumpad(false);
                                void handleSubmit(e);
                            }}
                            className="bg-bw-cyan text-slate-950 font-black text-xs py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-lg hover:bg-bw-cyan/90 transition-all row-span-2 flex items-center justify-center cursor-pointer"
                        >
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                        </button>

                        <button
                            type="button"
                            onClick={() => handleNumpadKey('0')}
                            className="col-span-3 bg-slate-900 hover:bg-slate-800 active:bg-bw-cyan active:text-slate-950 text-white font-mono font-black text-sm sm:text-base py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 transition-all cursor-pointer"
                        >
                            0
                        </button>
                    </div>
                </div>
            )}

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
