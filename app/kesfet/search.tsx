'use client';

import { useEffect, useId, useState } from 'react';
import { Search } from 'lucide-react';
import { categorySuggestions } from '../../lib/discovery';

export function DiscoverySearch({ initial }: { initial: string }) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<{ query: string; labels: string[] }>();
  const query = value.trim();
  const options: readonly string[] = remote?.query === query ? remote.labels :
    categorySuggestions(query).slice(0, 6).map((item) => item.label);
  const showing = open && options.length > 0;

  useEffect(() => {
    if (!open || query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/arama?' + new URLSearchParams({ q: query }), { signal: controller.signal });
        if (response.ok && !controller.signal.aborted) setRemote({ query, labels: await response.json() });
      } catch { /* Local category suggestions stay available. */ }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, open]);

  function choose(label: string) {
    setValue(label);
    setOpen(false);
    setActive(-1);
  }

  return <div className="search-main">
    <label htmlFor={id}>Ne arıyorsunuz?</label>
    <div className="search-combobox">
      <Search size={18} aria-hidden="true" />
      <input id={id} name="q" type="text" role="combobox" placeholder="Berber, kuaför, oto bakım"
        value={value} maxLength={80} autoComplete="off" aria-autocomplete="list"
        aria-expanded={showing} aria-controls={id + '-options'}
        aria-activedescendant={showing && active >= 0 && active < options.length ? id + '-' + active : undefined}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }}
        onChange={(event) => { setValue(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1); }
          if (options.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
            setActive((index) => event.key === 'ArrowDown' ? (index + 1) % options.length :
              index <= 0 ? options.length - 1 : index - 1);
          }
          if (event.key === 'Enter' && showing && options[active]) {
            event.preventDefault();
            choose(options[active]);
          }
        }} />
      <ul id={id + '-options'} role="listbox" aria-label="Arama önerileri" hidden={!showing}>
        {options.map((label, index) => <li key={label} id={id + '-' + index} role="option"
          aria-selected={active === index} onPointerDown={(event) => event.preventDefault()}
          onClick={() => choose(label)}>{label}</li>)}
      </ul>
    </div>
  </div>;
}
