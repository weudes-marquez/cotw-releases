import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { X, Trophy, Plus } from 'lucide-react';

export const Overlay: React.FC = () => {
    const [grind, setGrind] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) return;

        const unsub = onSnapshot(doc(db, `users/${auth.currentUser.uid}/currentGrind`, 'active'), (doc) => {
            if (doc.exists()) {
                setGrind(doc.data());
            } else {
                setGrind(null);
                // Close overlay if no active grind
                window.ipcRenderer.invoke('toggle-overlay', false);
            }
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const increment = async () => {
        if (!grind || !auth.currentUser) return;

        const newCount = grind.killCount + 1;

        // Update active
        await updateDoc(doc(db, `users/${auth.currentUser.uid}/currentGrind`, 'active'), {
            killCount: newCount
        });

        // Update history
        await updateDoc(doc(db, `users/${auth.currentUser.uid}/grinds`, grind.id), {
            killCount: newCount
        });
    };

    const finishGrind = async (gotGreatOne: boolean) => {
        if (!grind || !auth.currentUser) return;

        if (gotGreatOne) {
            const confirm = window.confirm("Congratulations! Finish this session?");
            if (!confirm) return;
        }

        await updateDoc(doc(db, `users/${auth.currentUser.uid}/grinds`, grind.id), {
            endDate: new Date().toISOString(),
            gotGreatOne
        });

        await deleteDoc(doc(db, `users/${auth.currentUser.uid}/currentGrind`, 'active'));
    };

    if (loading) return <div className="text-white">Loading...</div>;
    if (!grind) return null;

    return (
        <div className="h-screen w-screen bg-gray-900/90 border-2 border-gray-600 rounded-lg flex flex-col overflow-hidden drag-region">
            {/* Header */}
            <div className="bg-gray-800 p-2 flex justify-between items-center no-drag">
                <span className="text-gray-300 font-bold text-sm truncate">{grind.animalName}</span>
                <button onClick={() => finishGrind(false)} className="text-red-400 hover:text-red-300">
                    <X size={16} />
                </button>
            </div>

            {/* Counter */}
            <div
                className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors no-drag"
                onClick={increment}
            >
                <span className="text-6xl font-bold text-white select-none">{grind.killCount}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Plus size={12} /> CLICK TO ADD
                </span>
            </div>

            {/* Footer */}
            <button
                onClick={() => finishGrind(true)}
                className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-2 flex items-center justify-center gap-2 no-drag"
            >
                <Trophy size={14} /> CAPTURED GO!
            </button>
        </div>
    );
};
