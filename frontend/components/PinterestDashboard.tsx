'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from './Toast';

interface QueueTask {
  id: string;
  recetteId: number;
  recetteTitle?: string | null;
  recetteSlug?: string | null;
  pinIndex: number;
  scheduledTime: string;
  isReady: boolean;
  minutesUntilReady: number;
  boardId: string;
  source?: string | null;
  strategyScore?: number | null;
}

interface QueueStatus {
  total: number;
  ready: number;
  tasks: QueueTask[];
}

interface PinterestStats {
  totalPins: number;
  pinsToday: number;
  pinsThisWeek: number;
  queueSize: number;
  readyTasks: number;
}

interface Board {
  id: string;
  name: string;
  description?: string;
}

export default function PinterestDashboard() {
  const [loading, setLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [stats, setStats] = useState<PinterestStats | null>(null);
  const [processing, setProcessing] = useState(false);
  const [planningStock, setPlanningStock] = useState(false);
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [stockDays, setStockDays] = useState(30);
  const [stockPinsPerDay, setStockPinsPerDay] = useState(3);
  const [includeAlreadyPinned, setIncludeAlreadyPinned] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsMap, setBoardsMap] = useState<Record<string, string>>({});

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      // Récupérer les boards pour le mapping ID -> nom
      try {
        const boardsResponse = await axios.get('/api/pinterest/admin/boards');
        const boardsData = boardsResponse.data.boards || [];
        setBoards(boardsData);
        
        // Créer un mapping ID -> nom
        const mapping: Record<string, string> = {};
        boardsData.forEach((board: Board) => {
          mapping[board.id] = board.name;
        });
        setBoardsMap(mapping);
      } catch (error) {
        console.warn('Impossible de récupérer les boards:', error);
        // Continuer même si les boards ne peuvent pas être récupérés
      }

      // Récupérer l'état de la queue
      const queueResponse = await axios.get('/api/pinterest/queue-status');
      setQueueStatus(queueResponse.data);
      const taskIds = new Set<string>((queueResponse.data.tasks || []).map((task: QueueTask) => task.id));
      setSelectedTaskIds((previous) => new Set([...previous].filter((taskId) => taskIds.has(taskId))));

      // TODO: Récupérer les statistiques depuis un endpoint dédié
      // Pour l'instant, on calcule depuis la queue
      const queueData = queueResponse.data;
      setStats({
        totalPins: 0, // À implémenter
        pinsToday: 0, // À implémenter
        pinsThisWeek: 0, // À implémenter
        queueSize: queueData.total,
        readyTasks: queueData.ready,
      });
    } catch (error) {
      console.error('Erreur lors du chargement du dashboard:', error);
      toast.error('Erreur lors du chargement du dashboard Pinterest');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const response = await axios.post('/api/pinterest/process-queue');
      toast.success(response.data.message || 'Queue traitée avec succès');
      // Rafraîchir le dashboard
      await fetchDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du traitement de la queue');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette publication Pinterest ?')) {
      return;
    }

    try {
      await axios.delete(`/api/pinterest/queue/${taskId}`);
      toast.success('Publication annulée avec succès');
      // Rafraîchir le dashboard
      await fetchDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Erreur lors de l\'annulation');
    }
  };

  const handleToggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleToggleAllTasks = () => {
    const tasks = queueStatus?.tasks || [];
    if (tasks.length === 0) return;

    const allSelected = tasks.every((task) => selectedTaskIds.has(task.id));
    setSelectedTaskIds(allSelected ? new Set() : new Set(tasks.map((task) => task.id)));
  };

  const handleCancelSelectedTasks = async () => {
    const taskIds = [...selectedTaskIds];
    if (taskIds.length === 0) return;

    if (!confirm(`Annuler ${taskIds.length} publication(s) Pinterest sélectionnée(s) ?`)) {
      return;
    }

    setBulkCancelling(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const taskId of taskIds) {
        try {
          await axios.delete(`/api/pinterest/queue/${taskId}`);
          successCount += 1;
        } catch {
          errorCount += 1;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} publication(s) annulée(s)`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} annulation(s) en erreur`);
      }

      setSelectedTaskIds(new Set());
      await fetchDashboard();
    } finally {
      setBulkCancelling(false);
    }
  };

  const handlePlanStockStrategy = async () => {
    setPlanningStock(true);
    try {
      const response = await axios.post('/api/pinterest/strategy/stock', {
        days: stockDays,
        pinsPerDay: stockPinsPerDay,
        includeAlreadyPinned,
        minDaysBetweenPins: 14,
      });

      const plannedCount = response.data?.plannedCount || 0;
      const skipped = response.data?.skipped || {};
      const skippedCount = Object.values(skipped).reduce(
        (total: number, value: any) => total + Number(value || 0),
        0
      );

      toast.success(`${plannedCount} publication(s) ajoutée(s), ${skippedCount} ignorée(s)`);
      await fetchDashboard();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.error ||
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          'Erreur lors de la planification du stock Pinterest'
      );
    } finally {
      setPlanningStock(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !queueStatus) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">📊 Dashboard Pinterest</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            🔄 Rafraîchir
          </button>
          {queueStatus && queueStatus.ready > 0 && (
            <button
              onClick={handleProcessQueue}
              disabled={processing}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {processing ? '⏳ Traitement...' : `▶️ Traiter ${queueStatus.ready} tâche(s)`}
            </button>
          )}
        </div>
      </div>

      {/* Statistiques rapides */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <div className="text-sm text-red-600 font-medium">Queue</div>
            <div className="text-2xl font-bold text-red-700">{stats.queueSize}</div>
            <div className="text-xs text-red-500 mt-1">{stats.readyTasks} prête(s)</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="text-sm text-blue-600 font-medium">Aujourd'hui</div>
            <div className="text-2xl font-bold text-blue-700">{stats.pinsToday}</div>
            <div className="text-xs text-blue-500 mt-1">pins créés</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="text-sm text-green-600 font-medium">Cette semaine</div>
            <div className="text-2xl font-bold text-green-700">{stats.pinsThisWeek}</div>
            <div className="text-xs text-green-500 mt-1">pins créés</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <div className="text-sm text-purple-600 font-medium">Total</div>
            <div className="text-2xl font-bold text-purple-700">{stats.totalPins}</div>
            <div className="text-xs text-purple-500 mt-1">pins créés</div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-orange-100 bg-orange-50 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Stratégie stock existant</h3>
            <p className="mt-1 text-sm text-gray-600">
              Remplit la queue avec les recettes publiées les mieux scorées, en évitant les doublons récents.
            </p>
          </div>
          <button
            onClick={handlePlanStockStrategy}
            disabled={planningStock}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {planningStock ? 'Planification...' : 'Alimenter la queue'}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Jours
            <input
              type="number"
              min={1}
              max={90}
              value={stockDays}
              onChange={(event) => setStockDays(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Pins / jour
            <input
              type="number"
              min={1}
              max={5}
              value={stockPinsPerDay}
              onChange={(event) => setStockPinsPerDay(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={includeAlreadyPinned}
              onChange={(event) => setIncludeAlreadyPinned(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-600"
            />
            Inclure les recettes déjà épinglées
          </label>
        </div>
      </div>

      {/* Queue des pins planifiés */}
      {queueStatus && queueStatus.tasks.length > 0 ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            📋 Queue des pins planifiés ({queueStatus.total} tâche(s))
          </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                {selectedTaskIds.size} sélectionnée(s)
              </span>
              <button
                type="button"
                onClick={handleToggleAllTasks}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                {queueStatus.tasks.every((task) => selectedTaskIds.has(task.id))
                  ? 'Tout désélectionner'
                  : 'Tout sélectionner'}
              </button>
              <button
                type="button"
                onClick={handleCancelSelectedTasks}
                disabled={selectedTaskIds.size === 0 || bulkCancelling}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {bulkCancelling ? 'Annulation...' : 'Annuler la sélection'}
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queueStatus.tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border ${
                  task.isReady
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <label className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.has(task.id)}
                      onChange={() => handleToggleTaskSelection(task.id)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600"
                      aria-label={`Sélectionner ${task.recetteTitle || `recette ${task.recetteId}`}`}
                    />
                  </label>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">
                        Pin #{task.pinIndex} - {task.recetteTitle || `Recette #${task.recetteId}`}
                      </span>
                      {task.isReady ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                          PRÊTE
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-400 text-white rounded-full">
                          En attente
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>📅 {new Date(task.scheduledTime).toLocaleString('fr-FR')}</div>
                      <div>
                        📌 Board: {boardsMap[task.boardId] || task.boardId}
                        {boardsMap[task.boardId] && (
                          <span className="text-xs text-gray-400 ml-2">({task.boardId})</span>
                        )}
                      </div>
                      {!task.isReady && (
                        <div>
                          ⏱️ Dans {task.minutesUntilReady > 0 
                            ? `${Math.abs(task.minutesUntilReady)} min`
                            : `${Math.abs(Math.round(task.minutesUntilReady / 60))} h`}
                        </div>
                      )}
                      {task.source === 'stock-strategy' && (
                        <div>
                          Strategie stock
                          {typeof task.strategyScore === 'number' && (
                            <span className="ml-1 text-xs text-gray-400">score {task.strategyScore}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelTask(task.id)}
                    className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm hover:shadow-md"
                    title="Annuler cette publication Pinterest"
                  >
                    ❌ Annuler
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>📭 Aucune tâche en attente dans la queue</p>
        </div>
      )}
    </div>
  );
}
