"""Functional readiness check using a generated document, never user files."""
import argparse
import fitz
import httpx

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',default='http://127.0.0.1:8000')
parser.add_argument('--office-url')
args=parser.parse_args()
with httpx.Client(timeout=120) as client:
    response=client.get(args.base_url.rstrip('/')+'/api/health')
    response.raise_for_status()
    assert response.json()['app']=='ILOVEKUSH'
    source=fitz.open();page=source.new_page();page.insert_text((60,80),'ILOVEKUSH readiness check')
    data=source.tobytes();source.close()
    response=client.post(args.base_url.rstrip('/')+'/api/process/rotate',files={'files':('smoke.pdf',data,'application/pdf')},data={'options':'{"angle":90}'})
    response.raise_for_status()
    with fitz.open(stream=response.content,filetype='pdf') as doc:
        assert len(doc)==1 and doc[0].rotation==90
        assert 'ILOVEKUSH readiness check' in doc[0].get_text()
    if args.office_url:
        response=client.get(args.office_url);response.raise_for_status();assert response.json()['status']=='ok'
print('PASS: health, PDF processing, document content and optional Office readiness.')
