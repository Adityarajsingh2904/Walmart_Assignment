import React, { useEffect, useState } from 'react';
import { Button } from 'shadcn/ui';
import { Sun, Moon } from 'lucide-react';

export default function DarkModeToggle(): JSX.Element {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tv-darkmode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored === 'light' ? false : prefersDark;
    document.documentElement.classList.toggle('dark', dark);
    setIsDark(dark);
  }, []);

  const toggle = () => {
    const newDark = !isDark;
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('tv-darkmode', newDark ? 'dark' : 'light');
    setIsDark(newDark);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Enable light mode' : 'Enable dark mode'}
      className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
  );
}

