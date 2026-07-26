import { useEffect, useState } from 'react';

export function useScrolledPast(thresholdPx) {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolledPast(window.scrollY > thresholdPx);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [thresholdPx]);

  return scrolledPast;
}
