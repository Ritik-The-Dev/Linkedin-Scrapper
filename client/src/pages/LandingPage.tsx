import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ButtonLink } from '../components/common/Button.tsx';
import { Reveal } from '../components/common/Reveal.tsx';
import {
  ArrowRightIcon,
  BoltIcon,
  BriefcaseIcon,
  CapIcon,
  CheckIcon,
  DatabaseIcon,
  LayersIcon,
  RefreshIcon,
  SearchIcon,
  SparkIcon,
  StarIcon,
  UploadIcon,
} from '../components/common/icons.tsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts';
import { normalizeLinkedInInput } from '../utils/linkedin.ts';

/**
 * The landing page.
 *
 * Everything here is presentation: no API call is made from this route. The hero
 * field simply carries what was typed over to the dashboard, which is where the
 * username is normalised and the request is actually sent.
 */
export function LandingPage() {
  useDocumentTitle(null);

  return (
    <div>
      <Hero />
      <HowItWorks />
      <WhatYouGet />
      <BulkImport />
      <ClosingCta />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

function Hero() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  const parsed = normalizeLinkedInInput(value);
  const preview = parsed.ok ? parsed.username : null;

  // The landing page never calls the API. It hands the raw text to the
  // dashboard, which prefills its own field and takes it from there.
  const start = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const typed = value.trim();
      navigate(typed.length > 0 ? `/dashboard?u=${encodeURIComponent(typed)}` : '/dashboard');
    },
    [navigate, value],
  );

  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="mesh absolute inset-0" aria-hidden="true" />
      <BackdropMotion />
      <CursorGlow />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-3 py-1 font-mono text-2xs uppercase tracking-[0.16em] text-brand-700 backdrop-blur">
            <SparkIcon className="size-3" />
            LinkedIn lead extraction
          </p>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.08] sm:text-5xl lg:text-[3.5rem]">
            Turn a LinkedIn profile link into a structured, stored lead.
          </h1>
        </Reveal>

        <Reveal delay={120}>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-ink-soft sm:text-[1.0625rem]">
            Paste a profile URL. The username is pulled out of it, the backend checks what it has
            already stored, and only fetches from LinkedIn when the profile is genuinely new. Every
            lead stays searchable, and can be refreshed whenever you want newer data.
          </p>
        </Reveal>

        <Reveal delay={180}>
          <form onSubmit={start} className="mt-8 max-w-2xl" noValidate>
            <label htmlFor="landing-profile" className="sr-only">
              LinkedIn profile URL or username
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="landing-profile"
                  name="profile"
                  type="text"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="linkedin.com/in/ritik-joshi-sde"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-describedby="landing-profile-help"
                  className="h-12 w-full rounded-xl border border-line-strong bg-white/95 pl-11 pr-4 text-sm
                             text-ink shadow-card backdrop-blur placeholder:text-ink-faint
                             focus:border-brand-400 focus:outline-none focus-visible:ring-2
                             focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                />
              </div>

              {/* Primary call to action. The sweep runs on hover only. */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="group overflow-hidden sm:w-40"
                iconRight={
                  <ArrowRightIcon className="motion-translate size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                }
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-white/20 opacity-0
                             group-hover:animate-sheen group-hover:opacity-100"
                />
                Get Started
              </Button>
            </div>

            <p id="landing-profile-help" className="mt-2.5 text-[0.8125rem] text-ink-muted">
              {preview !== null ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  We will look up
                  <span className="slug-chip">{preview}</span>
                </span>
              ) : (
                'Optional — you can also go straight to the dashboard and paste it there.'
              )}
            </p>
          </form>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-ink-muted">
            <ButtonLink to="/leads" size="sm" iconLeft={<DatabaseIcon className="size-3.5" />}>
              Browse stored leads
            </ButtonLink>
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-ok-500" />
              Stored profiles never re-fetch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-ok-500" />
              Bulk import from Excel
            </span>
          </div>
        </Reveal>

        <Reveal delay={300} className="mt-12">
          <NormalisationCard typed={value} preview={preview} />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The one idea worth showing rather than describing: a URL goes in, a username
 * comes out, and that is what reaches the API.
 */
function NormalisationCard({ typed, preview }: { typed: string; preview: string | null }) {
  const shown = typed.trim().length > 0 ? typed.trim() : 'https://www.linkedin.com/in/ritik-joshi-sde/';
  const username = preview ?? 'ritik-joshi-sde';

  return (
    <div className="max-w-3xl overflow-hidden rounded-2xl border border-line bg-white/90 shadow-lift backdrop-blur">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2 rounded-full bg-line-strong" aria-hidden="true" />
        <span className="font-mono text-2xs uppercase tracking-[0.16em] text-ink-faint">
          In the browser, before any request
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-5 sm:p-5">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-faint">You paste</p>
          <p className="mt-2 break-all font-mono text-[0.8125rem] text-ink-soft">
            {shown}
            <span className="animate-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-brand-500 align-middle" />
          </p>
        </div>

        <ArrowRightIcon
          className="hidden size-5 shrink-0 text-brand-400 sm:block"
          aria-hidden="true"
        />

        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-faint">
            The API receives
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 font-mono text-2xs text-brand-800">
            {`{ "username": "${username}" }`}
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * How it works
 * ------------------------------------------------------------------ */

const STEPS: ReadonlyArray<{ title: string; body: string; icon: ReactNode }> = [
  {
    title: 'Paste a profile link',
    body: 'A full URL, a /in/ path or the bare username all work. The username is extracted here, in the browser, so the request that leaves is already clean.',
    icon: <SearchIcon className="size-4" />,
  },
  {
    title: 'Storage is checked first',
    body: 'If the profile has been seen before it comes straight back from the database, and the response says so. LinkedIn is not contacted at all.',
    icon: <DatabaseIcon className="size-4" />,
  },
  {
    title: 'New profiles get fetched once',
    body: 'Only a genuinely unknown username triggers an extraction. The parsed profile is stored, so the second lookup is instant.',
    icon: <BoltIcon className="size-4" />,
  },
  {
    title: 'Refresh when it matters',
    body: 'A stored lead can be refreshed on demand. Until you ask, the saved copy is what you see — no background re-fetching.',
    icon: <RefreshIcon className="size-4" />,
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          id="how-heading"
          title="Fetch once, store it, reuse it"
          blurb="The point of the product is not scraping — it is not scraping twice."
        />
      </Reveal>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          // Reveal sits inside the list item so the list keeps only <li> children.
          <li key={step.title} className="flex">
            <Reveal delay={index * 70} className="flex w-full">
              <div className="motion-translate group flex w-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-200 group-hover:bg-brand-100">
                    {step.icon}
                  </span>
                  <span className="font-mono text-2xs text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-[0.9375rem]">{step.title}</h3>
                <p className="mt-2 text-pretty text-[0.8125rem] leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * What you get
 * ------------------------------------------------------------------ */

const FIELDS: ReadonlyArray<{ label: string; icon: ReactNode; detail: string }> = [
  { label: 'Identity & headline', icon: <StarIcon className="size-3.5" />, detail: 'name, headline, location, industry' },
  { label: 'Experience', icon: <BriefcaseIcon className="size-3.5" />, detail: 'roles, companies, dates, descriptions' },
  { label: 'Education', icon: <CapIcon className="size-3.5" />, detail: 'schools, degrees, fields of study' },
  { label: 'Skills & projects', icon: <LayersIcon className="size-3.5" />, detail: 'endorsed skills, projects, publications' },
];

function WhatYouGet() {
  return (
    <section
      aria-labelledby="fields-heading"
      className="border-y border-line bg-white/70"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <SectionHeading
              eyebrow="What you get"
              id="fields-heading"
              title="The whole profile, not just a name"
              blurb="Whatever the backend managed to parse is shown, and nothing is invented. Sections with no data are hidden rather than padded with empty rows, and a flag LinkedIn did not return is shown as unknown — never as a no."
            />

            <ul className="mt-7 flex flex-col gap-2.5">
              {FIELDS.map((field) => (
                <li key={field.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    {field.icon}
                  </span>
                  <p className="text-[0.875rem] text-ink">
                    {field.label}
                    <span className="text-ink-muted"> — {field.detail}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100} className="flex">
            <div className="motion-translate w-full self-center rounded-2xl border border-line bg-white p-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-ink-faint">
                <DatabaseIcon className="size-3.5" />
                Stored lead
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-600 font-display text-sm font-semibold text-white">
                  VG
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">Ritik Joshi</p>
                  <p className="slug truncate">/in/ritik-joshi-sde</p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-2xs">
                <MetaPair term="Source" detail="database" />
                <MetaPair term="Refreshes" detail="2" />
                <MetaPair term="Experience" detail="4 roles" />
                <MetaPair term="Skills" detail="27" />
              </dl>

              <p className="mt-4 rounded-lg border border-cache-100 bg-cache-50/60 px-3 py-2 text-2xs text-cache-700">
                Served from storage — LinkedIn was not contacted for this lookup.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MetaPair({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="text-ink-faint">{term}</dt>
      <dd className="mt-0.5 font-mono text-ink-soft">{detail}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bulk import
 * ------------------------------------------------------------------ */

function BulkImport() {
  return (
    <section aria-labelledby="import-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14">
        <Reveal>
          <SectionHeading
            eyebrow="Bulk"
            id="import-heading"
            title="Fifty leads from one spreadsheet"
            blurb="One column named username, one row per profile. The import comes back row by row: what was newly extracted, what was already stored, and what failed — with the reason. Failed rows are listed, never quietly dropped."
          />
          <div className="mt-7 flex flex-wrap gap-2">
            <ButtonLink
              to="/dashboard#import"
              variant="primary"
              iconLeft={<UploadIcon className="size-4" />}
            >
              Try an import
            </ButtonLink>
            <ButtonLink to="/dashboard">Extract a single profile</ButtonLink>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full text-left text-[0.8125rem]">
              <caption className="sr-only">Example of an import result</caption>
              <thead>
                <tr className="border-b border-line bg-page/70 text-2xs uppercase tracking-[0.08em] text-ink-faint">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Username
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-2xs">
                <ExampleRow username="ritik-joshi-sde" status="New" tone="ok" />
                <ExampleRow username="ritikjoshi" status="Existing" tone="cache" />
                <ExampleRow username="aarav-mehta-dev" status="New" tone="ok" />
                <ExampleRow username="not-a-real-user" status="Failed" tone="bad" />
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const ROW_TONES = {
  ok: 'border-ok-100 bg-ok-50 text-ok-700',
  cache: 'border-cache-100 bg-cache-50 text-cache-700',
  bad: 'border-bad-100 bg-bad-50 text-bad-700',
} as const;

function ExampleRow({
  username,
  status,
  tone,
}: {
  username: string;
  status: string;
  tone: keyof typeof ROW_TONES;
}) {
  return (
    <tr className="border-b border-line/70 last:border-0">
      <td className="px-4 py-2.5 text-brand-700">{username}</td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-2xs font-medium ${ROW_TONES[tone]}`}
        >
          {status}
        </span>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Closing CTA
 * ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <section aria-labelledby="cta-heading" className="border-t border-line bg-white/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-brand-50/60 px-6 py-12 text-center sm:px-10">
            <div
              aria-hidden="true"
              className="animate-drift absolute -right-16 -top-24 size-72 rounded-full bg-brand-200/40 blur-3xl"
            />
            <div className="relative">
              <h2 id="cta-heading" className="text-2xl sm:text-3xl">
                Ready to extract your first lead?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-ink-soft">
                Paste a profile URL on the dashboard. If it is already stored you will have it
                immediately; if not, it is fetched once and kept.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <ButtonLink
                  to="/dashboard"
                  variant="primary"
                  size="lg"
                  className="group"
                  iconRight={
                    <ArrowRightIcon className="motion-translate size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  }
                >
                  Get Started
                </ButtonLink>
                <ButtonLink to="/leads" size="lg">
                  Browse stored leads
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

interface SectionHeadingProps {
  eyebrow: string;
  id: string;
  title: string;
  blurb: string;
}

function SectionHeading({ eyebrow, id, title, blurb }: SectionHeadingProps) {
  return (
    <div className="max-w-xl">
      <p className="font-mono text-2xs uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-2xl sm:text-[1.875rem]">
        {title}
      </h2>
      <p className="mt-3 text-pretty text-sm leading-relaxed text-ink-muted">{blurb}</p>
    </div>
  );
}

/**
 * Two very slow, very soft blobs behind the hero.
 *
 * Both are blurred and low-contrast, and the global reduced-motion rule stops
 * the drift outright, leaving a static gradient.
 */
function BackdropMotion() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="animate-drift absolute -left-24 top-1/3 size-[26rem] rounded-full bg-brand-200/25 blur-3xl" />
      <div
        className="animate-drift absolute -right-20 -top-16 size-[22rem] rounded-full bg-cache-100/50 blur-3xl"
        style={{ animationDelay: '-8s' }}
      />
    </div>
  );
}

/**
 * A soft glow that follows the pointer across the hero.
 *
 * Coordinates are written straight to the element's transform inside a single
 * animation frame, so nothing re-renders while the mouse moves. Skipped entirely
 * for reduced-motion and for devices without a hovering pointer.
 */
function CursorGlow() {
  const reduced = usePrefersReducedMotion();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);
  const point = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (reduced) return;
    if (typeof window.matchMedia === 'function' && !window.matchMedia('(hover: hover)').matches) {
      return;
    }

    const paint = (): void => {
      frame.current = null;
      const shell = shellRef.current;
      const glow = glowRef.current;
      const next = point.current;
      if (shell === null || glow === null || next === null) return;

      const box = shell.getBoundingClientRect();
      const x = next.x - box.left;
      const y = next.y - box.top;
      const inside = x >= 0 && y >= 0 && x <= box.width && y <= box.height;

      glow.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      glow.style.opacity = inside ? '1' : '0';
    };

    const onMove = (event: PointerEvent): void => {
      point.current = { x: event.clientX, y: event.clientY };
      if (frame.current === null) frame.current = window.requestAnimationFrame(paint);
    };

    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div ref={shellRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={glowRef}
        className="absolute -left-40 -top-40 size-80 rounded-full opacity-0 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(closest-side, rgba(10, 91, 211, 0.14), rgba(10, 91, 211, 0) 70%)',
        }}
      />
    </div>
  );
}
