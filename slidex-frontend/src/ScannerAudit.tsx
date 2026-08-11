import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, RotateCcw, ScanBarcode, Trash2 } from 'lucide-react';
import { API_BASE_URL } from './config/api';

interface Material { id: string; barcode: string; partNumber: string; quantity: number; }
interface Lane { code: string; materials: Material[]; }
interface Rack { id: string; code: string; name?: string; groupId?: string | null; auditStartedAt?: string | null; lanes: Lane[]; }
interface AuditedItem extends Material { laneCode: string; quantity: number; }

export default function ScannerAudit() {
    const [racks, setRacks] = useState<Rack[]>([]);
    const [rackId, setRackId] = useState('');
    const [startedAt, setStartedAt] = useState('');
    const [items, setItems] = useState<AuditedItem[]>([]);
    const [barcode, setBarcode] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [assignedGroupId] = useState(() => localStorage.getItem('SCANNER_GROUP_ID') || 'ALL');

    const loadRacks = useCallback(async () => {
        const response = await fetch(`${API_BASE_URL}/fifo/overview`);
        if (!response.ok) throw new Error('Nie udało się pobrać regałów.');
        const data: Rack[] = await response.json();
        const activeRack = data.find((rack) => rack.auditStartedAt);
        const filtered = assignedGroupId === 'ALL' ? data : data.filter((rack) => rack.groupId === assignedGroupId);
        setRacks(activeRack && !filtered.some((rack) => rack.id === activeRack.id) ? [activeRack, ...filtered] : filtered);
        setRackId((current) => activeRack?.id || current || filtered[0]?.id || '');
        if (activeRack?.auditStartedAt) {
            setStartedAt(activeRack.auditStartedAt);
            setMessage(`Wznowiono aktywny audyt regału ${activeRack.code}. Zeskanuj pozycje od początku.`);
        }
    }, [assignedGroupId]);

    useEffect(() => { void loadRacks().catch((error: Error) => setMessage(error.message)); }, [loadRacks]);

    const rack = racks.find((candidate) => candidate.id === rackId);
    const expected = useMemo(() => rack?.lanes.flatMap((lane) => lane.materials.map((item) => ({ ...item, laneCode: lane.code }))) || [], [rack]);

    const startAudit = async () => {
        if (!rack) return;
        try {
            const response = await fetch(`${API_BASE_URL}/fifo/racks/${rack.id}/audit/start`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Nie udało się rozpocząć audytu.');
            setStartedAt(result.auditStartedAt);
            setItems([]);
            setBarcode('');
            setMessage('Audyt rozpoczęty. SCAN IN i SCAN OUT są teraz zablokowane.');
            setTimeout(() => inputRef.current?.focus(), 0);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Błąd rozpoczęcia audytu.'); }
    };

    const resetScans = () => {
        setItems([]); setBarcode('');
        setMessage('Lista wyczyszczona. Audyt pozostaje aktywny — zeskanuj regał od początku.');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const cancelAudit = async (goToMenu = false) => {
        if (rack && startedAt) {
            const response = await fetch(`${API_BASE_URL}/fifo/racks/${rack.id}/audit`, { method: 'DELETE' });
            if (!response.ok) {
                const result = await response.json();
                setMessage(result.message || 'Nie udało się anulować audytu.');
                return;
            }
        }
        setStartedAt(''); setItems([]);
        if (goToMenu) window.location.href = '/scanner';
        else setMessage('Audyt anulowany. SCAN IN i SCAN OUT są ponownie dostępne.');
    };

    const scan = (event: FormEvent) => {
        event.preventDefault();
        const code = barcode.trim();
        if (!code || !rack) return;
        const candidates = expected.filter((item) => item.barcode === code && !items.some((scanned) => scanned.id === item.id));
        const found = candidates[0];
        if (!found) {
            setMessage(expected.some((item) => item.barcode === code) ? 'Wszystkie pozycje z tym kodem są już zeskanowane.' : 'Ten kod nie znajduje się w stanie wybranego regału.');
        } else {
            setItems((current) => [...current, { ...found, quantity: Number(found.quantity) || 1 }]);
            setMessage(`Dodano ${found.partNumber} • ${found.laneCode}`);
        }
        setBarcode('');
        inputRef.current?.focus();
    };

    const finish = async () => {
        if (!rack || !startedAt) return;
        const missing = expected.length - items.length;
        if (!window.confirm(`Zakończyć audyt? Zaktualizujesz ${items.length} pozycji, a ${missing} niezeskanowanych oznaczysz jako usunięte.`)) return;
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/fifo/racks/${rack.id}/audit`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startedAt, items: items.map((item) => ({ materialId: item.id, quantity: item.quantity })) }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Nie udało się zapisać audytu.');
            setMessage(`Audyt zapisany: ${result.updated} zaktualizowanych, ${result.removed} usuniętych.`);
            setStartedAt(''); setItems([]); await loadRacks();
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Błąd zapisu audytu.'); }
        finally { setSaving(false); }
    };

    return <div className="scanner-view min-h-dvh bg-bw-navy text-white p-3 sm:p-5 font-sans">
        <div className="max-w-xl mx-auto space-y-3">
            <header className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2"><ClipboardCheck className="text-amber-300" /><div><h1 className="font-black text-amber-300">AUDIT MODE</h1><p className="text-[10px] text-slate-400 font-mono">PEŁNY SPIS I KOREKTA ILOŚCI</p></div></div>
                <button onClick={() => void cancelAudit(true)} className="flex items-center gap-1 text-xs font-bold text-bw-cyan border border-bw-cyan/40 rounded-lg px-2 py-1"><ArrowLeft size={14}/> Menu</button>
            </header>

            <section className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase">Regał do audytu</label>
                <select disabled={!!startedAt} value={rackId} onChange={(event) => setRackId(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-black text-bw-cyan disabled:opacity-60">
                    {racks.map((item) => <option key={item.id} value={item.id}>{item.code} {item.name ? `• ${item.name}` : ''}</option>)}
                </select>
                {!startedAt ? <button onClick={() => void startAudit()} disabled={!rack} className="w-full bg-amber-300 text-slate-950 rounded-lg py-2 font-black disabled:opacity-40"><ScanBarcode className="inline mr-2" size={18}/>ROZPOCZNIJ AUDYT ({expected.length} POZYCJI)</button> :
                    <div className="grid grid-cols-2 gap-2"><button onClick={resetScans} className="border border-slate-700 rounded-lg py-1.5 text-xs font-bold text-slate-300"><RotateCcw className="inline mr-1" size={14}/> Od początku</button><button onClick={() => void cancelAudit()} className="border border-rose-400/50 rounded-lg py-1.5 text-xs font-bold text-rose-300">ANULUJ AUDYT</button></div>}
            </section>

            {startedAt && <>
                <form onSubmit={scan} className="bg-slate-900 border-2 border-amber-300 rounded-xl p-3 space-y-2">
                    <label className="text-[10px] font-black text-amber-300">SKANUJ KOD POJEMNIKA</label>
                    <input ref={inputRef} autoFocus value={barcode} onChange={(event) => setBarcode(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono font-black text-bw-cyan" placeholder="KOD KRESKOWY..." />
                    <div className="flex justify-between text-xs font-mono"><span>Zeskanowano: <b className="text-bw-cyan">{items.length}</b></span><span>Oczekiwano: {expected.length}</span></div>
                </form>

                <div className="space-y-2 max-h-[42vh] overflow-y-auto">
                    {[...items].reverse().map((item) => <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex gap-2 items-center">
                        <CheckCircle2 className="text-emerald-400 shrink-0" size={18}/><div className="min-w-0 flex-1"><div className="font-mono font-black text-xs truncate">{item.barcode}</div><div className="text-[9px] text-slate-400">{item.partNumber} • {item.laneCode}</div></div>
                        <input type="number" min={1} value={item.quantity} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.max(1, Number(event.target.value) || 1) } : entry))} className="w-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-center font-mono font-black text-amber-300" />
                        <button onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="text-rose-400 p-1"><Trash2 size={16}/></button>
                    </div>)}
                </div>
                <button onClick={() => void finish()} disabled={saving} className="w-full bg-bw-cyan text-slate-950 rounded-xl py-3 font-black disabled:opacity-40">{saving ? 'ZAPISYWANIE...' : 'ZAKOŃCZ I ZAKTUALIZUJ STAN'}</button>
            </>}
            {message && <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-center text-slate-300">{message}</div>}
        </div>
    </div>;
}
