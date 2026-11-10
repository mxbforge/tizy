"""Build a distributable TIZY WGT. Never embeds installation keys or TV data."""
import argparse, hashlib, json, pathlib, shutil, zipfile
root = pathlib.Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--portable', action='store_true', help='Accepted for compatibility; all builds are portable')
parser.add_argument('--out', type=pathlib.Path)
args = parser.parse_args()
app = root / 'app'
modules = root / 'deps/node_modules'
if not modules.is_dir():
    raise SystemExit('Install dependencies first: npm ci --prefix deps --ignore-scripts')
# Only pinned dependencies are copied. Generated sources are ignored by Git.
shutil.copytree(modules, app / 'service/node_modules', dirs_exist_ok=True,
    ignore=shutil.ignore_patterns('libsodium-sumo', 'libsodium-wrappers-sumo', 'qrcode-generator', '.bin', '.package-lock.json'))
vendor = app / 'service/vendor'
vendor.mkdir(exist_ok=True)
(vendor / 'libsodium-sumo.js').write_bytes((modules / 'libsodium-sumo/dist/modules-sumo/libsodium-sumo.js').read_bytes())
wrapper = (modules / 'libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js').read_text()
(vendor / 'libsodium-wrappers.js').write_bytes(wrapper.replace('require("libsodium-sumo")', 'require("./libsodium-sumo")').encode())
(app / 'qrcode.js').write_bytes((modules / 'qrcode-generator/qrcode.js').read_bytes())
for name in ['xray', 'xray-arm64']:
    if not (app / 'core' / name).is_file():
        raise SystemExit('Missing pinned core: ' + name)
version = json.loads((root / 'package.json').read_text())['version']
out = args.out or root / 'dist' / ('TIZY-' + version + '-Universal.wgt')
out.parent.mkdir(parents=True, exist_ok=True)
excluded = {'.DS_Store', 'author-signature.xml', 'signature1.xml', 'token.txt', 'auth.header', 'profiles.json', 'country-cache.json', 'tizy-endpoint.json', 'local-key.json', 'vetro-port.json'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(app.rglob('*')):
        if not p.is_file() or p.is_symlink() or p.name in excluded or p.suffix.lower() in {'.p12', '.pfx', '.pem', '.key'}:
            continue
        data = b'window.TIZY_DISTRIBUTABLE=true;\n' if p.name == 'token.js' else p.read_bytes()
        info = zipfile.ZipInfo(p.relative_to(app).as_posix())
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if p.name in {'xray', 'xray-arm64'} else 0o100644) << 16
        archive.writestr(info, data)
sha = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.sha256').write_text(sha + '  ' + out.name + '\n')
print(str(out) + '  ' + sha)
