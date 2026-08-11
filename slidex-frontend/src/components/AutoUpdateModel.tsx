import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';

const CURRENT_APP_VERSION = '1.0.0';

interface VersionInfo {
    latestVersion: string;
    required: boolean;
    notes: string;
    apkFileName: string;
}

export default function AutoUpdateModel() {
    const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [downloading, setDownloading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void checkForUpdates();
    }, []);

    const checkForUpdates = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/fifo/app-version`);
            if (res.ok) {
                const data: VersionInfo = await res.json();

                if (data.latestVersion !== CURRENT_APP_VERSION) {
                    setVersionInfo(data);
                    setUpdateAvailable(true);
                }
            }
        } catch (err) {
            console.error('Błąd sprawdzania wersji aplikacji:', err);
        }
    };

    const handleStartUpdate = () => {
        setDownloading(true);
        setError(null);

        try {
            const downloadUrl = `${API_BASE_URL}/fifo/download-apk`;
            console.log('📥 Pobieranie pliku APK z adresu:', downloadUrl);

            // 🚀 Bezpośrednie wywołanie pobierania APK w przeglądarce Androida
            window.location.href = downloadUrl;

            // Zdejmujemy spinner po 4 sekundach (rozpoczęto pobieranie w tle)
            setTimeout(() => {
                setDownloading(false);
            }, 4000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Nie udało się rozpocząć pobierania.';
            setError(msg);
            setDownloading(false);
        }
    };

    if (!updateAvailable || !versionInfo) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none">
            <div className="bg-slate-900 border-2 border-bw-cyan/60 rounded-2xl max-w-md w-full p-5 shadow-[0_0_40px_rgba(46,250,217,0.2)] text-bw-sand space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <div className="p-2.5 bg-bw-cyan/10 border border-bw-cyan/40 rounded-xl text-bw-cyan">
                        <Download className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-wider">
                            Dostępna Aktualizacja!
                        </h3>
                        <span className="text-xs font-mono text-bw-cyan font-bold block">
                            Wersja: {CURRENT_APP_VERSION} ➔ <strong className="text-white underline">{versionInfo.latestVersion}</strong>
                        </span>
                    </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">Co nowego:</span>
                    <p className="text-slate-200 leading-relaxed">{versionInfo.notes}</p>
                </div>

                {error && (
                    <div className="p-2.5 bg-rose-950/80 border border-rose-500 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                    {!versionInfo.required && !downloading && (
                        <button
                            type="button"
                            onClick={() => setUpdateAvailable(false)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl border border-slate-700 transition-all active:scale-95 cursor-pointer"
                        >
                            Pomiń
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleStartUpdate}
                        disabled={downloading}
                        className="flex-1 bg-bw-cyan hover:bg-bw-cyan/90 text-slate-950 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(46,250,217,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {downloading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Pobieranie APK...</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                <span>Pobierz APK</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}