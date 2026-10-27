# ILOVEKUSH

Um site independente de ferramentas de PDF, em português, com React, TypeScript e FastAPI. Processa documentos usando bibliotecas abertas e motores locais, sem usar a API do iLovePDF e sem cobrança por operação.

**O projeto ainda não equivale a 100% das funções, resultados e limites do iLovePDF.** Há 35 ferramentas no catálogo. A tradução precisa de modelos locais; assinatura visual não é assinatura certificada; conversões têm diferenças descritas abaixo. Publicar o código não torna a hospedagem ilimitada ou gratuita para sempre.

A interface segue a referência visual do código público do [Kushbitmap](https://github.com/gabrielbritto7/bitmap): branco e preto, contornos simples, botões arredondados e fontes Fredoka/Quicksand hospedadas localmente. A página inicial reúne busca, categorias e o catálogo. O envio de arquivos e as opções de processamento ficam dentro de cada ferramenta; o cabeçalho mantém apenas portfólio e GitHub. Inclui links para o portfólio Kush Archives.

## Entrega em ZIP

As atualizações são entregues em um ZIP com o projeto completo para publicação manual pelo proprietário. Extraia o arquivo e envie seu conteúdo para a raiz do repositório, mantendo `package.json`, `package-lock.json` e `vercel.json` nesse nível. O ZIP inclui os códigos, os recursos necessários e as configurações de build; não inclui histórico Git, credenciais, dependências instaladas, caches ou builds gerados. A instalação e o build recriam os motores e as dependências. A entrega do ZIP não publica alterações no GitHub nem na Vercel.

Entrega atual: **2026-10-27-v2**. Consulte `ATUALIZACAO-v2.txt` para o passo a passo de substituição e abra `/versao.json?v=2026-10-27-v2` no site publicado para conferir qual pacote está sendo servido. O título da aba é `kush4rchives | ilovekush`, o cabeçalho contém apenas Portfólio/GitHub e o envio de arquivos fica nas ferramentas.

## Desenvolvimento

Requisitos: Linux x64 para o backend completo; Node.js 22+; Python 3.12+; `curl`. O frontend funciona em navegadores modernos. Os motores WebAssembly locais de PDF e OCR exigem um navegador moderno; os headers COOP/COEP já estão configurados no Vite e na Vercel.

```bash
cd /workspace/ilovekush
npm ci
python -m venv --system-site-packages .venv
.venv/bin/pip install -r requirements-full.txt
python scripts/setup-python.py
python scripts/install-verapdf.py
npm run prepare:engines
```

Para o processamento nativo, instale os pacotes do sistema `libreoffice`, `ghostscript`, `tesseract-ocr` e fontes DejaVu. Esses programas já estavam disponíveis na máquina usada para o desenvolvimento. Em Debian/Ubuntu, o administrador pode usar `apt-get install libreoffice ghostscript tesseract-ocr fonts-dejavu-core`. WeasyPrint também exige as bibliotecas Pango/Harfbuzz da distribuição.

Inicie a API e a interface:

```bash
npm run server  # APIs Python (8000) e Office (8002)
npm run dev     # interface na porta 5173, com proxy /api
```

Para servir o build pelo Python:

```bash
npm run build
npm run server
```

Cada tarefa de nuvem já é isolada. Use este checkout; não crie worktrees sem solicitação explícita.

## Processamento e cobertura

O modo padrão é no navegador nas ferramentas compatíveis. A escolha de processamento no servidor aparece nas opções avançadas. Substituir texto existente e extrair imagens incorporadas usam o servidor automaticamente. As conversões Office usam `/api/office`. Várias operações do backend Python têm implementação nativa adicional para execução em um servidor completo.

| Ferramenta | Implementação e limite |
| --- | --- |
| Juntar PDF | Copia páginas; ordem dos arquivos pode ser alterada. Marcadores, assinaturas e vínculos especiais devem ser revisados depois da composição. |
| Dividir PDF | Por página, intervalos, grupos, extração e remoção. Múltiplos resultados são entregues em ZIP. |
| Organizar PDF | Ordem por números; permite omitir e duplicar páginas. |
| Girar PDF | 90°, 180° e 270°, com seleção de páginas. |
| Comprimir PDF | Ghostscript em WebAssembly ou nativo; mantém o original se a tentativa aumentar o tamanho. Níveis com perda de imagem. |
| PDF para Word | DOCX editável. No navegador/Vercel reconstrói o texto; no backend completo usa pdf2docx para reconstruir layout. Não promete fidelidade perfeita. |
| PDF para Excel | No navegador agrupa texto por posição. No servidor detecta tabelas com PyMuPDF e usa texto como alternativa. Sem OCR automático. |
| PDF para PowerPoint | Uma imagem da página por slide; os elementos internos não são editáveis. |
| Word/Excel/PowerPoint para PDF | LibreOffice WebAssembly em uma função Node separada na Vercel, com limite total de 4 MB. O backend Python completo também oferece LibreOffice nativo. Fontes e formatos complexos podem alterar o layout. |
| Imagem para PDF | JPG, PNG, WebP e BMP conforme suporte do navegador; TIFF também pode ser convertido no backend completo. |
| PDF para JPG | Renderiza páginas. Extração de imagens incorporadas usa o backend. |
| Editar PDF | Adiciona texto e imagem por coordenadas. Substituição de texto encontrado usa backend e não refaz parágrafos. |
| Assinar PDF | Aparência de assinatura desenhada, digitada ou enviada como imagem. Não cria certificação digital. |
| Marca d’água | Texto ou imagem, cor e opacidade. |
| Números de página | Posição superior/inferior, número inicial e formato. |
| HTML para PDF | HTML enviado ou colado. Não executa JavaScript nem carrega recursos externos. No navegador gera páginas rasterizadas. |
| Proteger PDF | Criptografia AES-256 com senha de abertura. |
| Desbloquear PDF | Exige senha quando necessária; não quebra criptografia nem recupera senha desconhecida. |
| PDF/A | Conversão PDF/A-2b por Ghostscript; confira a conformidade na ferramenta de validação. |
| Validar PDF/A | veraPDF 1.30.3 real; retorna relatório JSON de conformidade. A CLI é baixada do Maven Central com SHA-512 verificado. A função tem fallback para preparar o arquivo no armazenamento temporário quando necessário. |
| Reparar PDF | Tenta reescrever estruturas recuperáveis com qpdf/PyMuPDF; conteúdo perdido não é recriado. |
| Digitalizar | Captura de câmera ou fotos, modos colorido/cinza/preto e branco e composição em PDF. Não detecta automaticamente as bordas da folha. |
| OCR | Tesseract local, português/inglês/espanhol; resultado pesquisável. |
| Comparar PDFs | PDF lado a lado com diferenças visuais e relatório de texto. Alinha por número de página, sem alinhamento semântico de versões. |
| Censurar PDF | No navegador remove linhas correspondentes e regiões, reconstruindo páginas em imagens, sem texto original recuperável. No servidor aplica redação a objetos e remove metadados/anexos. Revise todo o resultado. |
| Recortar PDF | Altera a área visível. Não serve para eliminar conteúdo sensível. |
| Extrair texto | TXT ou JSON com posições. PDFs digitalizados precisam de OCR antes. |
| PDF para Markdown | Reconstrução heurística; não preserva todas as tabelas e layouts. |
| Formulários | Detecta e preenche campos interativos de texto, seleção e checkbox. Não cria automaticamente campos em scans ou trata todos os formatos XFA. |
| Resumir | Resumo extrativo local, que seleciona frases do documento. Não é um modelo de IA generativa. |
| Divisão por conteúdo | Palavra-chave/título por página. Não interpreta prompts nem usa IA generativa. |
| Traduzir | CTranslate2 com modelos Argos instalados no servidor. Produz novo PDF com texto, sem preservar o layout. **Ainda requer instalação do modelo.** |
| Certificado digital | Assinatura criptográfica usando PFX/P12 do usuário via pyHanko. Não inclui coleta por e-mail, certificados emitidos, carimbo de tempo, verificação de identidade ou serviço de confiança comercial. |

O projeto não copia o backend proprietário do iLovePDF, não usa chaves do site e não contorna franquias comerciais. O estudo anterior serviu de referência funcional; o código deste repositório é uma implementação independente.

## Tradução opcional

Os modelos são obtidos pelo catálogo oficial do Argos. A rede deve permitir o destino publicado no catálogo (atualmente `argos-net.com`). Não desative TLS nem contorne a política de rede.

```bash
.venv/bin/python scripts/install-translation.py --from en --to pt
.venv/bin/python scripts/install-translation.py --from pt --to en
```

Reinicie o backend depois. Os modelos ficam em `.data/models` e não são enviados ao GitHub. O frontend consulta os pares instalados. Sem modelo a ferramenta fica explicitamente indisponível. Modelos grandes não cabem necessariamente em uma função Vercel; para tradução própria em produção, use um backend com capacidade adequada e configure o encaminhamento de `/api`.

## Publicação na Vercel

O projeto inclui `vercel.json`, entrada ASGI em `api/index.py`, headers para WebAssembly e fallback para rotas da interface. O build usa `npm ci` e `npm run build`.

Na Vercel, conecte o repositório `gabrielbritto7/ilovekush` e publique a branch `main`. Também é possível usar a CLI autenticada e executar `vercel --prod`. **Uma publicação só está confirmada depois do resultado real da Vercel e de um teste da URL publicada.**

O servidor Python recebe e devolve cada resultado na mesma requisição, sem depender de tarefas em background ou de arquivos persistentes entre instâncias. `requirements.txt` contém as dependências da função; `requirements-full.txt` adiciona os motores Python para um servidor completo. O runtime Java portátil é fornecido por `jdk4py` para executar veraPDF. A função Node de Office é isolada para respeitar o limite de tamanho por função. O transporte do worker é fixado à versão 2.7.2 do pacote e controla seus próprios timers/encerramento, evitando o travamento observado no conversor de navegador.

Limites importantes:

- O upload para o backend foi limitado a 4 MB, por causa do limite de payload das funções Vercel. Operações no navegador não enviam o arquivo à função.
- Office usa uma função Node separada (`api/office.mjs`) com o motor WebAssembly do LibreOffice. O motor fica no servidor; o usuário não precisa baixar 250 MB. O total enviado e o resultado são limitados a 4 MB. A função encerra seu processo de conversão e remove os temporários ao terminar.
- OCR usa modelos locais incluídos no projeto. Ghostscript, qpdf e fontes são servidos pelo próprio site.
- Os planos da Vercel têm limites de tráfego, CPU e duração. A aplicação não tem cobrança, mas não promete infraestrutura gratuita ilimitada. Verifique também a elegibilidade do seu uso para o plano escolhido.
- A restauração em outra máquina, o empacotamento efetivo da função e o domínio precisam ser validados no deploy real. Um build local aprovado não comprova a publicação.

### Domínio

O domínio solicitado é **`pdf.kush-archives.com.br`**. Após publicar, adicione esse hostname em **Project → Settings → Domains**. No provedor DNS de `kush-archives.com.br`, crie o registro para o nome `pdf` usando **exatamente o tipo e destino mostrados pela Vercel**. Não configure um IP ou CNAME adivinhado. Aguarde verificação e emissão HTTPS e teste o domínio.

### Credenciais

Para permitir que o agente gerencie a Vercel, configure `VERCEL_TOKEN` pelo campo seguro do **ambiente do Codex**, com destino `api.vercel.com`. As variáveis do projeto na Vercel são um ambiente separado: adicionar o token ali não o disponibiliza ao Codex, e o site não precisa desse token para funcionar. Depois de conectar o repositório, os pushes podem acionar a integração Git da Vercel sem um token no site. Não coloque tokens no código, em arquivos versionados, em argumentos visíveis de logs ou no chat. O GitHub deve usar a autenticação de plataforma existente. A publicação de repositório público exige acesso de escrita e confirmação de visibilidade no GitHub.

## Testes

```bash
npm run build
npm test
```

Os testes de servidor geram documentos sintéticos: PDFs com múltiplas páginas, formulário, imagens, Office e um certificado de teste. Verificam estrutura, ordem, criptografia, remoção de texto, arquivos Office editáveis, OCR pesquisável, validação real de PDF/A, assinatura criptográfica e limpeza de temporários. Não usam documentos pessoais ou uma API paga.

Para o smoke test de navegador, gere fixtures com `.venv/bin/python scripts/create-test-fixtures.py`, faça `KUSH_E2E=1 npm run build`, inicie `npm run preview` com as APIs ativas e execute `KUSH_TEST_URL=http://127.0.0.1:4173 KUSH_TEST_PRODUCTION=1 node scripts/browser-smoke.mjs`. Depois use `npm run build` para remover o harness do build final. O teste exige Chromium; veja `scripts/browser-smoke.mjs`. Exercita também busca, favoritos, responsividade, upload, download e os motores WebAssembly. Os artefatos de teste ficam em `artifacts/`, fora do Git.

## Dados, limites e operação

- Arquivos locais de navegador não são enviados ao servidor.
- Operações de servidor usam pastas aleatórias por requisição e apagam os arquivos no sucesso/erro. Restos de uma interrupção expiram em uma hora e são removidos na próxima operação.
- Favoritos são armazenados apenas no navegador. Não há contas, publicidade, rastreadores ou banco de documentos.
- Não há sistema de cobrança, envio de e-mails ou coleta de assinaturas de terceiros.
- O backend completo limita o total por operação a 100 MB, 50 arquivos e 500 páginas por documento. Ajustes por `KUSH_MAX_UPLOAD_MB`, `KUSH_MAX_PAGES` e `KUSH_CONCURRENCY`.
- Operações intensivas no navegador dependem da memória disponível. Não há promessa de tamanho ilimitado.
- Antes de abrir uma instância pública de grande tráfego, configure limites de requisição na hospedagem e acompanhe consumo. O limite de concorrência desta aplicação é por processo, não global entre funções.

## Licença

Código do projeto sob **AGPL-3.0-only**. Veja [LICENSE](LICENSE) e [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Distribuir ou oferecer versões modificadas deve respeitar as licenças dos componentes. O nome e o serviço iLovePDF pertencem aos respectivos titulares; este projeto não é afiliado a eles.
