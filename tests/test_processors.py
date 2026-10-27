import datetime
import io
import json
import zipfile
from pathlib import Path

import fitz
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import app

client=TestClient(app)


@pytest.fixture(scope='session')
def sample_dir(tmp_path_factory):
    from tests.fixtures import build_documents
    return build_documents(tmp_path_factory.mktemp('documents'))


def request(tool,folder,names=('sample.pdf',),options=None,assets=None):
    files=[('files',(name,(folder/name).read_bytes(),'application/octet-stream')) for name in names]
    files += [(key,(name,(folder/name).read_bytes(),'application/octet-stream')) for key,name in (assets or {}).items()]
    return client.post('/api/process/'+tool,files=files,data={'options':json.dumps(options or {})})


def output_pdf(response):
    assert response.status_code==200,response.text[:500]
    return fitz.open(stream=response.content,filetype='pdf')


def test_merge_and_order(sample_dir):
    with output_pdf(request('merge',sample_dir,('other.pdf','sample.pdf'))) as doc:
        assert len(doc)==4 and 'Another document' in doc[0].get_text()


def test_split_zip(sample_dir):
    response=request('split',sample_dir,options={'split_mode':'ranges','ranges':'1-2;3'})
    assert response.status_code==200,response.text[:200]
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        assert len(z.namelist())==2
        counts=[]
        for name in z.namelist():
            with fitz.open(stream=z.read(name),filetype='pdf') as d:counts.append(len(d))
        assert counts==[2,1]


def test_organize_duplicates(sample_dir):
    with output_pdf(request('organize',sample_dir,options={'order':'3,1,1'})) as d:
        assert len(d)==3 and 'Chapter 3' in d[0].get_text() and d[1].get_text()==d[2].get_text()


def test_rotate_selection(sample_dir):
    with output_pdf(request('rotate',sample_dir,options={'angle':90,'pages':'2'})) as d:
        assert [p.rotation for p in d]==[0,90,0]


def test_encrypt_decrypt(sample_dir):
    response=request('protect',sample_dir,options={'new_password':'sample-password'})
    with output_pdf(response) as d:
        assert d.needs_pass and d.authenticate('sample-password')>0 and len(d)==3
    (sample_dir/'protected.pdf').write_bytes(response.content)
    wrong=request('unlock',sample_dir,('protected.pdf',),{'password':'wrong'})
    assert wrong.status_code==422
    with output_pdf(request('unlock',sample_dir,('protected.pdf',),{'password':'sample-password'})) as d:assert not d.needs_pass and len(d)==3


def test_redaction_removes_text(sample_dir):
    with output_pdf(request('redact',sample_dir,options={'redact_text':'SECRET-123'})) as d:
        assert all('SECRET-123' not in p.get_text() for p in d)
        assert 'PDF processing' in d[0].get_text()


@pytest.mark.parametrize('tool,options',[('edit',{'text':'Added text','x':10,'y':40}),('watermark',{'text':'CONFIDENTIAL'}),('pagenumber',{'format':'Page {n} of {total}'}),('sign',{'text':'My Signature','y':80})])
def test_added_content(sample_dir,tool,options):
    with output_pdf(request(tool,sample_dir,options=options)) as d:
        expected=options.get('text','Page 1 of 3')
        assert expected in d[0].get_text()


@pytest.mark.parametrize('tool,names',[('jpg-pdf',('image.png',)),('scan',('image.png',)),('word-pdf',('sample.docx',)),('excel-pdf',('sample.xlsx',)),('powerpoint-pdf',('sample.pptx',)),('html-pdf',('page.html',))])
def test_input_conversions(sample_dir,tool,names):
    with output_pdf(request(tool,sample_dir,names)) as d:assert len(d)>0


@pytest.mark.parametrize('tool,extension',[('pdf-word','docx'),('pdf-excel','xlsx'),('pdf-powerpoint','pptx')])
def test_office_outputs(sample_dir,tool,extension):
    response=request(tool,sample_dir)
    assert response.status_code==200,response.text[:300]
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        assert '[Content_Types].xml' in z.namelist()
        if extension=='docx':assert b'Chapter' in z.read('word/document.xml')
        if extension=='xlsx':assert any('sheet1.xml' in name for name in z.namelist())
        if extension=='pptx':assert 'ppt/slides/slide3.xml' in z.namelist()


def test_extract(sample_dir):
    response=request('extract',sample_dir)
    assert response.status_code==200 and 'Chapter 3' in response.text


def test_markdown(sample_dir):
    response=request('markdown',sample_dir)
    assert response.status_code==200 and '## Chapter' in response.text


