from core.extract.base import Extractor
from core.extract.pymupdf_extractor import PyMuPDFExtractor

# TesseractExtractor, DoclingExtractor, MistralExtractor are NOT imported here.
# They load heavy ML libraries (docling loads models at import time).
# Import them directly from their submodules when needed:
#   from core.extract.docling_extractor import DoclingExtractor
#   from core.extract.tesseract_extractor import TesseractExtractor
#   from core.extract.mistral_extractor import MistralExtractor

__all__ = [
    "Extractor",
    "PyMuPDFExtractor",
]
