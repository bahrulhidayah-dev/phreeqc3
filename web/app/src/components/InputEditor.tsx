import { Fragment, useMemo } from 'react';
import { CodeEditor } from './CodeEditor';
import { GROUPS, ALL_KEYWORDS } from '../lib/keywords';
import { pick, type Lang, type TFn } from '../lib/i18n';
import { splitBlocks } from '../lib/inputModel';
import { MANUAL_URL } from './Header';

export interface Message { kind: 'error' | 'warning'; text: string }

interface Props {
  t: TFn; lang: Lang; input: string; setInput: (s: string) => void; names: string[]; onRun: () => void;
  messages: Message[] | null; insert: { text: string; n: number } | null; onInsert: (kw: string) => void;
  jumpTo: { line: number; n: number } | null;
}

export function InputEditor({ t, lang, input, setInput, names, onRun, messages, insert, onInsert, jumpTo }: Props) {
  const blocks = useMemo(() => splitBlocks(input).filter(b => b.kw), [input]);
  const used = [...new Set(blocks.map(b => b.kw))].filter(k => k !== 'END');
  return (
    <main className="view gut">
      <div className="grid ed">
        <div className="panel kwpanel">
          <div className="panel-h"><h3>{t('e_keywords')}</h3><span className="note num">80</span></div>
          <div className="kwlist">
            {GROUPS.map(g => [
              <div className="grp" key={g.id}>{pick(g.name, lang)}</div>,
              ...g.keywords.map(k => <button key={k.name} type="button" title={k.desc} onClick={() => onInsert(k.name)}>{k.name}</button>),
            ])}
          </div>
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
          <div className="panel-h">
            <span className="note">{t('e_hint')}</span>
            <button className="btn sm primary" type="button" onClick={onRun}>▶ {t('run')}</button>
          </div>
          <div style={{ flex: 1, minHeight: 520 }}>
            <CodeEditor value={input} onChange={setInput} names={names} onRun={onRun} insert={insert} jumpTo={jumpTo} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h3>{t('e_problems')}</h3></div>
          {!messages && <p className="note" style={{ padding: '10px 14px' }}>{t('e_notrun')}</p>}
          {messages && !messages.length && <p className="note" style={{ padding: '10px 14px' }}><span className="ok">✓</span> {t('e_noproblems')}</p>}
          {messages?.slice(0, 40).map((m, i) => (
            <div className="prob" key={i}><span className={'sev ' + (m.kind === 'error' ? 'err' : 'wrn')}>{m.kind === 'error' ? t('error') : t('warning')}</span><div>{m.text}</div></div>
          ))}
          {used.length > 0 && <div className="helpcard" style={{ padding: '12px 14px', borderTop: '1px solid var(--line)' }}>
            <dl>{used.map(k => <Fragment key={k}><dt>{k}</dt><dd>{ALL_KEYWORDS.find(x => x.name === k)?.desc}</dd></Fragment>)}</dl>
            <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer" className="note">{t('doc_manual')} ↗</a>
          </div>}
        </div>
      </div>
    </main>
  );
}
