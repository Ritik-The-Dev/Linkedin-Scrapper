import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { ButtonLink } from '../components/common/Button.tsx';
import { ArrowRightIcon } from '../components/common/icons.tsx';

export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-faint">404</p>
      <h1 className="mt-3 text-3xl">This page does not exist</h1>
      <p className="mt-3 max-w-md text-pretty text-sm text-ink-muted">
        The link may be out of date. The dashboard is the place to extract a profile, and the leads
        list holds everything already stored.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <ButtonLink
          to="/dashboard"
          variant="primary"
          iconRight={<ArrowRightIcon className="size-4" />}
        >
          Go to dashboard
        </ButtonLink>
        <ButtonLink to="/leads">Browse leads</ButtonLink>
      </div>
    </div>
  );
}
