from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import shutil
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.background import BackgroundTask
from starlette.middleware.base import BaseHTTPMiddleware

from .catalog import TOOLS, TOOL_MAP
from .processors import MODEL_DIR, ProcessingError, inspect, package, process

ROOT=Path(__file__).resolve().parents[1]
MAX_MB=int(os.getenv('KUSH_MAX_UPLOAD_MB','100'))
MAX_BYTES=MAX_MB*1024*1024
DATA=Path(os.getenv('KUSH_DATA_DIR', '/tmp/ilovekush-jobs'))
DATA.mkdir(parents=True,exist_ok=True)
semaphore=asyncio.Semaphore(int(os.getenv('KUSH_CONCURRENCY','2')))
logger=logging.getLogger('ilovekush')
app=FastAPI(title='ILOVEKUSH API',version='1.0.0',docs_url='/api/docs',openapi_url='/api/openapi.json')


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self,request,call_next):
        length=request.headers.get('content-length')
        if length and int(length)>MAX_BYTES+512*1024:
            from fastapi.responses import JSONResponse
            return JSONResponse({'detail':f'Envie até {MAX_MB} MB no total.'},status_code=413)
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
        response.headers['Cross-Origin-Opener-Policy']='same-origin'
        response.headers['Cross-Origin-Embedder-Policy']='require-corp'
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control']='no-store'
        return response

app.add_middleware(SecurityHeaders)


def capabilities():
    server_tools=[t['id'] for t in TOOLS]
    if os.getenv('VERCEL'):
        server_tools=[t for t in server_tools if t not in ['word-pdf','excel-pdf','powerpoint-pdf','pdf-word','pdf-powerpoint','ocr','html-pdf','translate']]
    return dict(office=bool(shutil.which('soffice')),ocr=bool(shutil.which('tesseract')),
                ghostscript=bool(shutil.which('gs')),
                verapdf=bool((ROOT/'.tools/verapdf/bin/cli-1.30.3.jar').exists() or os.getenv('VERCEL')),
                translation_pairs=[p.name for p in MODEL_DIR.glob('*') if (p/'model').is_dir()] if MODEL_DIR.exists() else [],
                max_upload_mb=MAX_MB, max_pages=500, temporary_files=True, hosted_on_vercel=bool(os.getenv('VERCEL')),server_tools=server_tools)


@app.get('/api/health')
def health():return dict(status='ok',app='ILOVEKUSH',version='1.0.0',capabilities=capabilities())


@app.get('/api/tools')
def tools():return dict(tools=TOOLS,capabilities=capabilities())


async def stage(upload: UploadFile, folder: Path, name: str, budget: list[int]) -> Path:
    extension=Path(upload.filename or '').suffix.lower()[:10]
    path=folder/(name+extension)
    with path.open('wb') as target:
        while chunk:=await upload.read(1024*1024):
            budget[0]+=len(chunk)
            if budget[0]>MAX_BYTES:raise HTTPException(413,f'Envie até {MAX_MB} MB no total.')
            target.write(chunk)
    await upload.close()
    if path.stat().st_size==0:raise HTTPException(400,'Um dos arquivos está vazio.')
    return path


def parse_options(raw: str):
    if len(raw)>200_000:raise HTTPException(400,'As opções excedem o tamanho permitido.')
    try:value=json.loads(raw)
    except json.JSONDecodeError:raise HTTPException(400,'As opções não são um JSON válido.')
    if not isinstance(value,dict):raise HTTPException(400,'As opções devem ser um objeto JSON.')
    return value


def cleanup_old():
    # Crash leftovers only. Successful/error requests remove their own files.
    for p in DATA.iterdir():
        try:
            if p.is_dir() and time.time()-p.stat().st_mtime>3600:shutil.rmtree(p,ignore_errors=True)
        except OSError:pass


@app.post('/api/inspect')
async def inspect_file(file: UploadFile=File(...),options: str=Form('{}')):
    folder=Path(tempfile.mkdtemp(prefix='inspect-',dir=DATA))
    try:
        path=await stage(file,folder,'document',[0])
        async with semaphore:return await run_in_threadpool(inspect,path,parse_options(options))
    except ProcessingError as error:raise HTTPException(422,str(error))
    finally:shutil.rmtree(folder,ignore_errors=True)


@app.post('/api/process/{tool}')
async def run_tool(tool: str,files: list[UploadFile]=File(default=[]),options: str=Form('{}'),
                   image: UploadFile|None=File(default=None),signature: UploadFile|None=File(default=None),
                   certificate: UploadFile|None=File(default=None)):
    if tool not in TOOL_MAP:raise HTTPException(404,'Ferramenta não encontrada.')
    if tool not in capabilities()['server_tools']:raise HTTPException(422,'Use o processamento no navegador para esta ferramenta. Este servidor não tem o motor necessário.')
    metadata=TOOL_MAP[tool];opts=parse_options(options)
    if not files and not (tool=='html-pdf' and opts.get('html')):raise HTTPException(400,'Selecione um arquivo primeiro.')
    if len(files)>50:raise HTTPException(400,'Envie até 50 arquivos por operação.')
    if not metadata['multiple'] and len(files)>1:raise HTTPException(400,'Esta ferramenta processa um arquivo de cada vez.')
    if metadata.get('max_files') and len(files)>metadata['max_files']:raise HTTPException(400,'Confira a quantidade de arquivos desta ferramenta.')
    cleanup_old();folder=Path(tempfile.mkdtemp(prefix='job-',dir=DATA));budget=[0]
    try:
        paths=[await stage(file,folder,f'documento-{i+1}',budget) for i,file in enumerate(files)]
        assets={}
        for name,asset in [('image',image),('signature',signature),('certificate',certificate)]:
            if asset and asset.filename:assets[name]=await stage(asset,folder,name,budget)
        async with semaphore:
            result=await run_in_threadpool(process,tool,paths,opts,folder/'output',assets)
            output=await run_in_threadpool(package,result,folder/'ilovekush-resultados.zip')
        return FileResponse(output,filename=output.name,media_type=mimetypes.guess_type(output.name)[0] or 'application/octet-stream',
                            headers={'X-Kush-Output-Count':str(len(result))},background=BackgroundTask(shutil.rmtree,folder,ignore_errors=True))
    except HTTPException:
        shutil.rmtree(folder,ignore_errors=True);raise
    except ProcessingError as error:
        shutil.rmtree(folder,ignore_errors=True);raise HTTPException(422,str(error))
    except Exception as error:
        logger.exception('Processing failed for tool %s (%s)',tool,type(error).__name__)
        shutil.rmtree(folder,ignore_errors=True);raise HTTPException(422,'Não foi possível processar este arquivo. Confira o formato, a senha e as opções.')


class SPAStaticFiles(StaticFiles):
    async def get_response(self,path,scope):
        try:return await super().get_response(path,scope)
        except StarletteHTTPException as error:
            if error.status_code==404 and (path.startswith('ferramenta/') or not Path(path).suffix):
                return await super().get_response('index.html',scope)
            raise

if (ROOT/'dist').is_dir():app.mount('/',SPAStaticFiles(directory=ROOT/'dist',html=True),name='frontend')
