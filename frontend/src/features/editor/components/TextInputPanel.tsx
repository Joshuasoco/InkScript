import { useEffect, useId, type ClipboardEvent, type KeyboardEvent } from 'react';

import { SectionCard } from '@components/ui/SectionCard';
import { useDebouncedValue } from '@hooks/useDebouncedValue';

import { useEditorStore } from '../store/useEditorStore';
import { sanitizePastedText } from '../utils/sanitizePastedText';

export const TextInputPanel = (): JSX.Element => {
  const textareaId = useId();
  const helperTextId = useId();

  const rawText = useEditorStore((state) => state.rawText);
  const charCount = useEditorStore((state) => state.charCount);
  const wordCount = useEditorStore((state) => state.wordCount);
  const setRawText = useEditorStore((state) => state.setRawText);
  const setDebouncedText = useEditorStore((state) => state.setDebouncedText);

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

    setRawText(next);
  };

  const handleShortcut = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      setDebouncedText(rawText);
    }
  };

  return (
    <SectionCard
      title="Draft Text"
      description="Write your message and preview natural handwriting output as you type."
      footer={
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
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
        aria-describedby={helperTextId}
        className="h-72 w-full resize-none rounded-card border border-neutral-200 bg-surface-50 p-3 text-base leading-7 text-neutral-900 shadow-inner transition focus:border-primary-500 focus:outline-none"
        placeholder="Type your letter, assignment, or notes here..."
      />

      <p id={helperTextId} className="mt-2 text-sm text-neutral-500">
        Paste is sanitized to plain text. Press Ctrl+Enter for a manual preview refresh.
      </p>
    </SectionCard>
  );
};
