'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, ChevronDown, Plus, Printer, Share2, Trash2, X } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { getShoppingEntries } from '@/lib/planning';
import { SITE_NAME } from '@/lib/seo';
import { addPlanToShoppingList, describePlanShopping } from '@/lib/shoppingFromPlan';
import {
  addCustomItem,
  clearCheckedItems,
  clearShoppingList,
  getShoppingItems,
  getShoppingRecipes,
  removeItem,
  removeRecipeFromShoppingList,
  subscribeShoppingList,
  toggleItemChecked,
  type ShoppingItemView,
} from '@/lib/shoppingList';
import {
  capitalize,
  formatItemQuantity,
  groupItemsByAisle,
  shoppingListToText,
} from '@/lib/shoppingMerge';
import type { SwipeState } from '@/lib/swipeEngine';
import { loadSwipeState, subscribeSwipeState } from '@/lib/swipeStorage';
import { trackEvent } from '@/lib/track';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

/** Ouvre une page d'impression : à acheter par rayon, puis le placard. */
function printList(items: ShoppingItemView[]) {
  const toBuy = items.filter((item) => !item.checked);
  const groups = groupItemsByAisle(toBuy);
  const pantry = toBuy.filter((item) => item.pantry);
  const row = (item: ShoppingItemView) => {
    const quantity = item.pantry ? '' : formatItemQuantity(item);
    return `<li>${quantity ? `<b>${escapeHtml(quantity)}</b> ` : ''}${escapeHtml(capitalize(item.name))}</li>`;
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liste de courses | ${escapeHtml(SITE_NAME)}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#ea580c}h2{margin:18px 0 6px;font-size:16px}
    ul{list-style:none;padding:0;margin:0}li{padding:6px 0;border-bottom:1px solid #eee}li::before{content:'☐ ';color:#999}</style></head>
    <body><h1>Liste de courses — ${escapeHtml(SITE_NAME)}</h1>
    ${groups.map((group) => `<h2>${escapeHtml(group.label)}</h2><ul>${group.items.map(row).join('')}</ul>`).join('')}
    ${pantry.length > 0 ? `<h2>À vérifier chez vous</h2><ul>${pantry.map(row).join('')}</ul>` : ''}
    </body></html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}

interface ItemRowProps {
  item: ShoppingItemView;
  expanded: boolean;
  onToggleExpanded: () => void;
}

function ItemRow({ item, expanded, onToggleExpanded }: ItemRowProps) {
  const quantity = item.pantry ? '' : formatItemQuantity(item);
  return (
    <li>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={() => toggleItemChecked(item.key)}
          aria-pressed={item.checked}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-orange-50"
        >
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              item.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white'
            }`}
          >
            {item.checked && <Check className="h-4 w-4" />}
          </span>
          <span className={`min-w-0 flex-1 font-semibold ${item.checked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {capitalize(item.name)}
          </span>
          {quantity && (
            <span className={`flex-shrink-0 text-sm tabular-nums ${item.checked ? 'text-gray-400' : 'text-gray-600'}`}>
              {quantity}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={`Détail de ${item.name}`}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => removeItem(item.key)}
          aria-label={`Retirer ${item.name}`}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <ul className="mb-2 ml-12 space-y-1 border-l-2 border-orange-100 pl-3 text-sm text-gray-600">
          {item.lines.map((line) => (
            <li key={line.id}>
              {line.text}
              <span className="text-gray-400"> · {line.recipeTitle ?? 'ajouté à la main'}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** La page « Courses » : la liste fusionnée par rayon, avec l'origine de chaque article. */
export default function CoursesList() {
  const [items, setItems] = useState<ShoppingItemView[]>([]);
  const [recipes, setRecipes] = useState<Array<{ recipeId: number; title: string }>>([]);
  const [planState, setPlanState] = useState<SwipeState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const [planBusy, setPlanBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const reload = () => {
      setItems(getShoppingItems());
      setRecipes(getShoppingRecipes());
      setPlanState(loadSwipeState());
      setLoaded(true);
    };
    reload();
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');

    const unsubscribeList = subscribeShoppingList(reload);
    const unsubscribePlan = subscribeSwipeState(reload);
    window.addEventListener('focus', reload);
    return () => {
      unsubscribeList();
      unsubscribePlan();
      window.removeEventListener('focus', reload);
    };
  }, []);

  const { toBuy, inBasket, pantry, groups } = useMemo(() => {
    const regular = items.filter((item) => !item.pantry);
    const remaining = regular.filter((item) => !item.checked);
    return {
      toBuy: remaining,
      inBasket: regular.filter((item) => item.checked),
      pantry: items.filter((item) => item.pantry),
      groups: groupItemsByAisle(remaining),
    };
  }, [items]);

  const total = toBuy.length + inBasket.length;
  const plannedMeals = planState ? getShoppingEntries(planState).length : 0;

  const toggleExpanded = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!addCustomItem(draft)) {
      toast.info('Écrivez un article, par exemple « lait » ou « 2 yaourts »');
      return;
    }
    trackEvent('shopping-add-custom');
    setDraft('');
  };

  const handleShare = async () => {
    const checkedKeys = new Set(items.filter((item) => item.checked).map((item) => item.key));
    const text = shoppingListToText(items, checkedKeys, `Liste de courses — ${SITE_NAME}`);
    try {
      if (canShare) {
        await navigator.share({ title: 'Liste de courses', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Liste copiée : collez-la dans un message');
      }
      trackEvent('shopping-share', { shared: canShare ? 1 : 0 });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('Impossible de partager la liste');
    }
  };

  const handlePlan = async () => {
    if (!planState) return;
    setPlanBusy(true);
    try {
      const result = await addPlanToShoppingList(planState);
      if (result.status === 'done') trackEvent('plan-shopping', { recipes: result.added, from: 'courses' });
      for (const message of describePlanShopping(result)) toast[message.level](message.text);
    } catch (error) {
      console.error('Erreur lors de l\'ajout à la liste de courses:', error);
      toast.error('Impossible de récupérer les ingrédients pour le moment');
    } finally {
      setPlanBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10" aria-hidden="true">
        <div className="h-72 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    );
  }

  const planButton = plannedMeals > 0 && (
    <button
      type="button"
      onClick={handlePlan}
      disabled={planBusy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-50"
    >
      <CalendarDays className="h-5 w-5" aria-hidden="true" />
      {planBusy ? 'Ajout en cours…' : `Ajouter les repas de la semaine (${plannedMeals})`}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900">Ma liste de courses</h1>
        {total > 0 && (
          <div className="mt-3">
            <p role="status" className="text-sm tabular-nums text-gray-600">
              {inBasket.length} sur {total} dans le panier
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={inBasket.length}
              aria-label="Progression des courses"
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${(inBasket.length / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <label htmlFor="courses-add" className="sr-only">
          Ajouter un article
        </label>
        <input
          id="courses-add"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ajouter un article (lait, 2 yaourts…)"
          autoComplete="off"
          enterKeyHint="done"
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-base !text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
        <button
          type="submit"
          aria-label="Ajouter à la liste"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-orange-600 text-white transition-colors hover:bg-orange-700"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      </form>

      {recipes.length > 0 && (
        <ul aria-label="Recettes de la liste" className="mb-4 flex flex-wrap gap-2">
          {recipes.map((recipe) => (
            <li
              key={recipe.recipeId}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-orange-200 bg-white pl-4 pr-1 text-sm font-medium text-gray-800"
            >
              <span className="max-w-[12rem] truncate">{recipe.title}</span>
              <button
                type="button"
                onClick={() => removeRecipeFromShoppingList(recipe.recipeId)}
                aria-label={`Retirer ${recipe.title} de la liste`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Votre liste est vide</h2>
          <p className="mx-auto mt-2 max-w-sm text-gray-600">
            Ajoutez les ingrédients d&apos;une recette avec le bouton « Courses », ou ceux des repas de votre semaine.
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            {planButton}
            <Link
              href="/recettes"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              Parcourir les recettes
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              <Share2 className="h-5 w-5" aria-hidden="true" />
              {canShare ? 'Partager' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() => printList(items)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
            >
              <Printer className="h-5 w-5" aria-hidden="true" />
              Imprimer
            </button>
            {planButton}
          </div>

          {toBuy.length === 0 && (
            <p className="mb-5 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
              Tout est dans le panier. Bonnes courses !
            </p>
          )}

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.aisle} aria-label={group.label}>
                <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-500">
                  {group.label} <span className="tabular-nums">({group.items.length})</span>
                </h2>
                <ul className="divide-y divide-gray-100 rounded-2xl bg-white p-1 shadow-sm">
                  {group.items.map((item) => (
                    <ItemRow
                      key={item.key}
                      item={item}
                      expanded={expanded.has(item.key)}
                      onToggleExpanded={() => toggleExpanded(item.key)}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {inBasket.length > 0 && (
              <details className="rounded-2xl bg-white p-1 shadow-sm">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 font-semibold text-gray-700">
                  <span>
                    Dans le panier <span className="tabular-nums">({inBasket.length})</span>
                  </span>
                </summary>
                <ul className="divide-y divide-gray-100">
                  {inBasket.map((item) => (
                    <ItemRow
                      key={item.key}
                      item={item}
                      expanded={expanded.has(item.key)}
                      onToggleExpanded={() => toggleExpanded(item.key)}
                    />
                  ))}
                </ul>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={clearCheckedItems}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
                  >
                    Vider les articles cochés
                  </button>
                </div>
              </details>
            )}

            {pantry.length > 0 && (
              <details className="rounded-2xl bg-white p-1 shadow-sm">
                <summary className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 font-semibold text-gray-700">
                  <span>
                    Placard : à vérifier chez vous <span className="tabular-nums">({pantry.length})</span>
                  </span>
                </summary>
                <p className="px-3 pb-2 text-sm text-gray-500">Sel, poivre, eau… Cochez ce que vous avez déjà.</p>
                <ul className="divide-y divide-gray-100">
                  {pantry.map((item) => (
                    <ItemRow
                      key={item.key}
                      item={item}
                      expanded={expanded.has(item.key)}
                      onToggleExpanded={() => toggleExpanded(item.key)}
                    />
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              Vider toute la liste
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmClear}
        title="Vider la liste de courses"
        message="Êtes-vous sûr de vouloir vider toute la liste de courses ? Cette action est irréversible."
        confirmText="Vider"
        cancelText="Annuler"
        type="warning"
        onConfirm={() => {
          clearShoppingList();
          setConfirmClear(false);
          toast.success('Liste de courses vidée');
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
