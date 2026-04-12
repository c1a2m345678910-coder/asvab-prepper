import { LessonClient } from './LessonClient';

// Next.js 16: params and searchParams are Promises — must be awaited.
interface PageProps {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ mode?: string }>;
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { sectionId } = await params;
  const { mode } = await searchParams;
  return <LessonClient sectionId={sectionId} reviewMode={mode === 'review'} />;
}
