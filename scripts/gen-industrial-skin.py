#!/usr/bin/env python3
"""Generates industrial-skin.css: the Rokadex management app's "Industrial" look (direction B) applied to Studio.
Colours are the management app's tokens (themes.js SKIN + industrial preset, build 6d15bf29f1). Every rule in style.css and
rokadex-theme.css that sets a colour is repeated under :root[data-skin="industrial"] with the colour mapped by role
(surface / line / text / accent / status). Paper outputs (drawings, PDFs, SVG sheets) keep their own white colours.
Run: python3 scripts/gen-industrial-skin.py  (re-run after editing the light CSS)."""
import re,colorsys,pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
T=dict(bg='#141518',panel='#1D1F24',panel2='#25282E',line='#33363D',line2='#41454D',fg='#EFE9E4',muted='#B3A79E',faint='#8E847C',
       nav='#101114',nav2='#0C0D0F',accent='#B34A12',glow='#FF8036',hi='#FFB38A',acc='#C85A1E',tint='#3A2418',ok='#5FD98A',warn='#F2B134',err='#FF8273',info='#9FB1FF')
def rgb(h):
  h=h.lstrip('#');h=''.join(c*2 for c in h) if len(h)==3 else h;return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def lum(h):
  return sum(w*((v/12.92) if v<=0.03928 else ((v+0.055)/1.055)**2.4) for w,v in zip((0.2126,0.7152,0.0722),rgb(h)))
def role(h,prop):
  r,g,b=rgb(h);hh,l,s=colorsys.rgb_to_hls(r,g,b);hue=hh*360;L=lum(h)
  bgish=prop.startswith('background') or prop in('fill','--panel','--bg')
  border=prop.startswith('border') or prop.startswith('outline') or prop in('stroke','box-shadow')
  if s>0.25 and 150<=hue<=200 and 0.22<l<0.9:       # Studio teal / green accent -> Rokadex amber
    if bgish: return T['tint'] if L>0.5 else (T['accent'] if L>0.08 else T['nav'])
    return T['glow'] if not border else T['accent']
  if s>0.35 and (hue<45 or hue>330):               # reds / oranges (errors, warnings) keep their meaning
    if bgish and L>0.6: return '#44231F' if hue>330 or hue<15 else '#3A2E17'
    if not bgish and L<0.25: return T['err'] if hue>330 or hue<15 else T['warn']
    return None
  if s>0.3 and 45<=hue<70:                          # yellows / browns used for notes
    if bgish and L>0.6: return '#3A2E17'
    return T['warn'] if not bgish else None
  if s>0.3 and 200<hue<=260 and l>0.3:                     # blues (info)
    if bgish and L>0.6: return '#262C45'
    if not bgish and L>0.45: return '#CFC6BE'
    return T['info'] if not bgish else None
  # neutrals and navy
  if bgish:
    if L>0.9: return T['panel']
    if L>0.6: return T['panel2']
    if L>0.2: return T['line2']
    return T['nav']
  if border: return T['line'] if L>0.5 else T['line2']
  if L<0.08: return T['fg']
  if L<0.35: return T['muted']
  if L>0.85: return T['fg']
  return T['faint']
HEX=re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')
COLOR_PROPS=re.compile(r'^(color|background(-color)?|background-image|border(-[a-z-]+)?|outline(-color)?|fill|stroke|box-shadow|caret-color|accent-color|text-decoration-color)$')
def rules(css):
  css=re.sub(r'/\*.*?\*/','',css,flags=re.S);out=[];stack=[];i=0;buf=''
  # simple parser: handles @media nesting one level
  for m in re.finditer(r'([^{}]*)\{|\}',css):
    pass
  pos=0;media=None
  while pos<len(css):
    o=css.find('{',pos);c=css.find('}',pos)
    if o==-1 and c==-1:break
    if o!=-1 and (c==-1 or o<c):
      sel=css[pos:o].strip()
      if sel.startswith('@media') or sel.startswith('@supports'):media=sel;pos=o+1;continue
      if sel.startswith('@'):
        depth=1;k=o+1
        while depth and k<len(css):depth+=css[k]=='{';depth-=css[k]=='}';k+=1
        pos=k;continue
      end=css.find('}',o);out.append((media,sel,css[o+1:end]));pos=end+1
    else:media=None;pos=c+1
  return out
SKIP=re.compile(r'(^|[\s,>+~(])(\.sheet|\.paper|\.drawing-sheet|svg|\.print|\.qr)')
def skin_rule(sel,body):
  decls=[]
  for d in body.split(';'):
    if ':' not in d:continue
    p,v=d.split(':',1);p=p.strip();v=v.strip()
    if p.startswith('--'):continue
    if not COLOR_PROPS.match(p) or not HEX.search(v):continue
    nv=HEX.sub(lambda m:role(m.group(0),p) or m.group(0),v)
    if nv!=v:decls.append(f'{p}:{nv.replace("!important","").strip()} !important' if '!important' in v else f'{p}:{nv}')
  if not decls:return None
  sels=[s.strip() for s in sel.split(',') if s.strip() and not SKIP.search(s.strip())]
  if not sels:return None
  pre=lambda s:(':root[data-skin="industrial"]'+s[5:]) if s.startswith(':root') else (':root[data-skin="industrial"] '+s if not s.startswith('html') else ':root[data-skin="industrial"]'+s[4:])
  return ','.join(pre(s) for s in sels)+'{'+';'.join(decls)+'}'
