import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );

export const BottomSheet = ({
  isOpen,
  title,
  onClose,
  children,
}: BottomSheetProps): JSX.Element | null => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const focusableElements = getFocusableElements(panel);
    const initialFocusTarget = focusableElements[0] ?? panel;

    initialFocusTarget.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentFocusableElements = getFocusableElements(panel);

      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = currentFocusableElements[0];
      const lastElement = currentFocusableElements[currentFocusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    panel.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      panel.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragStartYRef.current = event.clientY;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragStartYRef.current === null) {
      return;
    }

    const nextOffset = Math.max(0, event.clientY - dragStartYRef.current);
    setDragOffset(nextOffset);
  };

  const handlePointerEnd = (): void => {
    // WHY: Swipe-to-dismiss matches the mobile UX brief and gives touch users a quick escape hatch.
    if (dragOffset > 120) {
      onClose();
    }

    dragStartYRef.current = null;
    setDragOffset(0);
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/35 backdrop-blur-[2px]"
      />

      <div className="absolute inset-x-0 bottom-0 p-2">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className="max-h-[82vh] min-h-[12rem] overflow-hidden rounded-t-[1.75rem] border border-white/70 bg-white shadow-paper-lg transition-transform duration-300"
          style={{ transform: `translateY(${dragOffset}px)` }}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="flex min-h-11 touch-pan-y items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-200" aria-hidden="true" />
            <span className="sr-only">{title}</span>
          </div>

          <div className="max-h-[calc(82vh-4rem)] overflow-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
};
