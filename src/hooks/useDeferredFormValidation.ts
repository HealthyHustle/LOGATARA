import { useEffect, useRef } from 'react';

/**
 * Implements modern-web-guidance `validate-input-after-interaction`:
 * - Keeps aria-invalid in sync with CSS :user-invalid
 * - Dynamically adds/removes data-error ID in aria-describedby ONLY while invalid
 * - Provides a single polite live-region announcer on blur/change
 * - Includes WeakMap fallback for browsers lacking :user-invalid
 */
export function useDeferredFormValidation() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const supportsUserInvalid = typeof CSS !== 'undefined' && CSS.supports?.('selector(:user-invalid)');
    const dirtyState = new WeakMap<Element, { hasInteracted: boolean; hasBlurred: boolean }>();
    const flagged = new WeakSet<Element>();
    const announced = new WeakSet<Element>();

    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = 'visually-hidden';
    document.body.appendChild(announcer);
    let announceTimer: number | undefined;
    let announcedField: Element | null = null;

    const linkError = (el: HTMLElement, shown: boolean) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };

    const announceError = (el: HTMLInputElement) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const errNode = document.getElementById(errorId);
      if (!errNode) return;
      const label = el.labels?.[0]?.textContent?.trim();
      window.clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = window.setTimeout(() => {
        announcer.textContent = `${label ? `${label}: ` : ''}${errNode.textContent?.trim() || ''}`;
      }, 450);
    };

    const syncField = (el: EventTarget | null, announce = false) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        return;
      }
      const isInvalid = supportsUserInvalid
        ? el.matches(':user-invalid')
        : el.classList.contains('user-invalid-fallback');

      if (isInvalid) {
        if (announce && !announced.has(el) && el instanceof HTMLInputElement) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute('aria-invalid', 'true');
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
        el.setAttribute('aria-invalid', 'false');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          window.clearTimeout(announceTimer);
          announcer.textContent = '';
        }
      }
    };

    const updateFallback = (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
      if (supportsUserInvalid) return;
      const valid = input.validity.valid;
      input.classList.toggle('user-invalid-fallback', !valid);
      input.classList.toggle('user-valid-fallback', valid);
    };

    form.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!el.hasAttribute('aria-invalid')) el.setAttribute('aria-invalid', 'false');
    });

    const onBlur = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(target, state);
        if (state.hasInteracted) updateFallback(target);
      }
      syncField(target, true);
    };

    const onInput = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(target, state);
        if (state.hasBlurred) updateFallback(target);
      }
      syncField(target, false);
    };

    const onInvalid = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        dirtyState.set(target, { hasInteracted: true, hasBlurred: true });
        updateFallback(target);
        announced.add(target);
        syncField(target, false);
      }
    };

    form.addEventListener('blur', onBlur, true);
    form.addEventListener('input', onInput);
    form.addEventListener('change', onBlur, true);
    form.addEventListener('invalid', onInvalid, true);

    return () => {
      window.clearTimeout(announceTimer);
      form.removeEventListener('blur', onBlur, true);
      form.removeEventListener('input', onInput);
      form.removeEventListener('change', onBlur, true);
      form.removeEventListener('invalid', onInvalid, true);
      announcer.remove();
    };
  }, []);

  return formRef;
}
