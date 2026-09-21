import type { Metadata } from 'next';
import CoursesList from '@/components/CoursesList';

export const metadata: Metadata = {
  title: 'Ma liste de courses',
  description: 'Vos courses regroupées par rayon, à partir de vos recettes et de votre planning.',
  alternates: { canonical: '/courses' },
  // Liste personnelle, enregistrée sur l'appareil : sans intérêt pour la recherche
  robots: { index: false, follow: true },
};

export default function CoursesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <CoursesList />
    </main>
  );
}
