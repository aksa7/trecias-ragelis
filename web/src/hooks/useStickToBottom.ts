import { useCallback, useEffect, useRef, useState } from 'react';

/** How close to the bottom (px) still counts as "following" the live feed. */
const THRESHOLD = 48;

/**
 * Chat-style scrolling: stays pinned to the newest content while it grows
 * (including lines that are still being typed), but stops following as soon
 * as the user scrolls up, and offers a way back.
 */
export function useStickToBottom<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  const [following, setFollowing] = useState(true);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setFollowing(true);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= THRESHOLD;
      pinned.current = atBottom;
      setFollowing(atBottom);
    };

    // Any size change of the content (new line, typing, wrapping) re-pins if following.
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    Array.from(el.children).forEach((child) => observer.observe(child));
    const mutations = new MutationObserver(() => {
      observer.disconnect();
      Array.from(el.children).forEach((child) => observer.observe(child));
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    mutations.observe(el, { childList: true });

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return { ref, following, scrollToBottom };
}
