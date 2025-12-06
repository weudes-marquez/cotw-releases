import { useState } from 'react';
import { getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { populateNeedZonesFromFirebase } from '../migrate_need_zones';

interface Props {
    show: boolean;
    onClose: () => void;
}

export function MigrationModal({ show, onClose }: Props) {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState({
        totalSpecies: 0,
        processedSpecies: 0,
        insertedZones: 0,
        errors: 0,
        currentSpecies: '',
        isComplete: false
    });

    const handleMigrate = async () => {
        setIsRunning(true);
        try {
            const firestore = getFirestore(getApp());
            await populateNeedZonesFromFirebase(firestore, setProgress);
        } catch (error) {
            console.error('Migration failed:', error);
            alert('Erro na migração: ' + (error as Error).message);
        } finally {
            setIsRunning(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-stone-900 p-6 rounded-lg border border-stone-700 max-w-md w-full">
                <h2 className="text-xl font-bold text-green-400 mb-4">
                    Migração need_zones
                </h2>

                {!isRunning && !progress.isComplete && (
                    <div>
                        <p className="text-stone-300 mb-4">
                            Isso vai copiar os dados de need_zones do Firebase para o Supabase.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleMigrate}
                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                            >
                                Iniciar Migração
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {isRunning && (
                    <div className="space-y-3">
                        <div className="text-stone-300">
                            <p>Espécies: {progress.processedSpecies} / {progress.totalSpecies}</p>
                            <p>Zonas inseridas: {progress.insertedZones}</p>
                            <p>Erros: {progress.errors}</p>
                            <p className="text-green-400 mt-2">
                                Processando: {progress.currentSpecies}
                            </p>
                        </div>
                        <div className="w-full bg-stone-700 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full transition-all"
                                style={{
                                    width: `${progress.totalSpecies ? (progress.processedSpecies / progress.totalSpecies) * 100 : 0}%`
                                }}
                            />
                        </div>
                    </div>
                )}

                {progress.isComplete && (
                    <div>
                        <p className="text-green-400 mb-4">
                            ✅ Migração concluída!
                        </p>
                        <div className="text-stone-300 mb-4">
                            <p>Zonas inseridas: {progress.insertedZones}</p>
                            <p>Erros: {progress.errors}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                            Fechar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
