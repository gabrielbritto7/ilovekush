"""Install the official pinned standalone CLI, preserving artifact verification."""
from pathlib import Path
import hashlib
import urllib.request

root=Path(__file__).resolve().parents[1]
url='https://repo.maven.apache.org/maven2/org/verapdf/apps/cli/1.30.3/cli-1.30.3.jar'
data=urllib.request.urlopen(url,timeout=90).read()
expected=urllib.request.urlopen(url+'.sha512',timeout=30).read().decode().strip().split()[0]
if hashlib.sha512(data).hexdigest()!=expected:raise RuntimeError('Checksum veraPDF inválido.')
dest=root/'.tools/verapdf/bin/cli-1.30.3.jar';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
print('veraPDF 1.30.3 instalado com checksum SHA-512 verificado.')
