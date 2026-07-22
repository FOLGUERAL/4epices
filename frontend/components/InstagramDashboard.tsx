'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from './Toast';

interface InstagramTask {
  id: string;
  recetteId: number;
  recetteTitle?: string | null;
  recetteSlug?: string | null;
  imageUrl: string;
  scheduledTime: string;
  isReady: boolean;
  minutesUntilReady: number;
  source?: string | null;
  strategyScore?: number | null;
  attempts?: number;
  lastError?: string | null;
}

interface QueueStatus {
  total: number;
  ready: number;
  tasks: InstagramTask[];
}

interface InstagramStats {
  totalPosts: number;
  postsToday: number;
  postsThisWeek: number;
  queueSize: number;
  readyTasks: number;
}

interface InstagramStatus {
  connected: boolean;
  configured: boolean;
  accountId?: string | null;
  apiVersion?: string | null;
  message?: string;
}

export default function InstagramDashboard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [stats, setStats] = useState<InstagramStats | null>(null);
  const [processing, setProcessing] = useState(false);
  const [planningStock, setPlanningStock] = useState(false);
  const [stockDays, setStockDays] = useState(30);
  const [stockPostsPerDay, setStockPostsPerDay] = useState(1);
  const [includeAlreadyPosted, setIncludeAlreadyPosted] = useState(false);
  const [includeCookingBases, setIncludeCookingBases] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [statusResponse, queueResponse, statsResponse] = await Promise.all([
        axios.get('/api/instagram/status'),
        axios.get('/api/instagram/queue-status'),
        axios.get('/api/instagram/stats'),
      ]);

      const queueData = queueResponse.data;
      const statsData = statsResponse.data || {};

      setStatus(statusResponse.data);
      setQueueStatus(queueData);
      setStats({
        totalPosts: statsData.totalPosts || 0,
        postsToday: statsData.postsToday || 0,
        postsThisWeek: statsData.postsThisWeek || 0,
        queueSize: queueData.total || 0,
        readyTasks: queueData.ready || 0,
      });
    } catch (error) {
      console.error('Erreur dashboard Instagram:', error);
      toast.error('Erreur lors du chargement du dashboard Instagram');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const response = await axios.post('/api/instagram/process-queue');
      toast.success(response.data.message || 'Queue Instagram traitee');
      await fetchDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.error || error.response?.data?.error || 'Erreur Instagram');
    } finally {
      setProcessing(false);
    }
  };

  const handlePlanStockStrategy = async () => {
    setPlanningStock(true);
    try {
      const response = await axios.post('/api/instagram/strategy/stock', {
        days: stockDays,
        postsPerDay: stockPostsPerDay,
        includeAlreadyPosted,
        includeCookingBases,
        minDaysBetweenPosts: 21,
      });

      const plannedCount = response.data?.plannedCount || 0;
      const skipped = response.data?.skipped || {};
      const skippedCount = Object.values(skipped).reduce(
        (total: number, value: any) => total + Number(value || 0),
        0
      );

      toast.success(`${plannedCount} publication(s) Instagram ajoutee(s), ${skippedCount} ignoree(s)`);
      await fetchDashboard();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.error ||
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          'Erreur lors de la planification Instagram'
      );
    } finally {
      setPlanningStock(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('Annuler cette publication Instagram ?')) return;

    try {
      await axios.delete(`/api/instagram/queue/${taskId}`);
      toast.success('Publication Instagram annulee');
      await fetchDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l annulation');
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !queueStatus) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
        <div className="py-8 text-center text-sm text-gray-500">Chargement Instagram...</div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-md">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard Instagram</h2>
          <p className="mt-1 text-sm text-gray-600">Phase 1: publications Feed avec image unique.</p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
        >
          Rafraichir
        </button>
      </div>

      <div className={`mb-6 rounded-lg border p-4 text-sm ${
        status?.connected ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}>
        <div className="font-semibold">
          {status?.connected ? 'Configuration Instagram active' : 'Configuration Instagram manquante'}
        </div>
        <div className="mt-1">
          {status?.connected
            ? `Compte Instagram: ${status.accountId || 'configure'} | API ${status.apiVersion || 'v23.0'}`
            : 'Ajoutez INSTAGRAM_ACCESS_TOKEN et INSTAGRAM_USER_ID dans backend/.env puis redeployez le backend.'}
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-pink-100 bg-pink-50 p-4">
            <div className="text-sm font-medium text-pink-600">Queue</div>
            <div className="text-2xl font-bold text-pink-700">{stats.queueSize}</div>
            <div className="mt-1 text-xs text-pink-500">{stats.readyTasks} prete(s)</div>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="text-sm font-medium text-blue-600">Aujourd'hui</div>
            <div className="text-2xl font-bold text-blue-700">{stats.postsToday}</div>
            <div className="mt-1 text-xs text-blue-500">posts crees</div>
          </div>
          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
            <div className="text-sm font-medium text-green-600">Cette semaine</div>
            <div className="text-2xl font-bold text-green-700">{stats.postsThisWeek}</div>
            <div className="mt-1 text-xs text-green-500">posts crees</div>
          </div>
          <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
            <div className="text-sm font-medium text-purple-600">Total</div>
            <div className="text-2xl font-bold text-purple-700">{stats.totalPosts}</div>
            <div className="mt-1 text-xs text-purple-500">posts crees</div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-pink-100 bg-pink-50 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Strategie stock Instagram</h3>
            <p className="mt-1 text-sm text-gray-600">
              Remplit la queue avec les recettes visuelles les mieux scorees.
            </p>
          </div>
          <button
            onClick={handlePlanStockStrategy}
            disabled={planningStock || !status?.connected}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-700 disabled:opacity-50"
          >
            {planningStock ? 'Planification...' : 'Alimenter la queue'}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            Posts / jour
            <input
              type="number"
              min={1}
              max={4}
              value={stockPostsPerDay}
              onChange={(event) => setStockPostsPerDay(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-pink-100 bg-white px-3 py-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={includeAlreadyPosted}
              onChange={(event) => setIncludeAlreadyPosted(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pink-600"
            />
            Inclure les recettes deja postees
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-pink-100 bg-white px-3 py-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={includeCookingBases}
              onChange={(event) => setIncludeCookingBases(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pink-600"
            />
            Inclure les bases de cuisine
          </label>
        </div>
      </div>

      {queueStatus && queueStatus.ready > 0 && (
        <div className="mb-4">
          <button
            onClick={handleProcessQueue}
            disabled={processing || !status?.connected}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-700 disabled:opacity-50"
          >
            {processing ? 'Traitement...' : `Traiter ${queueStatus.ready} publication(s)`}
          </button>
        </div>
      )}

      {queueStatus && queueStatus.tasks.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Queue Instagram ({queueStatus.total} publication(s))
          </h3>
          {queueStatus.tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-lg border p-4 ${
                task.isReady ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-gray-900">
                    {task.recetteTitle || `Recette #${task.recetteId}`}
                  </div>
                  <div className="mt-1 space-y-1 text-sm text-gray-600">
                    <div>{new Date(task.scheduledTime).toLocaleString('fr-FR')}</div>
                    <div>{task.isReady ? 'PRETE' : `Dans ${Math.abs(task.minutesUntilReady)} min`}</div>
                    {typeof task.strategyScore === 'number' && <div>Score {task.strategyScore}</div>}
                    {task.lastError && <div className="text-red-600">{task.lastError}</div>}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelTask(task.id)}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Annuler
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-gray-500">Aucune publication Instagram en attente</div>
      )}
    </div>
  );
}
