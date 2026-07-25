import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Daniel's Physiotherapy Hospital` : "Daniel's Physiotherapy Hospital";
  }, [title]);
}