def test_summary(sample_dir):
    response=request('summarize',sample_dir,options={'sentences':2,'output':'txt'})
    assert response.status_code==200 and len(response.text)>30
    original='\n'.join(page.get_text() for page in fitz.open(sample_dir/'sample.pdf'))
    assert all(sentence in original for sentence in response.text.split('\n\n'))


def test_content_split(sample_dir):
    response=request('smart-split',sample_dir,options={'keyword':'Chapter'})
    assert response.status_code==200
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:assert len(z.namelist())==3


def test_form_inspection_and_fill(sample_dir):
    response=client.post('/api/inspect',files={'file':('form.pdf',(sample_dir/'form.pdf').read_bytes())})
    assert response.status_code==200 and response.json()['fields'][0]['name']=='name'
    with output_pdf(request('forms',sample_dir,('form.pdf',),{'fields':{'name':'Gabriel'}})) as d:
        assert next(d[0].widgets()).field_value=='Gabriel'


def test_crop(sample_dir):
    with output_pdf(request('crop',sample_dir,options={'crop_margin':30})) as d:assert d[0].rect.width==535


def test_compress(sample_dir):
    response=request('compress',sample_dir)
    with output_pdf(response) as d:assert len(d)==3
    assert len(response.content)<=(sample_dir/'sample.pdf').stat().st_size


def test_repair(sample_dir):
    with output_pdf(request('repair',sample_dir)) as d:assert len(d)==3


def test_pdf_jpg(sample_dir):
    response=request('pdf-jpg',sample_dir,options={'pages':'2','dpi':72})
    assert response.status_code==200 and Image.open(io.BytesIO(response.content)).format=='JPEG'


def test_compare(sample_dir):
    response=request('compare',sample_dir,('sample.pdf','other.pdf'))
    assert response.status_code==200
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        assert b'Another document' in z.read('diferencas.txt')
        with fitz.open(stream=z.read('comparacao-visual.pdf'),filetype='pdf') as d:assert len(d)==3


def test_ocr_searchable(sample_dir):
    with output_pdf(request('ocr',sample_dir,('scan.pdf',),{'language':'eng'})) as d:assert 'Chapter' in d[0].get_text()


def test_pdfa_metadata(sample_dir):
    with output_pdf(request('pdfa',sample_dir)) as d:
        assert 'pdfaid:part' in d.get_xml_metadata()
        assert 'pdfaid:part=\'2\'' in d.get_xml_metadata() or '>2<' in d.get_xml_metadata() or 'pdfaid:part="2"' in d.get_xml_metadata()


def test_pdfa_real_validation(sample_dir):
    converted=request('pdfa',sample_dir)
    assert converted.status_code==200
    (sample_dir/'archive.pdf').write_bytes(converted.content)
    report=request('validate-pdfa',sample_dir,('archive.pdf',))
    assert report.status_code==200,report.text[:500]
    result=report.json()['report']['jobs'][0]['validationResult'][0]
    assert result['compliant'] is True
    assert result['details']['failedChecks']==0


def test_certificate_signature(sample_dir):
    response=request('certificate',sample_dir,options={'certificate_password':'test-password'},assets={'certificate':'test.p12'})
    assert response.status_code==200,response.text[:300]
    from pyhanko.pdf_utils.reader import PdfFileReader
    reader=PdfFileReader(io.BytesIO(response.content))
    assert len(reader.embedded_signatures)==1
    signature=reader.embedded_signatures[0]
    assert signature.field_name=='ILOVEKUSH'
    from pyhanko.sign.validation import validate_pdf_signature
    from pyhanko_certvalidator import ValidationContext
    status=validate_pdf_signature(signature,signer_validation_context=ValidationContext(trust_roots=[signature.signer_cert],allow_fetching=False))
    assert status.intact and status.valid


@pytest.mark.parametrize('tool,options',[('rotate',{'pages':'999'}),('protect',{'new_password':'x'}),('redact',{}),('split',{'split_mode':'remove','pages':'1-3'}),('crop',{'crop_margin':400})])
def test_invalid_options_fail(sample_dir,tool,options):
    response=request(tool,sample_dir,options=options)
    assert response.status_code==422 and 'detail' in response.json()


def test_invalid_file_and_unknown_tool(sample_dir):
    response=client.post('/api/process/merge',files=[('files',('a.pdf',b'not pdf')),('files',('b.pdf',b'not pdf'))])
    assert response.status_code==422
    assert client.post('/api/process/missing').status_code==404


def test_temporary_files_removed(sample_dir):
    from backend.app import DATA
    before=set(DATA.iterdir())
    assert request('rotate',sample_dir).status_code==200
    assert set(DATA.iterdir())==before
