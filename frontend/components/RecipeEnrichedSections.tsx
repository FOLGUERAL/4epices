import type { SeoEnrichi } from '@/lib/seo';

interface RecipeEnrichedSectionsProps {
  seoEnrichi: SeoEnrichi;
}

function TextSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="prose max-w-none text-gray-700 whitespace-pre-line">{body}</div>
    </section>
  );
}

export default function RecipeEnrichedSections({ seoEnrichi }: RecipeEnrichedSectionsProps) {
  const faq = seoEnrichi.faq?.filter((item) => item.question && item.answer) ?? [];

  return (
    <div className="recipe-enriched-sections">
      {seoEnrichi.conseils && <TextSection title="Conseils du chef" body={seoEnrichi.conseils} />}
      {seoEnrichi.variantes && <TextSection title="Variantes" body={seoEnrichi.variantes} />}
      {seoEnrichi.conservation && (
        <TextSection title="Conservation" body={seoEnrichi.conservation} />
      )}

      {faq.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map((item, index) => (
              <details
                key={index}
                className="group rounded-lg border border-gray-200 bg-gray-50 open:bg-white"
              >
                <summary className="cursor-pointer list-none px-4 py-3 font-medium text-gray-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-2">
                    {item.question}
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </span>
                </summary>
                <div className="px-4 pb-4 text-gray-700 whitespace-pre-line border-t border-gray-100 pt-3">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
