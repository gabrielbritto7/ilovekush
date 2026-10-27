from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tests.fixtures import build_documents

target=Path('/tmp/kush-fixtures')
build_documents(target)
print('Documentos sintéticos criados em',target)