lines=[__doc__.replace('\n','\n * ').join(['/*\n * ','\n */']),
':root[data-skin="industrial"]{--navy:%(nav)s;--navy-2:#1A1B1F;--navy-ink:#CFC6BE;--navy-mute:%(faint)s;--teal:%(accent)s;--teal-2:%(acc)s;--teal-bg:%(tint)s;--bg:%(bg)s;--panel:%(panel)s;--panel-2:%(panel2)s;--line:%(line)s;--line-2:%(line2)s;--fg:%(fg)s;--muted:%(muted)s;--faint:%(faint)s;--ok:%(ok)s;--warn:%(warn)s;--err:%(err)s;--info:%(info)s;--accent:%(accent)s;--surface:%(panel2)s;--surface-raised:%(panel)s;--x-rgb:255, 128, 54;--x-glow:%(glow)s;--x-hi:%(hi)s;--x-acc:%(acc)s;color-scheme:dark}'%T]
for f in ['style.css','rokadex-theme.css']:
  lines.append(f'/* ---- from {f} ---- */')
  for media,sel,body in rules((ROOT/f).read_text()):
    r=skin_rule(sel,body)
    if r:lines.append(f'{media}{{{r}}}' if media else r)
lines.append('''/* ---- form controls, tables and buttons (browser defaults are light) ---- */
:root[data-skin="industrial"] body{background:%(bg)s;color:%(fg)s}
:root[data-skin="industrial"] input,:root[data-skin="industrial"] select,:root[data-skin="industrial"] textarea{background:%(panel2)s;color:%(fg)s;border-color:%(line2)s}
:root[data-skin="industrial"] input:focus,:root[data-skin="industrial"] select:focus,:root[data-skin="industrial"] textarea:focus{border-color:%(glow)s}
:root[data-skin="industrial"] button{background:%(panel2)s;color:%(fg)s;border-color:%(line2)s}
:root[data-skin="industrial"] button:hover:not(:disabled){background:rgba(255,128,54,.12);border-color:%(glow)s}
:root[data-skin="industrial"] button:disabled{opacity:.45}
:root[data-skin="industrial"] button.primary{background:linear-gradient(180deg,%(acc)s,%(accent)s);border-color:%(glow)s;color:#fff}
:root[data-skin="industrial"] button.danger{color:%(err)s;border-color:#6B2E28}
:root[data-skin="industrial"] .top{background:%(nav)s;border-bottom-color:%(line)s}
:root[data-skin="industrial"] .modes{background:%(nav)s;border-bottom-color:%(line)s}
:root[data-skin="industrial"] .mode{background:transparent;border-color:transparent;color:%(muted)s}
:root[data-skin="industrial"] .mode:hover:not(:disabled){background:rgba(255,128,54,.07);border-color:transparent;color:%(fg)s}
:root[data-skin="industrial"] details.group>summary{color:%(fg)s;background:%(panel2)s}
:root[data-skin="industrial"] details.group{background:%(panel)s;border-color:%(line)s}
:root[data-skin="industrial"] .mode.active,:root[data-skin="industrial"] .mode[aria-pressed="true"]{color:%(glow)s;box-shadow:inset 0 -2px 0 %(glow)s;background:rgba(255,128,54,.08)}
:root[data-skin="industrial"] th{background:%(panel2)s;color:%(muted)s;border-color:%(line)s}
:root[data-skin="industrial"] td{border-color:%(line)s}
:root[data-skin="industrial"] tr.part-selected td{background:rgba(255,128,54,.14)}
:root[data-skin="industrial"] .note,:root[data-skin="industrial"] .panel-head span{color:%(muted)s}
:root[data-skin="industrial"] .panel-head b,:root[data-skin="industrial"] .form-section h3,:root[data-skin="industrial"] .cnc-card h3{color:%(fg)s}
:root[data-skin="industrial"] .cnc-status{background:#1C3326;color:%(fg)s}
:root[data-skin="industrial"] .cnc-status[data-bad="1"]{background:#44231F;color:#FFD2CC}
:root[data-skin="industrial"] .cnc-preview,:root[data-skin="industrial"] #projectSheetPreview,:root[data-skin="industrial"] .sheet-view{background:#F7F5EF}
:root[data-skin="industrial"] dialog{background:%(panel)s;color:%(fg)s;border-color:%(line)s}
:root[data-skin="industrial"] ::selection{background:rgba(255,128,54,.35)}
:root[data-skin="industrial"] *{scrollbar-color:%(line2)s transparent}'''%T)
(ROOT/'industrial-skin.css').write_text('\n'.join(lines)+'\n')
print('rules',len(lines))
