'use client';

import { useState, useEffect } from 'react';
import {
  getShoppingList,
  toggleShoppingListItem,
  removeShoppingListItem,
  clearShoppingList,
  ShoppingListItem,
} from '@/lib/shoppingList';

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setItems(getShoppingList());

    // Écouter les changements de localStorage
    const handleStorageChange = () => {
      setItems(getShoppingList());
    };
    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const currentItems = getShoppingList();
      if (currentItems.length !== items.length) {
        setItems(currentItems);
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [items.length]);

  const handleToggle = (id: string) => {
    setItems(toggleShoppingListItem(id));
  };

  const handleRemove = (id: string) => {
    setItems(removeShoppingListItem(id));
  };

  const handleClear = () => {
    if (confirm('Voulez-vous vraiment vider la liste de courses ?')) {
      clearShoppingList();
      setItems([]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const checkedItems = items.filter(item => !item.checked);
    const uncheckedItems = items.filter(item => item.checked);
    
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste de courses - 4épices</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #ea580c; }
            .item { padding: 8px 0; border-bottom: 1px solid #eee; }
            .checked { text-decoration: line-through; color: #999; }
            .quantity { font-weight: bold; color: #666; }
          </style>
        </head>
        <body>
          <h1>Liste de courses - 4épices</h1>
          <h2>À acheter</h2>
          <ul>
            ${uncheckedItems.map(item => `
              <li class="item">
                ${item.quantity ? `<span class="quantity">${item.quantity}</span> ` : ''}
                ${item.ingredient}
              </li>
            `).join('')}
          </ul>
          ${checkedItems.length > 0 ? `
            <h2>Déjà acheté</h2>
            <ul>
              ${checkedItems.map(item => `
                <li class="item checked">
                  ${item.quantity ? `<span class="quantity">${item.quantity}</span> ` : ''}
                  ${item.ingredient}
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const checkedCount = items.filter(item => item.checked).length;
  const uncheckedCount = items.length - checkedCount;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-orange-600 text-white rounded-full p-4 shadow-lg hover:bg-orange-700 transition-colors relative"
        aria-label="Liste de courses"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {uncheckedCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {uncheckedCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-16 right-0 w-80 bg-white rounded-lg shadow-xl z-50 max-h-96 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Liste de courses</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Liste vide</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 ${
                        item.checked ? 'opacity-60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleToggle(item.id)}
                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className={`flex-1 ${item.checked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {item.quantity && (
                          <span className="font-semibold text-gray-700 mr-1">{item.quantity}</span>
                        )}
                        {item.ingredient}
                      </span>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        aria-label="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={handleExportPDF}
                className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                Imprimer
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Vider
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

