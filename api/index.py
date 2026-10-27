"""Vercel ASGI entrypoint. Documents are returned in the same request."""
import os
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('KUSH_MAX_UPLOAD_MB','4')
from backend.app import app
