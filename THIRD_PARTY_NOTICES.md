# Componentes e atribuições

O ILOVEKUSH é independente do iLovePDF. As interfaces dos SDKs oficiais foram estudadas como referência; o processamento deste projeto usa os componentes abaixo. O código do projeto está sob AGPL-3.0-only. As licenças dos componentes e avisos originais continuam aplicáveis.

| Componente | Uso | Licença de referência |
| --- | --- | --- |
| React, Vite, TypeScript | Interface e build | MIT |
| Lucide | Ícones | ISC |
| Fredoka, Quicksand | Fontes da interface, hospedadas localmente | SIL OFL-1.1 |
| pdf-lib, fontkit | Manipulação e composição PDF no navegador | MIT |
| PDF.js | Leitura, extração e prévias | Apache-2.0 |
| qpdf / @jspawn/qpdf-wasm | Criptografia e reescrita estrutural | Apache-2.0; consulte avisos do pacote e upstream |
| Ghostscript / @jspawn/ghostscript-wasm | Compressão e PDF/A | AGPL-3.0; consulte avisos upstream |
| LibreOffice / @matbee/libreoffice-converter | Conversões de Office em WebAssembly | MPL-2.0; inclui componentes com seus próprios avisos |
| Tesseract, tesseract.js, tessdata_fast | OCR | Apache-2.0; pesos e licença em assets/ocr |
| PyMuPDF | Processamento PDF no servidor | AGPL-3.0 ou licença comercial; este projeto usa a opção livre |
| pdf2docx | Reconstrução de DOCX no backend completo | GPL-3.0 na versão instalada |
| pypdf, Pillow, ReportLab | Componentes de PDF, imagens e relatórios | Consulte as licenças BSD/Pillow dos pacotes |
| python-docx, openpyxl, python-pptx | Geração de documentos Office | MIT |
| pdfplumber / pdfminer.six | Extração de tabelas e texto | MIT |
| pyHanko | Assinatura digital | MIT |
| veraPDF CLI 1.30.3 | Validação real de PDF/A | GPL-3.0+ / MPL-2.0+; distribuição oficial |
| jdk4py / Eclipse Temurin | Runtime Java portátil | OpenJDK GPL-2.0 com Classpath Exception e avisos da distribuição |
| WeasyPrint | HTML para PDF no backend completo | BSD |
| CTranslate2 / SentencePiece | Tradução opcional local | MIT / Apache-2.0; modelos têm licença própria |
| docx, ExcelJS, PptxGenJS, fflate | Documentos e ZIP no navegador | MIT |
| DOMPurify / html2canvas | Sanitização e renderização HTML | Apache-2.0 ou MPL-2.0 / MIT |
| DejaVu Sans | Texto PDF Unicode | Licença Bitstream/DejaVu em backend/fonts/LICENSE |

As versões exatas dos pacotes npm estão em `package-lock.json`. Dependências Python de produção estão em `requirements.txt`; ferramentas adicionais estão em `requirements-full.txt`. Os motores WebAssembly são copiados dos pacotes instalados durante o build, sem executar atualizadores arbitrários.

A CLI veraPDF é obtida de Maven Central e verificada contra o SHA-512 da versão fixada. Modelos de tradução não estão incluídos e não foram baixados nesta etapa; confirme a licença do modelo ao instalá-lo. O perfil sRGB acompanha os avisos da distribuição do perfil ICC. Consulte a origem e as licenças completas antes de redistribuir motores ou construir versões modificadas.

O código e os avisos de licença originais dos motores permanecem nas distribuições de origem. Versões modificadas deste site devem disponibilizar o código correspondente conforme a AGPL e preservar atribuições.
