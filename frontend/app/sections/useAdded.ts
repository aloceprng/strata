import { useEffect, useRef, useState } from "react";

/** Briefly true after an add, so the button can confirm it. */
export function useAdded(ms = 1600): [boolean, () => void] {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [
    added,
    () => {
      setAdded(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(false), ms);
    },
  ];
}
