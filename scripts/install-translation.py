"""Install an official Argos model for local CTranslate2 inference (no paid API)."""
from pathlib import Path
import argparse
import io
import json
import urllib.request
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--from',dest='source',choices=['en','pt','es'],required=True)
parser.add_argument('--to',dest='target',choices=['en','pt','es'],required=True)
args=parser.parse_args()
if args.source==args.target:parser.error('Escolha idiomas diferentes.')
index=json.load(urllib.request.urlopen('https://raw.githubusercontent.com/argosopentech/argospm-index/main/index.json',timeout=30))
entry=next((x for x in index if x['from_code']==args.source and x['to_code']==args.target),None)
if not entry:raise RuntimeError('O catálogo oficial não oferece esse par.')
url=next(x for x in entry['links'] if x.startswith('https://'))
print('Baixando modelo oficial:',args.source,'→',args.target,'de',url.split('/')[2])
data=urllib.request.urlopen(url,timeout=180).read(400*1024*1024)
root=Path(__file__).resolve().parents[1]/'.data/models'/f'{args.source}_{args.target}'
root.mkdir(parents=True,exist_ok=True)
if (root/'model/model.bin').exists():raise RuntimeError('Esse modelo já existe. Não será sobrescrito.')
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    for member in archive.infolist():
        rel=Path(*Path(member.filename).parts[1:])
        if not rel.parts or member.is_dir():continue
        target=root/rel
        if not target.resolve().is_relative_to(root.resolve()):raise RuntimeError('Caminho de arquivo inválido no pacote.')
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(member))
if not (root/'model/model.bin').exists() or not (root/'sentencepiece.model').exists():raise RuntimeError('O modelo não tem o formato esperado.')
print('Modelo instalado em',root)
