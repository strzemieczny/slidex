import { ClipboardCheck, LockKeyhole } from 'lucide-react';

export interface AuditStatus {
    active: boolean;
    rackId: string;
    rackCode: string;
    groupId: string | null;
    startedAt?: string | null;
}

export default function AuditDashboardOverlay({ audit }: { audit: AuditStatus }) {
    return (
        <div className="dashboard-rack-audit" role="status" aria-live="polite">
            <div className="dashboard-rack-audit__icon"><ClipboardCheck /></div>
            <div>
                <span>AUDYT W TOKU</span>
                <strong>{audit.rackCode}</strong>
                <p><LockKeyhole /> REGAŁ ZABLOKOWANY DLA SCAN IN / OUT</p>
            </div>
        </div>
    );
}
