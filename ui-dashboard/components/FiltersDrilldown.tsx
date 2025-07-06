import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { DropdownMenu } from 'shadcn/ui';
import { motion, AnimatePresence } from 'framer-motion';
import useDebounce from '@/hooks/useDebounce';

export interface FilterCategory {
  name: string;
  fetchOptions: (parentSelection: string[]) => Promise<string[]>;
}

export interface FiltersDrilldownProps {
  categories: FilterCategory[];
  onFilterChange: (selected: Record<string, string>) => void;
}

export default function FiltersDrilldown({
  categories,
  onFilterChange,
}: FiltersDrilldownProps): JSX.Element {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [openState, setOpenState] = useState<Record<number, boolean>>({});

  useEffect(() => {
    onFilterChange(selected);
  }, [selected, onFilterChange]);

  const handleSelect = (idx: number, value: string) => {
    setSelected((prev) => {
      const next: Record<string, string> = { ...prev };
      next[categories[idx].name] = value;
      for (let i = idx + 1; i < categories.length; i++) {
        delete next[categories[i].name];
      }
      return next;
    });
  };

  return (
    <div className="flex items-center space-x-2">
      {categories.map((cat, idx) => {
        const parentSelection = categories
          .slice(0, idx)
          .map((c) => selected[c.name])
          .filter(Boolean);
        const joined = parentSelection.join('|');
        const debouncedKey = useDebounce(joined, 200);
        const debouncedArr = React.useMemo(
          () => (debouncedKey ? debouncedKey.split('|') : []),
          [debouncedKey]
        );
        const { data: options = [], isLoading } = useQuery(
          [cat.name, debouncedKey],
          () => cat.fetchOptions(debouncedArr),
          {
            enabled: idx === 0 || parentSelection.length === idx,
          }
        );

        const open = openState[idx] || false;

        return (
          <DropdownMenu
            key={cat.name}
            open={open}
            onOpenChange={(o: boolean) =>
              setOpenState((s) => ({ ...s, [idx]: o }))
            }
          >
            <DropdownMenu.Trigger asChild>
              <button
                className="px-3 py-1 border rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-haspopup="menu"
              >
                {selected[cat.name] || cat.name}
              </button>
            </DropdownMenu.Trigger>
            <AnimatePresence>
              {open && (
                <DropdownMenu.Content asChild align="start" forceMount>
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-md p-1 min-w-[8rem]"
                  >
                    {isLoading && (
                      <div className="px-2 py-1 text-sm text-gray-500">Loading...</div>
                    )}
                    {!isLoading && options.map((opt) => (
                      <DropdownMenu.Item
                        key={opt}
                        role="menuitem"
                        className="px-2 py-1 text-sm cursor-pointer focus:bg-gray-100 dark:focus:bg-gray-700"
                        onSelect={() => {
                          handleSelect(idx, opt);
                          setOpenState((s) => ({ ...s, [idx]: false }));
                        }}
                      >
                        {opt}
                      </DropdownMenu.Item>
                    ))}
                  </motion.div>
                </DropdownMenu.Content>
              )}
            </AnimatePresence>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
