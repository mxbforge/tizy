"""Audit the publishable tree and optional WGT; never prints secret contents."""
import hashlib,json,pathlib,re,sys,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
ignored={'.git','node_modules','dist','__pycache__'}
forbidden={'token.txt','auth.header','profiles.json','local-key.json','tizy-endpoint.json','vetro-port.json','country-cache.json','author-signature.xml','signature1.xml'}
patterns=[rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{40,}',rb'/'+rb'Users/[^/\s<>\x22\x27]+/',rb'\x22token\x22\s*:\s*\x22[a-f0-9]{64}\x22']
text_suffix={'.js','.cjs','.json','.md','.py','.txt','.yml','.yaml','.html','.svg','.xml','.css'}
errors=[];count=0
for p in root.rglob('*'):
 rel=p.relative_to(root)
 if any(part in ignored for part in rel.parts) or not p.is_file():continue
 count+=1
 if p.is_symlink():errors.append(str(rel)+': symlink')
 if p.name in forbidden or p.suffix.lower() in {'.pem','.pfx','.p12','.key'}:errors.append(str(rel)+': private material filename')
 if p.stat().st_size>100*1024*1024:errors.append(str(rel)+': exceeds ordinary Git file limit')
 if p.suffix.lower() in text_suffix and p.stat().st_size<5*1024*1024:
  data=p.read_bytes()
  if any(re.search(pattern,data) for pattern in patterns):errors.append(str(rel)+': possible credential or personal path')
assert (root/'app/token.js').read_text().strip()=='window.TIZY_DISTRIBUTABLE=true;'
provenance=json.loads((root/'docs/xray-provenance.json').read_text())
for item in provenance['binaries']:
 if hashlib.sha256((root/item['path']).read_bytes()).hexdigest()!=item['sha256']:errors.append(item['path']+': hash mismatch')
version=json.loads((root/'package.json').read_text())['version']
if 'version="'+version+'"' not in (root/'app/config.xml').read_text():errors.append('manifest version mismatch')
if "version:'"+version+"'" not in (root/'app/service/main.js').read_text():errors.append('service version mismatch')
for doc in root.rglob('*.md'):
 if any(x in ignored for x in doc.relative_to(root).parts):continue
 for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',doc.read_text()):
  if re.match(r'[a-z]+:|#',target):continue
  relative=target.split('#')[0]
  if relative and not (doc.parent/relative).exists():errors.append(str(doc.relative_to(root))+': broken local link '+relative)
artifact=root/'dist'/('TIZY-'+version+'-Universal.wgt')
if artifact.exists():
 with zipfile.ZipFile(artifact) as z:
  for info in z.infolist():
   if pathlib.PurePosixPath(info.filename).name in forbidden:errors.append('WGT: forbidden filename '+info.filename)
  if z.read('token.js').strip()!=b'window.TIZY_DISTRIBUTABLE=true;':errors.append('WGT: not portable')
if errors:
 for e in errors:print(e,file=sys.stderr)
 raise SystemExit(1)
print(json.dumps({'publicTreeFiles':count,'credentialsCheck':'passed','binaryHashes':'passed','relativeLinks':'passed','version':version,'wgtPresent':artifact.exists()}))
