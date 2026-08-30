import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { createOrGetLead } from '../../services/api.ts';
import { errorMessage, isCancelled } from '../../services/errors.ts';
import type { LeadSource } from '../../types/api.ts';
import type { Lead } from '../../types/lead.ts';
import { fullNameOf } from '../../utils/formatters.ts';
import { normalizeLinkedInInput } from '../../utils/linkedin.ts';
import { Button } from '../common/Button.tsx';
import { InlineNotice } from '../common/InlineNotice.tsx';
import { ArrowRightIcon, SearchIcon } from '../common/icons.tsx';

interface ExtractFormProps {
  /**
   * Handed the lead plus the backend's own `source`, unchanged — the page decides
   * what to do with it. `null` means the response did not say.
   */
  onExtracted: (lead: Lead, source: LeadSource | null) => void;
  /** Prefills the field, e.g. from the landing page's `?u=` handoff. */
  initialValue?: string;
}

interface Outcome {
  lead: Lead;
  source: LeadSource | null;
}

/**
 * The primary action: paste a profile URL, get a lead.
 *
 * The username is extracted here, in the browser, and only the bare slug is sent
 * to `POST /api/leads` — the contract does not accept a URL. The extracted value
 * is shown live above the button so it is obvious what will be submitted.
 */
export function ExtractForm({ onExtracted, initialValue = '' }: ExtractFormProps) {
  const [value, setValue] = useState(initialValue);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showInputError, setShowInputError] = useState(false);

  const inFlight = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Abort a pending LinkedIn round trip if the form unmounts mid-flight.
  useEffect(() => () => inFlight.current?.abort(), []);

  // Arriving with a value already in the field: put the cursor in it, but stop
  // short of submitting — a page load should never fire a request at LinkedIn.
  useEffect(() => {
    if (initialValue.trim().length > 0) inputRef.current?.focus();
  }, [initialValue]);

  const trimmed = value.trim();
  const parsed = normalizeLinkedInInput(value);
  const inputError = !parsed.ok && trimmed.length > 0 && showInputError ? parsed.message : null;

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const result = normalizeLinkedInInput(value);
      if (!result.ok) {
        setShowInputError(true);
        setError(null);
        setOutcome(null);
        return;
      }

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setWorking(true);
      setError(null);
      setOutcome(null);
      setShowInputError(false);

      createOrGetLead(result.username, controller.signal)
        .then((created) => {
          if (controller.signal.aborted) return;
          setOutcome({ lead: created.lead, source: created.source });
          setWorking(false);
          setValue('');
          onExtracted(created.lead, created.source);
        })
        .catch((cause: unknown) => {
          if (isCancelled(cause) || controller.signal.aborted) {
            setWorking(false);
            return;
          }
          setError(errorMessage(cause));
          setWorking(false);
        });
    },
    [onExtracted, value],
  );

  const cancel = useCallback(() => {
    inFlight.current?.abort();
    setWorking(false);
  }, []);

  return (
    <div>
      <form onSubmit={submit} noValidate>
        <label htmlFor="profile-input" className="block text-sm font-medium text-ink">
          LinkedIn profile URL or username
        </label>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="profile-input"
              ref={inputRef}
              name="profile"
              type="text"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setShowInputError(false);
                setError(null);
              }}
              onBlur={() => setShowInputError(true)}
              placeholder="https://www.linkedin.com/in/ritik-sde/"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={inputError !== null}
              aria-describedby={inputError !== null ? 'profile-input-error' : 'profile-input-help'}
              className="h-12 w-full rounded-xl border border-line-strong bg-white pl-10 pr-3 text-sm text-ink
                         placeholder:text-ink-faint focus:border-brand-400 focus:outline-none
                         focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={working}
            iconRight={working ? undefined : <ArrowRightIcon className="size-4" />}
            className="sm:w-40"
          >
            {working ? 'Extracting' : 'Extract lead'}
          </Button>
        </div>

        {inputError !== null ? (
          <p id="profile-input-error" role="alert" className="mt-2 text-[0.8125rem] text-bad-600">
            {inputError}
          </p>
        ) : (
          <p id="profile-input-help" className="mt-2 text-[0.8125rem] text-ink-muted">
            {parsed.ok && trimmed.length > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Sending
                <code className="rounded-md border border-line bg-page px-1.5 py-0.5 font-mono text-2xs text-ink">
                  {'{ "username": "'}
                  <span className="text-brand-700">{parsed.username}</span>
                  {'" }'}
                </code>
                to the API
              </span>
            ) : (
              'A full URL, a /in/ path, or the username on its own — the username is extracted here before the request is sent.'
            )}
          </p>
        )}
      </form>

      {working ? (
        <InlineNotice
          tone="info"
          title="Working on it"
          className="mt-4"
          action={
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          }
        >
          If this profile is already stored it comes straight back. If not, the backend fetches it
          from LinkedIn, which usually takes a few seconds.
        </InlineNotice>
      ) : null}

      {error !== null && !working ? (
        <InlineNotice tone="error" title="Could not extract this lead" className="mt-4" onDismiss={() => setError(null)}>
          {error}
        </InlineNotice>
      ) : null}

      {/*
        The result itself is rendered by the page, directly below this form. This
        region exists on every render so a screen reader hears the outcome — a
        live region added at the same moment as its text is often missed.
      */}
      <p aria-live="polite" className="sr-only">
        {outcome === null ? '' : statusText(outcome)}
      </p>
    </div>
  );
}

function statusText({ lead, source }: Outcome): string {
  const name = fullNameOf(lead);
  if (source === 'linkedin') return `${name} was fetched from LinkedIn and stored.`;
  if (source === 'database') return `${name} was already stored, so LinkedIn was not contacted.`;
  return `${name} is stored and ready.`;
}
