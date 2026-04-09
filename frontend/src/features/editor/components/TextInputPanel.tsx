import { useEffect, useId, type ClipboardEvent, type KeyboardEvent } from 'react';

import { SectionCard } from '@components/ui/SectionCard';
import { useDebouncedValue } from '@hooks/useDebouncedValue';

import { useEditorState } from '../store/useEditorState';
import { sanitizePastedText } from '../utils/sanitizePastedText';

export const TextInputPanel = (): JSX.Element => {
  const textareaId = useId();
  const helperTextId = useId();
  const statsTextId = useId();

  const rawText = useEditorState((state) => state.rawText);
  const charCount = useEditorState((state) => state.charCount);
  const wordCount = useEditorState((state) => state.wordCount);
  const setRawText = useEditorState((state) => state.setRawText);
  const setDebouncedText = useEditorState((state) => state.setDebouncedText);
  const triggerManualRefresh = useEditorState((state) => state.triggerManualRefresh);

  const debouncedText = useDebouncedValue(rawText, 300);

  useEffect(() => {
    setDebouncedText(debouncedText);
  }, [debouncedText, setDebouncedText]);

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const clipboardHtml = event.clipboardData.getData('text/html');
    const clipboardText = event.clipboardData.getData('text/plain');
    const sanitized = sanitizePastedText(clipboardHtml.length > 0 ? clipboardHtml : clipboardText);

    event.preventDefault();

    const target = event.currentTarget;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const next = `${target.value.slice(0, start)}${sanitized}${target.value.slice(end)}`;
    const nextCaretPosition = start + sanitized.length;

    setRawText(next);

    window.requestAnimationFrame(() => {
      target.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const handleShortcut = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      triggerManualRefresh();
    }
  };

  return (
    <SectionCard
      title="Draft Text"
      description="Write your message here. The handwriting preview updates 300ms after you pause typing."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            id={statsTextId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-neutral-500"
          >
            {wordCount} words, {charCount} characters
          </p>

          <button
            type="button"
            onClick={triggerManualRefresh}
            className="inline-flex h-10 items-center justify-center rounded-full border border-primary-200 px-4 text-sm font-medium text-primary-700 transition hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2"
          >
            Refresh Preview
          </button>
        </div>
      }
    >
      <label htmlFor={textareaId} className="sr-only">
        Handwriting source text
      </label>

      <textarea
        id={textareaId}
        value={rawText}
        onChange={(event) => {
          setRawText(event.target.value);
        }}
        onPaste={handlePaste}
        onKeyDown={handleShortcut}
        aria-describedby={`${helperTextId} ${statsTextId}`}
        className="h-72 w-full resize-y rounded-card border border-neutral-200 bg-surface-50 p-4 text-base leading-7 text-neutral-900 shadow-inner transition placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2"
        placeholder="Type your letter, assignment, or notes here..."
      />

      <p id={helperTextId} className="mt-2 text-sm text-neutral-500">
        Paste is sanitized to plain text. Press Ctrl+Enter or use Refresh Preview for a manual render.
      </p>
    </SectionCard>
  );
};
