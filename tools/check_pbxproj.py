import re,sys
s=open(sys.argv[1]).read()
s=re.sub(r'//[^\n]*','',s); s=re.sub(r'/\*.*?\*/','',s,flags=re.S)
i=0
def ws():
    global i
    while i<len(s) and s[i].isspace(): i+=1
def val():
    global i
    ws(); c=s[i]
    if c=='{':
        i+=1; d={}
        while True:
            ws()
            if s[i]=='}': i+=1; return d
            k=val(); ws(); assert s[i]=='=',(i,s[i-40:i+40]); i+=1
            v=val(); ws(); assert s[i]==';',(i,s[i-40:i+40]); i+=1; d[k]=v
    if c=='(':
        i+=1; l=[]
        while True:
            ws()
            if s[i]==')': i+=1; return l
            l.append(val()); ws()
            if s[i]==',': i+=1
    if c=='"':
        i+=1; out=''
        while s[i]!='"':
            if s[i]=='\\': i+=1
            out+=s[i]; i+=1
        i+=1; return out
    m=re.match(r'[A-Za-z0-9_./$<>-]+',s[i:]); assert m,(i,s[i:i+40]); i+=m.end(); return m.group()
root=val()
objs=root['objects']
# referential integrity
ids=set(objs)
bad=[]
def walk(v):
    if isinstance(v,dict): [walk(x) for x in v.values()]
    elif isinstance(v,list): [walk(x) for x in v]
    elif isinstance(v,str) and re.fullmatch(r'[0-9A-F]{24}',v) and v not in ids: bad.append(v)
walk(objs)
print("objects:",len(objs),"dangling refs:",bad, "root ok:", root['rootObject'] in ids)
