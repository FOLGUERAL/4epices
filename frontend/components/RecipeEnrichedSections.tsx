'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { SeoEnrichi } from '@/lib/seo';

interface RecipeEnrichedSectionsProps {
  seoEnrichi: SeoEnrichi;
}

type SectionId = 'conseils' | 'faq' | 'variantes' | 'conservation';

interface PanelConfig {
  id: SectionId;
  title: string;
  body?: string;
  openClassName: string;
  icon: ReactNode;
}

function formatEnrichedBody(body: string): ReactNode {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return (
      <ul className="list-disc pl-5 space-y-2 text-gray-700">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    );
  }

  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length >= 2) {
    return (
      <ul className="list-disc pl-5 space-y-2 text-gray-700">
        {sentences.map((sentence, index) => (
          <li key={index}>{sentence}</li>
        ))}
      </ul>
    );
  }

  return <p className="text-gray-700 whitespace-pre-line leading-relaxed">{trimmed}</p>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ConseilsIcon() {
  return (
    <svg className="w-5 h-5 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function VariantesIcon() {
  return (
    <svg className="w-5 h-5 text-violet-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function ConservationIcon() {
  return (
    <svg className="w-5 h-5 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FaqIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AccordionPanel({
  panel,
  isOpen,
  onToggle,
  children,
}: {
  panel: PanelConfig;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `enriched-${panel.id}`;
  const contentId = `${panelId}-content`;

  return (
    <div
      id={panelId}
      className={`transition-colors duration-200 ${isOpen ? panel.openClassName : 'bg-white'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-black/[0.02] transition-colors"
      >
        <span className="flex items-center gap-3 font-semibold text-gray-900">
          {panel.icon}
          {panel.title}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div id={contentId} className="px-4 sm:px-5 pb-5 max-w-prose">
          {children}
        </div>
      )}
    </div>
  );
}

export default function RecipeEnrichedSections({ seoEnrichi }: RecipeEnrichedSectionsProps) {
  const faq = seoEnrichi.faq?.filter((item) => item.question && item.answer) ?? [];

  const panels = useMemo(() => {
    const list: PanelConfig[] = [];

    if (seoEnrichi.conseils?.trim()) {
      list.push({
        id: 'conseils',
        title: 'Conseils du chef',
        body: seoEnrichi.conseils,
        openClassName: 'bg-orange-50',
        icon: <ConseilsIcon />,
      });
    }

    if (faq.length > 0) {
      list.push({
        id: 'faq',
        title: 'Questions fréquentes',
        openClassName: 'bg-gray-50',
        icon: <FaqIcon />,
      });
    }

    if (seoEnrichi.variantes?.trim()) {
      list.push({
        id: 'variantes',
        title: 'Variantes',
        body: seoEnrichi.variantes,
        openClassName: 'bg-violet-50',
        icon: <VariantesIcon />,
      });
    }

    if (seoEnrichi.conservation?.trim()) {
      list.push({
        id: 'conservation',
        title: 'Conservation',
        body: seoEnrichi.conservation,
        openClassName: 'bg-teal-50',
        icon: <ConservationIcon />,
      });
    }

    return list;
  }, [seoEnrichi, faq.length]);

  const defaultOpen = panels[0]?.id ?? null;
  const [openSection, setOpenSection] = useState<SectionId | null>(defaultOpen);

  if (panels.length === 0) return null;

  const toggleSection = (id: SectionId) => {
    setOpenSection((current) => (current === id ? null : id));
  };

  return (
    <section className="mb-8 recipe-enriched-sections" aria-labelledby="enriched-heading">
      <h2 id="enriched-heading" className="text-2xl font-bold text-gray-900 mb-4">
        Pour aller plus loin
      </h2>

      <div className="rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100 shadow-sm">
        {panels.map((panel) => (
          <AccordionPanel
            key={panel.id}
            panel={panel}
            isOpen={openSection === panel.id}
            onToggle={() => toggleSection(panel.id)}
          >
            {panel.id === 'faq' ? (
              <div className="space-y-3">
                {faq.map((item, index) => (
                  <details
                    key={index}
                    className="group rounded-lg border border-gray-200 bg-white open:bg-white"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 font-medium text-gray-900 marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        {item.question}
                        <span className="text-gray-400 group-open:rotate-180 transition-transform shrink-0">
                          ▼
                        </span>
                      </span>
                    </summary>
                    <div className="px-4 pb-4 text-gray-700 whitespace-pre-line border-t border-gray-100 pt-3 leading-relaxed">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              panel.body && formatEnrichedBody(panel.body)
            )}
          </AccordionPanel>
        ))}
      </div>
    </section>
  );
}
