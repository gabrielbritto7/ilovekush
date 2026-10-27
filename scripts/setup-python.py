from pathlib import Path
import gzip
import shutil

root=Path(__file__).resolve().parents[1]
target=root/'.data/tessdata';target.mkdir(parents=True,exist_ok=True)
for language in ['por','eng','spa']:
    dest=target/f'{language}.traineddata'
    if not dest.exists():dest.write_bytes(gzip.decompress((root/f'assets/ocr/{language}.traineddata.gz').read_bytes()))
(target/'configs').mkdir(exist_ok=True)
if not (target/'configs/pdf').exists():(target/'configs/pdf').write_text('tessedit_create_pdf 1\n')
if not (target/'pdf.ttf').exists():shutil.copyfile(root/'assets/ocr/pdf.ttf',target/'pdf.ttf')
print('Idiomas de OCR e fonte PDF preparados.')
