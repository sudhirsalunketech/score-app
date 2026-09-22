import { Suspense, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Feedback';

export function RouteSuspense({
  children,
  fallback,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
}) {
  return <Suspense fallback={fallback ?? <PageSkeleton />}>{children ?? <Outlet />}</Suspense>;
}
