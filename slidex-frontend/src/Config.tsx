import { useState, useEffect } from 'react';
import { API_BASE_URL } from './config/api';
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult
} from '@hello-pangea/dnd';

// 🎨 Import ikon z lucide-react
import {
    Settings,
    Building2,
    MapPin,
    Plus,
    RefreshCw,
    Layers,
    Grid,
    CheckCircle2,
    AlertTriangle,
    ArrowLeft,
    Trash2,
    Pencil,
    Save,
    X,
    GripVertical
} from 'lucide-react';

export interface RackGroup {
    id: string;
    code: string;
    name: string;
}

export interface Lane {
    id: string;
    code: string;
    shelf: number;
    column: number;
}

export interface Rack {
    id: string;
    code: string;
    name: string;
    groupId?: string | null;
    totalShelves: number;
    totalColumns: number;
    position?: number;
    lanes?: Lane[];
}

export default function Config() {
    const [groups, setGroups] = useState<RackGroup[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);
    const [loading, setLoading] = useState(false);

    // 🔴 Formularz Tworzenia Strefy
    const [newGroupCode, setNewGroupCode] = useState('');
    const [newGroupName, setNewGroupName] = useState('');

    // 🔴 Stan Edycji Strefy
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editGroupCode, setEditGroupCode] = useState('');
    const [editGroupName, setEditGroupName] = useState('');

    // 🔵 Formularz Tworzenia Regału
    const [newRackCode, setNewRackCode] = useState('');
    const [newRackName, setNewRackName] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [shelvesCount, setShelvesCount] = useState<number>(4);
    const [colsCount, setColsCount] = useState<number>(6);

    // 🔵 Stan Edycji Regału
    const [editingRackId, setEditingRackId] = useState<string | null>(null);
    const [editRackCode, setEditRackCode] = useState('');
    const [editRackName, setEditRackName] = useState('');
    const [editRackGroupId, setEditRackGroupId] = useState<string>('');
    const [editShelvesCount, setEditShelvesCount] = useState<number>(4);
    const [editColsCount, setEditColsCount] = useState<number>(6);

    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    useEffect(() => {
        void fetchAllData();
    }, []);

    const fetchAllData = async (): Promise<void> => {
        setLoading(true);
        try {
            await Promise.all([fetchGroups(), fetchRacks()]);
        } catch (err) {
            console.error('Błąd pobierania danych konfiguracyjnych:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async (): Promise<void> => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/groups`);
            if (res.ok) {
                const data: RackGroup[] = await res.json();
                setGroups(data);
                if (data.length > 0 && !selectedGroupId) {
                    setSelectedGroupId(data[0].id);
                }
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
                // Sortujemy lokalnie od razu przy zasileniu stanu
                data.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                setRacks(data);
            }
        } catch (err) {
            console.error('Błąd pobierania regałów:', err);
        }
    };

    // ==========================================
    // 📍 STREFY (RACK GROUPS) - CRUD
    // ==========================================

    const handleAddGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupCode.trim() || !newGroupName.trim()) return;

        try {
            const res = await fetch(`${API_BASE_URL}/fifo/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: newGroupCode.trim().toUpperCase(),
                    name: newGroupName.trim(),
                }),
            });

            if (!res.ok) throw new Error('Nie udało się utworzyć strefy.');

            setFeedback({ type: 'success', message: 'Dodano nową strefę!' });
            setNewGroupCode('');
            setNewGroupName('');
            await fetchGroups();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Błąd zapisu strefy';
            setFeedback({ type: 'error', message: msg });
        }
    };

    const handleStartEditGroup = (g: RackGroup) => {
        setEditingGroupId(g.id);
        setEditGroupCode(g.code);
        setEditGroupName(g.name);
    };

    const handleSaveGroupEdit = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/groups/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: editGroupCode.trim().toUpperCase(),
                    name: editGroupName.trim(),
                }),
            });

            if (!res.ok) throw new Error('Nie udało się zaktualizować strefy.');

            setFeedback({ type: 'success', message: 'Zaktualizowano dane strefy!' });
            setEditingGroupId(null);
            await fetchGroups();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Błąd edycji strefy';
            setFeedback({ type: 'error', message: msg });
        }
    };

    const handleDeleteGroup = async (id: string, code: string) => {
        if (!confirm(`Czy na pewno chcesz usunąć strefę "${code}"?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/fifo/groups/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Nie udało się usunąć strefy.');

            setFeedback({ type: 'success', message: `Usunięto strefę ${code}` });
            await fetchAllData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Błąd usuwania strefy';
            setFeedback({ type: 'error', message: msg });
        }
    };

    // ==========================================
    // 🏢 REGAŁY (RACKS) - CRUD & DRAG AND DROP
    // ==========================================

    const handleAddRack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRackCode.trim() || !newRackName.trim()) return;

        try {
            const res = await fetch(`${API_BASE_URL}/fifo/racks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: newRackCode.trim().toUpperCase(),
                    name: newRackName.trim(),
                    groupId: selectedGroupId || null,
                    totalShelves: Number(shelvesCount),
                    totalColumns: Number(colsCount),
                    position: racks.length, // Nowy regał trafia na koniec
                }),
            });

            if (!res.ok) throw new Error('Nie udało się utworzyć regału.');

            setFeedback({ type: 'success', message: `Dodano regał ${newRackCode.toUpperCase()}!` });
            setNewRackCode('');
            setNewRackName('');
            await fetchRacks();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Błąd zapisu regału';
            setFeedback({ type: 'error', message: msg });
        }
    };

    const handleStartEditRack = (r: Rack) => {
        setEditingRackId(r.id);
        setEditRackCode(r.code);
        setEditRackName(r.name);
        setEditRackGroupId(r.groupId || '');
        setEditShelvesCount(r.totalShelves);
        setEditColsCount(r.totalColumns);
    };

    const handleSaveRackEdit = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/racks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: editRackCode.trim().toUpperCase(),
                    name: editRackName.trim(),
                    groupId: editRackGroupId || null,
                    totalShelves: Number(editShelvesCount),
                    totalColumns: Number(editColsCount),
                }),
            });

            if (!res.ok) throw new Error('Nie udało się zaktualizować regału.');

            setFeedback({ type: 'success', message: 'Zaktualizowano dane regału!' });
            setEditingRackId(null);
            await fetchRacks();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Błąd edycji regału';
            setFeedback({ type: 'error', message: msg });
        }
    };

    const handleDeleteRack = async (id: string, code: string) => {
        if (!confirm(`Czy na pewno chcesz usunąć regał "${code}" oraz przypisane do niego tory?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/fifo/racks/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Nie udało się usunąć regału.');

            setFeedback({ type: 'success', message: `Usunięto regał ${code}` });
            await fetchRacks();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Błąd usuwania regału';
            setFeedback({ type: 'error', message: msg });
        }
    };

    // 🚀 NATYCHMIASTOWA I PŁYNNA OBSŁUGA DRAG AND DROP
    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        if (sourceIndex === destinationIndex) return;

        // 1. Klonujemy listę i przekładamy elementy w pamięci lokalnej (zerowe opóźnienie UI)
        const reorderedRacks = Array.from(racks);
        const [movedRack] = reorderedRacks.splice(sourceIndex, 1);
        reorderedRacks.splice(destinationIndex, 0, movedRack);

        // 2. Przypisujemy nowe indeksy pozycji
        const updatedRacks = reorderedRacks.map((r, index) => ({
            ...r,
            position: index,
        }));

        // Aktualizujemy stan optymistycznie
        setRacks(updatedRacks);

        // 3. Zapisujemy w tle nowe pozycje w bazie danych
        try {
            await Promise.all(
                updatedRacks.map((rack) =>
                    fetch(`${API_BASE_URL}/fifo/racks/${rack.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ position: rack.position }),
                    })
                )
            );
            setFeedback({ type: 'success', message: 'Zapisano nową kolejność regałów!' });
        } catch (err) {
            console.error('Błąd zapisu nowej kolejności:', err);
            setFeedback({ type: 'error', message: 'Błąd synchronizacji kolejności z serwerem.' });
            await fetchRacks(); // Przywracamy ze stanu serwera w razie błędu
        }
    };

    return (
        <div className="min-h-screen w-full bg-bw-navy text-bw-sand p-3 sm:p-6 font-sans select-none flex flex-col justify-between">
            <div className="max-w-5xl mx-auto w-full space-y-4">
                {/* NAGŁÓWEK */}
                <header className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                        <Settings className="w-6 h-6 text-bw-cyan" />
                        <div>
                            <h1 className="text-lg sm:text-2xl font-black text-bw-cyan tracking-wider leading-tight">
                                CONFIGURATION TERMINAL
                            </h1>
                            <span className="text-xs font-mono text-slate-400 font-bold block">
                                ZARZĄDZANIE STREFAMI, REGAŁAMI I SIATKĄ TORÓW
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => void fetchAllData()}
                            disabled={loading}
                            className="bg-slate-900 hover:bg-slate-800 text-bw-sand font-bold text-xs p-2 rounded-lg border border-slate-800 active:scale-95 flex items-center justify-center cursor-pointer"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <a
                            href="/scanner"
                            className="bg-bw-cyan/10 hover:bg-bw-cyan/20 text-bw-cyan font-bold text-xs px-3 py-1.5 rounded-lg border border-bw-cyan/40 active:scale-95 flex items-center gap-1.5"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Menu Skanera</span>
                        </a>
                    </div>
                </header>

                {/* BANER FEEDBACKU */}
                {feedback && (
                    <div
                        className={`p-2.5 rounded-xl text-center font-bold text-xs border shadow-lg flex items-center justify-center gap-2 animate-in fade-in ${
                            feedback.type === 'success'
                                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                                : 'bg-rose-950/90 border-rose-500 text-rose-300'
                        }`}
                    >
                        {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                        <span>{feedback.message}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 📍 SEKCJA 1: ZARZĄDZANIE STREFAMI */}
                    <div className="bg-slate-900/90 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h2 className="text-sm font-black text-bw-cyan uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="w-4 h-4" />
                                <span>1. STREFY HALI (RACK GROUPS)</span>
                            </h2>
                            <span className="text-xs font-mono text-slate-500 font-bold">{groups.length} stref</span>
                        </div>

                        {/* Formularz Dodawania Strefy */}
                        <form onSubmit={handleAddGroup} className="space-y-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Kod Strefy:</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="np. A1, HALA-B"
                                        value={newGroupCode}
                                        onChange={(e) => setNewGroupCode(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-white focus:outline-none uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Nazwa Opisowa:</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="np. Strefa Montażu"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-bw-cyan/20 hover:bg-bw-cyan/30 text-bw-cyan border border-bw-cyan/40 font-black text-xs py-1.5 rounded-md transition-all active:scale-98 flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Dodaj Strefę</span>
                            </button>
                        </form>

                        {/* Lista Stref */}
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {groups.map((g) => {
                                const isEditing = editingGroupId === g.id;

                                return (
                                    <div key={g.id} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono gap-2">
                                        {isEditing ? (
                                            <div className="flex-1 grid grid-cols-2 gap-1.5">
                                                <input
                                                    type="text"
                                                    value={editGroupCode}
                                                    onChange={(e) => setEditGroupCode(e.target.value)}
                                                    className="bg-slate-900 border border-bw-cyan rounded px-1.5 py-0.5 text-xs text-white font-bold uppercase"
                                                />
                                                <input
                                                    type="text"
                                                    value={editGroupName}
                                                    onChange={(e) => setEditGroupName(e.target.value)}
                                                    className="bg-slate-900 border border-bw-cyan rounded px-1.5 py-0.5 text-xs text-white font-bold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="truncate">
                                                <span className="font-black text-bw-cyan">{g.code}</span>
                                                <span className="text-slate-400 ml-2">({g.name})</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 shrink-0">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => void handleSaveGroupEdit(g.id)}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded active:scale-95 cursor-pointer"
                                                        title="Zapisz"
                                                    >
                                                        <Save className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingGroupId(null)}
                                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded active:scale-95 cursor-pointer"
                                                        title="Anuluj"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStartEditGroup(g)}
                                                        className="bg-slate-900 hover:bg-slate-800 text-bw-cyan p-1 rounded border border-slate-800 active:scale-95 cursor-pointer"
                                                        title="Edytuj"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => void handleDeleteGroup(g.id, g.code)}
                                                        className="bg-slate-900 hover:bg-rose-950 text-rose-400 p-1 rounded border border-slate-800 hover:border-rose-800 active:scale-95 cursor-pointer"
                                                        title="Usuń"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 🏢 SEKCJA 2: ZARZĄDZANIE REGAŁAMI (DRAG & DROP) */}
                    <div className="bg-slate-900/90 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-3 shadow-md flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                                <h2 className="text-sm font-black text-bw-cyan uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4" />
                                    <span>2. REGAŁY (PRZECIĄGNIJ ABY ZMIENIĆ KOLEJNOŚĆ)</span>
                                </h2>
                                <span className="text-xs font-mono text-slate-500 font-bold">{racks.length} regałów</span>
                            </div>

                            {/* Formularz Dodawania Regału */}
                            <form onSubmit={handleAddRack} className="space-y-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Kod Regału:</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="np. RACK01"
                                            value={newRackCode}
                                            onChange={(e) => setNewRackCode(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-white focus:outline-none uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Nazwa:</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="np. Regał Główny"
                                            value={newRackName}
                                            onChange={(e) => setNewRackName(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Przypisz Strefę:</label>
                                        <select
                                            value={selectedGroupId}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                            className="w-full bg-slate-900 text-bw-cyan font-bold text-xs rounded-md p-1 border border-slate-700 focus:outline-none cursor-pointer"
                                        >
                                            <option value="">-- Brak --</option>
                                            {groups.map((g) => (
                                                <option key={g.id} value={g.id}>
                                                    {g.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Półek (S):</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={shelvesCount}
                                            onChange={(e) => setShelvesCount(Number(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-white focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Kolumn (C):</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="12"
                                            value={colsCount}
                                            onChange={(e) => setColsCount(Number(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-white focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-bw-cyan text-slate-950 font-black text-xs py-1.5 rounded-md hover:bg-bw-cyan/90 transition-all active:scale-98 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    <Grid className="w-3.5 h-3.5" />
                                    <span>Utwórz Regał z Siatką ({shelvesCount * colsCount} torów)</span>
                                </button>
                            </form>

                            {/* 🖐️ LISTA DRAG AND DROP */}
                            <DragDropContext onDragEnd={(res) => void handleDragEnd(res)}>
                                <Droppable droppableId="racks-list">
                                    {(provided) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className="space-y-1.5 max-h-80 overflow-y-auto pr-1"
                                        >
                                            {racks.map((r, index) => {
                                                const isEditing = editingRackId === r.id;
                                                const groupCode = groups.find((g) => g.id === (isEditing ? editRackGroupId : r.groupId))?.code || 'BEZ STREFY';

                                                return (
                                                    <Draggable key={r.id} draggableId={r.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`bg-slate-950 p-2 rounded-lg border text-xs font-mono transition-shadow ${
                                                                    snapshot.isDragging
                                                                        ? 'border-bw-cyan shadow-[0_0_15px_rgba(46,250,217,0.4)] bg-slate-900 opacity-95'
                                                                        : 'border-slate-800'
                                                                }`}
                                                            >
                                                                {isEditing ? (
                                                                    <div className="space-y-1.5 bg-slate-900 p-2 rounded border border-bw-cyan/50">
                                                                        <div className="grid grid-cols-2 gap-1.5">
                                                                            <input
                                                                                type="text"
                                                                                value={editRackCode}
                                                                                onChange={(e) => setEditRackCode(e.target.value)}
                                                                                className="bg-slate-950 border border-bw-cyan rounded px-1.5 py-0.5 text-xs text-white font-bold uppercase"
                                                                                placeholder="Kod Regału"
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={editRackName}
                                                                                onChange={(e) => setEditRackName(e.target.value)}
                                                                                className="bg-slate-950 border border-bw-cyan rounded px-1.5 py-0.5 text-xs text-white font-bold"
                                                                                placeholder="Nazwa Regału"
                                                                            />
                                                                        </div>
                                                                        <div className="grid grid-cols-3 gap-1.5">
                                                                            <select
                                                                                value={editRackGroupId}
                                                                                onChange={(e) => setEditRackGroupId(e.target.value)}
                                                                                className="bg-slate-950 text-bw-cyan border border-slate-700 rounded px-1 py-0.5 text-[10px] font-bold"
                                                                            >
                                                                                <option value="">Brak Strefy</option>
                                                                                {groups.map((g) => (
                                                                                    <option key={g.id} value={g.id}>
                                                                                        {g.code}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max="10"
                                                                                value={editShelvesCount}
                                                                                onChange={(e) => setEditShelvesCount(Number(e.target.value))}
                                                                                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                                                                                title="Liczba Półek"
                                                                            />
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max="12"
                                                                                value={editColsCount}
                                                                                onChange={(e) => setEditColsCount(Number(e.target.value))}
                                                                                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                                                                                title="Liczba Kolumn"
                                                                            />
                                                                        </div>
                                                                        <div className="flex justify-end gap-1.5 pt-1">
                                                                            <button
                                                                                onClick={() => void handleSaveRackEdit(r.id)}
                                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                                                                            >
                                                                                <Save className="w-3 h-3" /> Zapisz
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingRackId(null)}
                                                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold active:scale-95 cursor-pointer"
                                                                            >
                                                                                Anuluj
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-between">
                                                                        {/* Lewa strona z ikona Uchwytu */}
                                                                        <div className="flex items-center gap-2">
                                                                            <div
                                                                                {...provided.dragHandleProps}
                                                                                className="p-1 text-slate-500 hover:text-bw-cyan cursor-grab active:cursor-grabbing rounded hover:bg-slate-900 transition-colors"
                                                                                title="Przeciągnij, aby zmienić kolejność"
                                                                            >
                                                                                <GripVertical className="w-4 h-4" />
                                                                            </div>

                                                                            <div>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="font-black text-white">{r.code}</span>
                                                                                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                                                                                        (Poz: #{index + 1})
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-slate-400 text-[10px]">{r.name}</span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Prawa strona z danymi regału */}
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="bg-bw-cyan/10 text-bw-cyan border border-bw-cyan/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                                                {groupCode}
                                                                            </span>
                                                                            <span className="text-slate-500 text-[10px] font-bold flex items-center gap-0.5">
                                                                                <Layers className="w-3 h-3 text-slate-400" />
                                                                                {r.totalShelves}x{r.totalColumns}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => handleStartEditRack(r)}
                                                                                className="bg-slate-900 hover:bg-slate-800 text-bw-cyan p-1 rounded border border-slate-800 active:scale-95 cursor-pointer ml-1"
                                                                                title="Edytuj"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => void handleDeleteRack(r.id, r.code)}
                                                                                className="bg-slate-900 hover:bg-rose-950 text-rose-400 p-1 rounded border border-slate-800 hover:border-rose-800 active:scale-95 cursor-pointer"
                                                                                title="Usuń"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-4 pt-2 border-t border-slate-800 text-center text-[10px] font-mono text-slate-500">
                SLIDEX SYSTEM CONFIGURATION MODULE v2.0
            </footer>
        </div>
    );
}