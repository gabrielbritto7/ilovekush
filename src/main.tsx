import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Icons } from "./icons";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/600.css";
import "@fontsource/quicksand/700.css";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import catalog from "./tools.json";
import type { Options, Output } from "./engine";
const localTools = new Set(
  catalog
    .filter(
      (t) =>
        ![
          "translate",
          "validate-pdfa",
          "certificate",
          "word-pdf",
          "excel-pdf",
          "powerpoint-pdf",
        ].includes(t.id),
    )
    .map((t) => t.id),
);
import "./styles.css";

type Tool = (typeof catalog)[number];
type IconName = keyof typeof Icons;
const Icon = ({
  name,
  size = 22,
  ...props
}: {
  name: string;
  size?: number;
  [key: string]: any;
}) => {
  const Component = (Icons[name as IconName] ||
    Icons.FileText) as React.ComponentType<any>;
  return <Component size={size} strokeWidth={1.7} {...props} />;
};
const categories = [
  ["todos", "Todas as ferramentas", "Grid2X2"],
  ["organizar", "Organizar", "Layers"],
  ["otimizar", "Otimizar", "Zap"],
  ["converter", "Converter", "ArrowLeftRight"],
  ["editar", "Editar", "PencilLine"],
  ["proteger", "Proteger", "ShieldCheck"],
  ["inteligente", "Inteligentes", "Sparkles"],
];
const formatSize = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const defaultOptions = (): Options => ({
  level: "recommended",
  split_mode: "pages",
  group_size: 1,
  angle: 90,
  font_size: 18,
  color: "#1a1a1a",
  opacity: 30,
  start: 1,
  position: "bottom",
  format: "{n} / {total}",
  x: 10,
  y: 12,
  crop_margin: 24,
  paper: "a4",
  orientation: "portrait",
  margin: 12,
  dpi: 150,
  language: "por+eng",
  sentences: 6,
  output: "pdf",
  from: "en",
  to: "pt",
  fields: {},
  scan_mode: "color",
  image_mode: "pages",
});

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="brand"
      aria-label="ILOVEKUSH início"
    >
      ILOVEKUSH<span className="brand-label">PDF</span>
    </a>
  );
}

function App() {
  const [path, setPath] = useState(location.pathname);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todos");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("kush-favorites") || "[]");
      return Array.isArray(saved)
        ? saved.filter((id) => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const tool = catalog.find((item) => path === `/ferramenta/${item.id}`);
  const navigate = (url: string) => {
    if (url !== location.pathname) history.pushState({}, "", url);
    setPath(url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const listener = () => setPath(location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setCapabilities(data.capabilities))
      .catch(() => setCapabilities({ unavailable: true }));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("kush-favorites", JSON.stringify(favorites));
    } catch {
      // Favorites remain usable for this visit when storage is unavailable.
    }
  }, [favorites]);
  const toggleFavorite = (id: string) =>
    setFavorites((list) =>
      list.includes(id) ? list.filter((value) => value !== id) : [...list, id],
    );
  const visible = catalog.filter(
    (item) =>
      (category === "todos" || item.category === category) &&
      normalized(`${item.name} ${item.description}`).includes(
        normalized(query),
      ),
  );

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="header-inner">
          <Brand
            onClick={() => {
              navigate("/");
            }}
          />
          <nav className="header-actions" aria-label="Navegação principal">
            <a
              className="portfolio-link"
              href="https://kush-archives.com.br/portfolio"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir portfólio Kush Archives"
              title="Portfólio Kush Archives"
            >
              <span>Portfólio</span>
              <Icon name="ArrowUpRight" size={17} />
            </a>
            <a
              className="github-header"
              href="https://github.com/gabrielbritto7/ilovekush"
              target="_blank"
              rel="noreferrer"
              aria-label="Código no GitHub"
              title="Código no GitHub"
            >
              <Icon name="Github" size={20} />
            </a>
          </nav>
        </div>
      </header>
      <div id="conteudo" tabIndex={-1}>
        {tool ? (
          <Workspace
            key={tool.id}
            tool={tool}
            onHome={() => {
              navigate("/");
            }}
            onNavigate={(id) => {
              navigate(`/ferramenta/${id}`);
            }}
            capabilities={capabilities}
          />
        ) : path !== "/" ? (
          <main className="not-found container">
            <Icon name="FileQuestion" size={48} />
            <h1>Essa página não está por aqui.</h1>
            <button className="primary" onClick={() => navigate("/")}>
              Voltar para o início
            </button>
          </main>
        ) : (
          <main className="home container">
            <section className="intro" aria-labelledby="intro-title">
              <div className="intro-copy">
                <span className="section-kicker">UM PROJETO KUSH ARCHIVES</span>
                <h1 id="intro-title">
                  Seus PDFs.
                  <br />
                  Sem complicação.
                </h1>
                <p>
                  Junte, converta, edite e resolva.
                  <br />
                  Gratuito, sem cadastro e de código aberto.
                </p>
              </div>
            </section>
            <section
              id="ferramentas"
              className="tools-section"
              aria-labelledby="tools-title"
            >
              <div className="section-heading">
                <h2 id="tools-title">
                  Ferramentas <span>{catalog.length}</span>
                </h2>
                <label className="search-box">
                  <Icon name="Search" size={19} />
                  <input
                    aria-label="Buscar ferramenta"
                    placeholder="O que você precisa fazer?"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Limpar busca"
                    >
                      <Icon name="X" size={17} />
                    </button>
                  )}
                </label>
              </div>
              <div
                className="category-bar"
                role="group"
                aria-label="Categorias"
              >
                {categories.map(([id, name]) => (
                  <button
                    key={id}
                    className={category === id ? "selected" : ""}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {id === "todos" ? "Todas" : name}
                  </button>
                ))}
              </div>
              <div className="results-count" role="status" aria-live="polite">
                {query || category !== "todos"
                  ? `${visible.length} ${visible.length === 1 ? "ferramenta encontrada" : "ferramentas encontradas"}`
                  : "Escolha uma ferramenta para começar."}
              </div>
              <div className="tools-grid">
                {visible.map((item) => (
                  <article className="tool-card" key={item.id}>
                    <a
                      href={`/ferramenta/${item.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(`/ferramenta/${item.id}`);
                      }}
                      className="tool-card-link"
                    >
                      <span className="tool-icon">
                        <Icon name={item.icon} size={26} />
                      </span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <Icon
                        name="ArrowUpRight"
                        size={16}
                        className="card-arrow"
                      />
                    </a>
                    <button
                      className={`bookmark ${favorites.includes(item.id) ? "bookmarked" : ""}`}
                      aria-label={`${favorites.includes(item.id) ? "Remover" : "Adicionar"} ${item.name} ${favorites.includes(item.id) ? "dos" : "aos"} favoritos`}
                      aria-pressed={favorites.includes(item.id)}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      <Icon
                        name="Bookmark"
                        size={17}
                        fill={
                          favorites.includes(item.id) ? "currentColor" : "none"
                        }
                      />
                    </button>
                  </article>
                ))}
              </div>
              {!visible.length && (
                <div className="empty-search">
                  <Icon name="SearchX" size={34} />
                  <h3>Nenhuma ferramenta encontrada.</h3>
                  <p>Tente outra busca ou escolha outra categoria.</p>
                  <button
                    className="outline"
                    onClick={() => {
                      setQuery("");
                      setCategory("todos");
                    }}
                  >
                    Ver todas as ferramentas
                  </button>
                </div>
              )}
            </section>
            <p className="home-note">
              <Icon name="Info" size={16} /> O processamento e os limites de
              cada operação aparecem dentro da ferramenta.
            </p>
          </main>
        )}
      </div>
      <footer className="footer">
        <div className="container footer-inner">
          <a
            href="https://kush-archives.com.br/"
            target="_blank"
            rel="noreferrer"
          >
            © {new Date().getFullYear()} kush4rchives{" "}
            <Icon name="ArrowUpRight" size={13} />
          </a>
          <div>
            <button onClick={() => setPrivacyOpen(true)}>Privacidade</button>
            <a
              href="https://github.com/gabrielbritto7/ilovekush"
              target="_blank"
              rel="noreferrer"
            >
              Código aberto <Icon name="ArrowUpRight" size={13} />
            </a>
          </div>
        </div>
      </footer>
      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </>
  );
}

function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="info-modal"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <Icon name="X" />
        </button>
        <Icon name="ShieldCheck" size={28} />
        <h2 id="dialog-title">Privacidade</h2>
        <p>
          Ferramentas com o indicador “Neste dispositivo” processam o arquivo no
          navegador. Nesses casos, nenhum documento é enviado ao nosso servidor.
        </p>
        <p>
          Operações de servidor usam uma pasta temporária por requisição. Os
          arquivos são apagados ao concluir o envio do resultado ou em caso de
          erro. Resíduos de uma interrupção são removidos na próxima operação
          depois de uma hora.
        </p>
        <p>
          Os favoritos ficam no armazenamento local do navegador. Não usamos
          anúncios, rastreadores ou contas. O provedor de hospedagem pode
          registrar dados técnicos de acesso, como endereço IP e erros.
        </p>
      </div>
    </dialog>
  );
}

function SignaturePad({ onChange }: { onChange: (file: File | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const point = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) * 640) / rect.width,
      ((e.clientY - rect.top) * 240) / rect.height,
    ] as const;
  };
  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    ref.current?.toBlob(
      (b) =>
        b && onChange(new File([b], "assinatura.png", { type: "image/png" })),
    );
  };
  return (
    <div className="signature-box">
      <div>
        <span>Desenhe sua assinatura</span>
        <button
          type="button"
          onClick={() => {
            ref.current?.getContext("2d")?.clearRect(0, 0, 640, 240);
            onChange(null);
          }}
        >
          Limpar
        </button>
      </div>
      <canvas
        ref={ref}
        width={640}
        height={240}
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.strokeStyle = "#1a1a1a";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(...point(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.lineTo(...point(e));
          ctx.stroke();
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label="Área para desenhar assinatura"
      />
      <span className="signature-baseline">assine aqui</span>
    </div>
  );
}

function FilePreview({
  file,
  password,
  tool,
  onBox,
}: {
  file?: File;
  password: string;
  tool: string;
  onBox: (box: any) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    setPage(1);
    setBox(null);
  }, [file]);
  useEffect(() => {
    let stopped = false;
    let cleanup: (() => void) | undefined;
    setError("");
    setLoading(true);
    if (!file) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        let canvas: HTMLCanvasElement;
        if (file.type.startsWith("image/")) {
          const image = await createImageBitmap(file);
          canvas = document.createElement("canvas");
          canvas.width = 650;
          canvas.height = (650 * image.height) / image.width;
          canvas
            .getContext("2d")!
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          image.close();
          setCount(1);
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          const { loadPdf, renderPage } = await import("./pdf");
          const pdf = await loadPdf(file, password);
          cleanup = () => {
            pdf.destroy();
          };
          setCount(pdf.numPages);
          canvas = await renderPage(pdf, Math.min(page, pdf.numPages), 700);
        } else {
          setError("A prévia fica disponível depois da conversão.");
          return;
        }
        if (!stopped && container.current) {
          container.current.replaceChildren(canvas);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
        }
      } catch {
        if (!stopped)
          setError(
            "Prévia indisponível. Se o PDF estiver protegido, informe a senha abaixo.",
          );
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
      cleanup?.();
    };
  }, [file, password, page]);
  if (!file) return null;
  return (
    <div className="preview-panel">
      <div className="preview-title">
        <span>
          <Icon name="Eye" size={15} /> Prévia do documento
        </span>
        {count > 1 && (
          <div>
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((v) => v - 1);
                setBox(null);
              }}
              aria-label="Página anterior"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <span>
              {page} / {count}
            </span>
            <button
              disabled={page >= count}
              onClick={() => {
                setPage((v) => v + 1);
                setBox(null);
              }}
              aria-label="Próxima página"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
        )}
      </div>
      {error ? (
        <div className="preview-error">
          <Icon name="FileText" size={42} />
          <p>{error}</p>
        </div>
      ) : (
        <div className="preview-scroll">
          <div
            className={`canvas-wrap ${tool === "redact" ? "redact-canvas" : ""}`}
            onPointerDown={(e) => {
              if (tool !== "redact") return;
              const r = e.currentTarget.getBoundingClientRect();
              start.current = {
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!start.current) return;
              const r = e.currentTarget.getBoundingClientRect();
              const x = Math.max(
                0,
                Math.min(100, ((e.clientX - r.left) / r.width) * 100),
              );
              const y = Math.max(
                0,
                Math.min(100, ((e.clientY - r.top) / r.height) * 100),
              );
              setBox({
                x: Math.min(x, start.current.x),
                y: Math.min(y, start.current.y),
                width: Math.abs(x - start.current.x),
                height: Math.abs(y - start.current.y),
              });
            }}
            onPointerUp={() => {
              if (start.current && box && box.width > 0.5 && box.height > 0.5)
                onBox({ ...box, page });
              start.current = null;
            }}
          >
            <div ref={container} />
            {box && (
              <div
                className="redaction-selection"
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
              />
            )}
            {loading && (
              <div className="preview-loading">
                <Icon name="LoaderCircle" className="spin" size={25} />
              </div>
            )}
          </div>
        </div>
      )}
      {tool === "redact" && (
        <p className="preview-hint">
          Arraste sobre a página para selecionar uma região. A última seleção
          substitui a anterior.
        </p>
      )}
    </div>
  );
}

const FormContext = React.createContext<{
  options: Options;
  update: (key: string, value: any) => void;
  assets: Record<string, File>;
  setAsset: (key: string, value: File | null) => void;
}>({ options: {}, update: () => {}, assets: {}, setAsset: () => {} });
function Field({
  id,
  label,
  placeholder = "",
  type = "text",
  hint,
  min,
  max,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  min?: number;
  max?: number;
}) {
  const { options, update } = React.useContext(FormContext);
  return (
    <label className="option-field">
      <span>{label}</span>
      <input
        type={type}
        value={options[id] ?? ""}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) =>
          update(
            id,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Select({
  id,
  label,
  values,
}: {
  id: string;
  label: string;
  values: [string, string][];
}) {
  const { options, update } = React.useContext(FormContext);
  return (
    <label className="option-field">
      <span>{label}</span>
      <select
        value={options[id] ?? values[0][0]}
        onChange={(e) => update(id, e.target.value)}
      >
        {values.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
function Area({
  id,
  label,
  placeholder,
}: {
  id: string;
  label: string;
  placeholder?: string;
}) {
  const { options, update } = React.useContext(FormContext);
  return (
    <label className="option-field">
      <span>{label}</span>
      <textarea
        value={options[id] || ""}
        placeholder={placeholder}
        onChange={(e) => update(id, e.target.value)}
      />
    </label>
  );
}
function Asset({
  name,
  label,
  accept,
}: {
  name: string;
  label: string;
  accept: string;
}) {
  const { assets, setAsset } = React.useContext(FormContext);
  return (
    <label className="asset-picker">
      <Icon name="Upload" size={16} />
      <span>{assets[name]?.name || label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => setAsset(name, e.target.files?.[0] || null)}
      />
      {assets[name] && <Icon name="Check" size={16} />}
    </label>
  );
}

function Workspace({
  tool,
  onHome,
  onNavigate,
  capabilities,
}: {
  tool: Tool;
  onHome: () => void;
  onNavigate: (id: string) => void;
  capabilities: any;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<Options>(defaultOptions);
  const [assets, setAssets] = useState<Record<string, File>>({});
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Output | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [drop, setDrop] = useState(false);
  const [useServer, setUseServer] = useState(false);
  const [fields, setFields] = useState<any[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const dragIndex = useRef<number | null>(null);
  const update = (key: string, value: any) =>
    setOptions((current) => ({ ...current, [key]: value }));
  const local =
    localTools.has(tool.id) &&
    !useServer &&
    !(tool.id === "edit" && options.find) &&
    !(tool.id === "pdf-jpg" && options.image_mode === "extract");
  useEffect(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const addFiles = (incoming: File[]) => {
    setError("");
    setResult(null);
    setStatus("idle");
    const allowed = tool.accept.split(",");
    const accepted = incoming.filter((f) =>
      allowed.some((ext) =>
        ext === "image/*"
          ? f.type.startsWith("image/")
          : f.name.toLowerCase().endsWith(ext),
      ),
    );
    if (accepted.length !== incoming.length)
      setError(
        `Use os formatos aceitos: ${tool.accept.replaceAll(".", "").toUpperCase()}.`,
      );
    setFiles((current) =>
      tool.multiple
        ? [...current, ...accepted].slice(0, tool.max_files || 50)
        : accepted.slice(0, 1),
    );
  };
  const move = (i: number, direction: number) =>
    setFiles((current) => {
      const next = [...current];
      if (i + direction < 0 || i + direction >= next.length) return current;
      [next[i], next[i + direction]] = [next[i + direction], next[i]];
      return next;
    });
  const setAsset = (key: string, value: File | null) =>
    setAssets((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  const start = async () => {
    if (status === "running") return;
    if (!files.length && !(tool.id === "html-pdf" && options.html)) {
      input.current?.click();
      return;
    }
    if (tool.id === "merge" && files.length < 2) {
      setError("Adicione pelo menos dois PDFs para juntar.");
      return;
    }
    setError("");
    setResult(null);
    setStatus("running");
    setMessage(
      local
        ? "Preparando processamento neste dispositivo…"
        : "Enviando arquivos para processamento…",
    );
    controller.current = new AbortController();
    try {
      const { runLocal, runServer } = await import("./engine");
      const output = local
        ? await runLocal(tool.id, files, options, setMessage, assets)
        : await runServer(
            tool.id,
            files,
            options,
            assets,
            controller.current.signal,
          );
      setResult(output);
      setStatus("done");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível processar o documento.",
      );
      setStatus("idle");
    }
  };
  const inspectFields = async () => {
    if (!files[0]) return;
    setError("");
    setMessage("Encontrando campos…");
    try {
      const data = new FormData();
      data.append("file", files[0]);
      data.append("options", JSON.stringify({ password: options.password }));
      const response = await fetch("/api/inspect", {
        method: "POST",
        body: data,
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.detail || "Não foi possível detectar os campos.");
      setFields(value.fields);
      update(
        "fields",
        Object.fromEntries(
          value.fields.map((f: any) => [
            f.name,
            f.type === "CheckBox"
              ? Boolean(f.value && f.value !== "Off")
              : f.value || "",
          ]),
        ),
      );
      if (!value.fields.length)
        setError("Este PDF não contém campos interativos de formulário.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMessage("");
    }
  };
  const pdfInput = tool.accept === ".pdf";
  return (
    <FormContext.Provider value={{ options, update, assets, setAsset }}>
      <main className="workspace container">
        <button className="back-link" onClick={onHome}>
          <Icon name="ArrowLeft" size={16} /> Todas as ferramentas
        </button>
        <div className="workspace-heading">
          <span className={`workspace-icon color-${tool.color}`}>
            <Icon name={tool.icon} size={32} />
          </span>
          <div>
            <h1>{tool.name}</h1>
            <p>{tool.description}</p>
          </div>
          <span className="free-badge">
            <Icon name="Gift" size={14} /> Acesso livre
          </span>
        </div>
        {status === "done" && result ? (
          <section className="success-card">
            <div className="success-check">
              <Icon name="Check" size={43} />
            </div>
            <span className="section-kicker">PRONTINHO. DO SEU JEITO.</span>
            <h2>Seu arquivo está pronto!</h2>
            <p>
              {result.count > 1
                ? `${result.count} resultados reunidos em um arquivo ZIP.`
                : "A transformação terminou. Agora é só baixar."}
            </p>
            <a
              className="primary download-button"
              href={downloadUrl}
              download={result.name}
            >
              <Icon name="Download" size={20} /> Baixar{" "}
              {result.count > 1 ? "resultados" : "arquivo"}{" "}
              <span>{formatSize(result.blob.size)}</span>
            </a>
            <div className="result-filename">
              <Icon name="FileCheck2" size={16} />
              {result.name}
            </div>
            <span className="privacy-caption">
              <Icon name={result.local ? "Laptop" : "ShieldCheck"} size={14} />
              {result.local
                ? "Processado no seu dispositivo. Nenhum documento foi enviado."
                : "Processado no servidor. Os arquivos temporários foram removidos ao concluir a resposta."}
            </span>
            <div className="success-actions">
              <button
                className="outline"
                onClick={() => {
                  setStatus("idle");
                  setResult(null);
                }}
              >
                Processar novamente
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setFiles([]);
                  setStatus("idle");
                  setResult(null);
                  input.current?.click();
                }}
              >
                Usar outros arquivos <Icon name="Plus" size={15} />
              </button>
            </div>
            <input
              ref={input}
              hidden
              type="file"
              accept={tool.accept}
              multiple={tool.multiple}
              onChange={(e) => addFiles([...(e.target.files || [])])}
            />
          </section>
        ) : (
          <div className="workspace-grid">
            <section className="file-area">
              <div
                className={`dropzone ${drop ? "drag-active" : ""} ${files.length ? "compact-dropzone" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrop(true);
                }}
                onDragLeave={() => setDrop(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrop(false);
                  if (status !== "running") addFiles([...e.dataTransfer.files]);
                }}
              >
                <span className="dropzone-icon">
                  <Icon
                    name={tool.id === "scan" ? "Camera" : "CloudUpload"}
                    size={35}
                  />
                </span>
                <h2>
                  {files.length
                    ? "Mais um arquivo?"
                    : "Seus arquivos começam aqui."}
                </h2>
                <p>
                  {files.length
                    ? "Arraste para adicionar ou selecione abaixo."
                    : "Arraste e solte aqui, ou escolha no seu dispositivo."}
                </p>
                <button
                  className="primary"
                  disabled={status === "running"}
                  onClick={() => input.current?.click()}
                >
                  <Icon name="Plus" size={18} />{" "}
                  {tool.id === "scan"
                    ? "Adicionar fotos"
                    : "Selecionar arquivos"}
                </button>
                <input
                  ref={input}
                  hidden
                  type="file"
                  accept={tool.accept}
                  multiple={tool.multiple}
                  capture={tool.id === "scan" ? "environment" : undefined}
                  onChange={(e) => {
                    addFiles([...(e.target.files || [])]);
                    e.currentTarget.value = "";
                  }}
                />
                <small>
                  {tool.accept
                    .replaceAll(".", "")
                    .replaceAll(",", " · ")
                    .toUpperCase()}
                  {!tool.multiple && " · Um arquivo por vez"}
                </small>
              </div>
              {files.length > 0 && (
                <>
                  <div className="file-list-heading">
                    <strong>
                      {files.length}{" "}
                      {files.length === 1
                        ? "arquivo selecionado"
                        : "arquivos selecionados"}
                    </strong>
                    <span>
                      {formatSize(files.reduce((sum, f) => sum + f.size, 0))}
                    </span>
                  </div>
                  <div className="file-list">
                    {files.map((file, i) => (
                      <div
                        className="file-row"
                        key={`${file.name}-${i}`}
                        draggable={status !== "running"}
                        onDragStart={() => (dragIndex.current = i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex.current === null) return;
                          const from = dragIndex.current;
                          setFiles((list) => {
                            const next = [...list];
                            const [item] = next.splice(from, 1);
                            next.splice(i, 0, item);
                            return next;
                          });
                          dragIndex.current = null;
                        }}
                      >
                        <Icon
                          name="GripVertical"
                          className="file-grip"
                          size={17}
                        />
                        <span className={`file-type color-${tool.color}`}>
                          <Icon
                            name={
                              file.type.startsWith("image/")
                                ? "Image"
                                : "FileText"
                            }
                            size={21}
                          />
                        </span>
                        <div>
                          <strong title={file.name}>{file.name}</strong>
                          <small>{formatSize(file.size)}</small>
                        </div>
                        {files.length > 1 && (
                          <span className="file-move">
                            <button
                              disabled={i === 0 || status === "running"}
                              onClick={() => move(i, -1)}
                              aria-label={`Mover ${file.name} para cima`}
                            >
                              <Icon name="ChevronUp" size={14} />
                            </button>
                            <button
                              disabled={
                                i === files.length - 1 || status === "running"
                              }
                              onClick={() => move(i, 1)}
                              aria-label={`Mover ${file.name} para baixo`}
                            >
                              <Icon name="ChevronDown" size={14} />
                            </button>
                          </span>
                        )}
                        <button
                          className="remove-file"
                          disabled={status === "running"}
                          onClick={() =>
                            setFiles((current) =>
                              current.filter((_, index) => index !== i),
                            )
                          }
                          aria-label={`Remover ${file.name}`}
                        >
                          <Icon name="X" size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {["merge", "jpg-pdf", "scan"].includes(tool.id) && (
                    <p className="file-order-hint">
                      <Icon name="GripVertical" size={14} /> Arraste os arquivos
                      para mudar a ordem.
                    </p>
                  )}
                  <FilePreview
                    file={files[0]}
                    password={options.password || ""}
                    tool={tool.id}
                    onBox={(box) => update("boxes", [box])}
                  />
                </>
              )}
              {!files.length && (
                <div className="empty-file-note">
                  <Icon name="ShieldCheck" size={17} />
                  <div>
                    <strong>Um espaço de confiança.</strong>
                    <p>
                      {local
                        ? "Esta ferramenta processa os arquivos no seu dispositivo."
                        : "O servidor usa arquivos temporários, removidos após o processamento."}
                    </p>
                  </div>
                </div>
              )}
            </section>
            <aside className="options-card">
              <div className="options-title">
                <Icon name="SlidersHorizontal" size={19} />
                <h2>Do seu jeito</h2>
              </div>
              <div className="option-content">
                {tool.note && (
                  <div className="tool-note">
                    <Icon name="Info" size={15} />
                    <p>{tool.note}</p>
                  </div>
                )}
                {tool.id === "merge" && (
                  <div className="simple-option">
                    <Icon name="Combine" size={32} />
                    <h3>Todos juntos, na sua ordem.</h3>
                    <p>
                      Adicione dois ou mais PDFs. A ordem da lista será a ordem
                      do documento final.
                    </p>
                  </div>
                )}
                {tool.id === "split" && (
                  <>
                    <Select
                      id="split_mode"
                      label="Como dividir?"
                      values={[
                        ["pages", "Um arquivo por página"],
                        ["ranges", "Intervalos personalizados"],
                        ["fixed", "Grupos de páginas"],
                        ["extract", "Extrair páginas selecionadas"],
                        ["remove", "Remover páginas selecionadas"],
                      ]}
                    />
                    {options.split_mode === "ranges" && (
                      <Field
                        id="ranges"
                        label="Intervalos"
                        placeholder="1-3;4-6;7-10"
                        hint="Separe os grupos com ponto e vírgula."
                      />
                    )}
                    {options.split_mode === "fixed" && (
                      <Field
                        id="group_size"
                        label="Páginas por grupo"
                        type="number"
                        min={1}
                      />
                    )}
                  </>
                )}
                {tool.id === "compress" && (
                  <label className="option-field">
                    <span>Nível de compressão</span>
                    <div className="compression-options">
                      {[
                        ["low", "Mais qualidade", "Redução suave"],
                        ["recommended", "Equilibrado", "Nossa sugestão"],
                        ["extreme", "Mais leve", "Pode reduzir a qualidade"],
                      ].map(([value, title, desc]) => (
                        <button
                          key={value}
                          className={options.level === value ? "chosen" : ""}
                          onClick={() => update("level", value)}
                        >
                          <span className="radio-circle" />
                          <span>
                            <strong>{title}</strong>
                            <small>{desc}</small>
                          </span>
                          {value === "recommended" && (
                            <Icon name="Sparkles" size={15} />
                          )}
                        </button>
                      ))}
                    </div>
                  </label>
                )}
                {tool.id === "organize" && (
                  <Field
                    id="order"
                    label="Ordem das páginas"
                    placeholder="3,1,2,4-6"
                    hint="Liste na ordem desejada. Repita um número para duplicar e omita para remover. Vazio mantém a ordem original."
                  />
                )}
                {tool.id === "rotate" && (
                  <Select
                    id="angle"
                    label="Girar páginas"
                    values={[
                      ["90", "90° para a direita"],
                      ["180", "180°"],
                      ["270", "90° para a esquerda"],
                    ]}
                  />
                )}
                {["jpg-pdf", "scan"].includes(tool.id) && (
                  <>
                    <Select
                      id="paper"
                      label="Tamanho da página"
                      values={[
                        ["a4", "A4"],
                        ["fit", "Ajustar à imagem"],
                      ]}
                    />
                    <Select
                      id="orientation"
                      label="Orientação"
                      values={[
                        ["portrait", "Retrato"],
                        ["landscape", "Paisagem"],
                      ]}
                    />
                    <Field
                      id="margin"
                      label="Margem (pontos)"
                      type="number"
                      min={0}
                      max={100}
                    />
                    {tool.id === "scan" && (
                      <Select
                        id="scan_mode"
                        label="Aparência"
                        values={[
                          ["color", "Colorido"],
                          ["gray", "Escala de cinza"],
                          ["bw", "Preto e branco"],
                        ]}
                      />
                    )}
                  </>
                )}
                {tool.id === "protect" && (
                  <Field
                    id="new_password"
                    label="Nova senha de abertura"
                    type="password"
                    placeholder="Pelo menos 4 caracteres"
                  />
                )}
                {tool.id === "crop" && (
                  <Field
                    id="crop_margin"
                    label="Remover margem de cada lado (pontos)"
                    type="number"
                    min={0}
                    max={200}
                    hint="72 pontos equivalem a aproximadamente 2,54 cm."
                  />
                )}
                {tool.id === "pdf-jpg" && (
                  <>
                    <Select
                      id="image_mode"
                      label="O que transformar?"
                      values={[
                        ["pages", "Converter páginas em JPG"],
                        ["extract", "Extrair imagens incorporadas (servidor)"],
                      ]}
                    />
                    <Select
                      id="dpi"
                      label="Resolução"
                      values={[
                        ["100", "100 DPI · mais leve"],
                        ["150", "150 DPI · equilibrado"],
                        ["300", "300 DPI · alta resolução"],
                      ]}
                    />
                  </>
                )}
                {["edit", "watermark", "sign"].includes(tool.id) && (
                  <>
                    <Area
                      id="text"
                      label={
                        tool.id === "sign"
                          ? "Ou digite sua assinatura"
                          : "Seu texto"
                      }
                      placeholder={
                        tool.id === "watermark"
                          ? "Ex.: CONFIDENCIAL"
                          : "Escreva aqui…"
                      }
                    />
                    {tool.id === "sign" ? (
                      <>
                        <SignaturePad
                          onChange={(file) => setAsset("signature", file)}
                        />
                        <Asset
                          name="signature"
                          label="Ou enviar imagem da assinatura"
                          accept="image/png,image/jpeg"
                        />
                      </>
                    ) : (
                      <Asset
                        name="image"
                        label={
                          tool.id === "watermark"
                            ? "Ou enviar uma marca em imagem"
                            : "Adicionar imagem"
                        }
                        accept="image/png,image/jpeg"
                      />
                    )}
                    <div className="option-columns">
                      <Field
                        id="font_size"
                        label="Tamanho da fonte"
                        type="number"
                        min={6}
                        max={180}
                      />
                      <Field id="color" label="Cor" type="color" />
                    </div>
                    {tool.id === "watermark" ? (
                      <Field
                        id="opacity"
                        label="Opacidade (%)"
                        type="number"
                        min={5}
                        max={100}
                      />
                    ) : (
                      <div className="option-columns">
                        <Field
                          id="x"
                          label="Posição X (%)"
                          type="number"
                          min={0}
                          max={95}
                        />
                        <Field
                          id="y"
                          label="Posição Y (%)"
                          type="number"
                          min={0}
                          max={95}
                        />
                      </div>
                    )}
                    {tool.id === "edit" && (
                      <Field
                        id="find"
                        label="Substituir texto existente (servidor)"
                        placeholder="Texto exato que será removido"
                        hint="O novo texto será o digitado acima. Confira a prévia do resultado."
                      />
                    )}
                  </>
                )}
                {tool.id === "pagenumber" && (
                  <>
                    <Select
                      id="position"
                      label="Posição"
                      values={[
                        ["bottom", "Centro inferior"],
                        ["top", "Centro superior"],
                      ]}
                    />
                    <Field
                      id="start"
                      label="Começar em"
                      type="number"
                      min={0}
                    />
                    <Field
                      id="format"
                      label="Formato"
                      placeholder="{n} / {total}"
                      hint="{n} é o número; {total} é a quantidade de páginas."
                    />
                  </>
                )}
                {tool.id === "redact" && (
                  <>
                    <Area
                      id="redact_text"
                      label="Texto a remover"
                      placeholder="Um termo por linha"
                    />
                    <p className="option-help">
                      Você também pode marcar uma área na prévia.
                    </p>
                    {options.boxes?.length > 0 && (
                      <div className="selection-status">
                        <Icon name="Check" size={15} /> Região na página{" "}
                        {options.boxes[0].page} selecionada
                        <button onClick={() => update("boxes", [])}>
                          Limpar
                        </button>
                      </div>
                    )}
                  </>
                )}
                {tool.id === "ocr" && (
                  <Select
                    id="language"
                    label="Idiomas do documento"
                    values={[
                      ["por+eng", "Português e inglês"],
                      ["por", "Português"],
                      ["eng", "Inglês"],
                      ["spa", "Espanhol"],
                    ]}
                  />
                )}
                {tool.id === "extract" && (
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={Boolean(options.detailed)}
                      onChange={(e) => update("detailed", e.target.checked)}
                    />
                    Incluir coordenadas e dimensões (JSON)
                  </label>
                )}
                {tool.id === "summarize" && (
                  <>
                    <Field
                      id="sentences"
                      label="Quantidade de frases"
                      type="number"
                      min={1}
                      max={40}
                    />
                    <Select
                      id="output"
                      label="Baixar como"
                      values={[
                        ["pdf", "Documento PDF"],
                        ["txt", "Texto (.txt)"],
                      ]}
                    />
                  </>
                )}
                {tool.id === "smart-split" && (
                  <Field
                    id="keyword"
                    label="Texto que inicia cada seção"
                    placeholder="Ex.: Capítulo"
                    hint="Cada página que contém esse texto inicia uma nova parte."
                  />
                )}
                {tool.id === "translate" && (
                  <>
                    <Select
                      id="from"
                      label="Idioma original"
                      values={[
                        ["en", "Inglês"],
                        ["pt", "Português"],
                        ["es", "Espanhol"],
                      ]}
                    />
                    <Select
                      id="to"
                      label="Traduzir para"
                      values={[
                        ["pt", "Português"],
                        ["en", "Inglês"],
                        ["es", "Espanhol"],
                      ]}
                    />
                    {!capabilities?.translation_pairs?.length && (
                      <div className="engine-warning">
                        <Icon name="Info" size={16} />
                        <p>
                          Os modelos de tradução ainda precisam ser instalados
                          no servidor. Esta ferramenta não estará disponível até
                          essa configuração.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {tool.id === "validate-pdfa" && !capabilities?.verapdf && (
                  <div className="engine-warning">
                    <Icon name="Info" size={16} />
                    <p>
                      O validador veraPDF ainda precisa ser instalado no
                      servidor. A validação completa não será simulada.
                    </p>
                  </div>
                )}
                {tool.id === "certificate" && (
                  <>
                    <Asset
                      name="certificate"
                      label="Selecionar certificado PFX ou P12"
                      accept=".pfx,.p12"
                    />
                    <Field
                      id="certificate_password"
                      label="Senha do certificado"
                      type="password"
                    />
                    <Field
                      id="reason"
                      label="Motivo da assinatura"
                      placeholder="Assinatura digital"
                    />
                  </>
                )}
                {tool.id === "html-pdf" && (
                  <Area
                    id="html"
                    label="Ou cole seu HTML"
                    placeholder={"<h1>Meu documento</h1>\n<p>Olá, mundo!</p>"}
                  />
                )}
                {tool.id === "forms" && (
                  <>
                    <button
                      className="outline full-width"
                      disabled={!files.length}
                      onClick={inspectFields}
                    >
                      <Icon name="ScanSearch" size={16} /> Encontrar campos
                    </button>
                    {fields.map((field) =>
                      field.type === "CheckBox" ? (
                        <label key={field.name} className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={!!options.fields[field.name]}
                            onChange={(e) =>
                              update("fields", {
                                ...options.fields,
                                [field.name]: e.target.checked,
                              })
                            }
                          />
                          {field.name}
                        </label>
                      ) : (
                        <label className="option-field" key={field.name}>
                          <span>{field.name}</span>
                          {field.choices.length ? (
                            <select
                              value={options.fields[field.name] || ""}
                              onChange={(e) =>
                                update("fields", {
                                  ...options.fields,
                                  [field.name]: e.target.value,
                                })
                              }
                            >
                              {field.choices.map((v: string) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={options.fields[field.name] || ""}
                              onChange={(e) =>
                                update("fields", {
                                  ...options.fields,
                                  [field.name]: e.target.value,
                                })
                              }
                            />
                          )}
                        </label>
                      ),
                    )}
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={!!options.flatten}
                        onChange={(e) => update("flatten", e.target.checked)}
                      />
                      Fixar valores no PDF final
                    </label>
                  </>
                )}
                {pdfInput &&
                  ![
                    "merge",
                    "organize",
                    "translate",
                    "summarize",
                    "smart-split",
                    "compare",
                    "certificate",
                    "validate-pdfa",
                    "pdfa",
                    "forms",
                    "repair",
                  ].includes(tool.id) && (
                    <Field
                      id="pages"
                      label={
                        tool.id === "split" && options.split_mode === "remove"
                          ? "Páginas para remover"
                          : "Páginas"
                      }
                      placeholder="Todas · ou 1,3,5-8"
                      hint="Deixe vazio para aplicar a todas."
                    />
                  )}
                {pdfInput && (
                  <details className="advanced-options">
                    <summary>
                      Mais opções <Icon name="ChevronDown" size={14} />
                    </summary>
                    <Field
                      id="password"
                      label="Senha do PDF, se houver"
                      type="password"
                      placeholder="Senha de abertura"
                    />
                    {localTools.has(tool.id) &&
                      (!capabilities?.server_tools ||
                        capabilities.server_tools.includes(tool.id)) && (
                        <label className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={useServer}
                            onChange={(e) => setUseServer(e.target.checked)}
                          />
                          Processar no servidor
                        </label>
                      )}
                    <p>
                      Use o servidor para recursos adicionais. Na Vercel,
                      uploads têm limite total de 4 MB.
                    </p>
                  </details>
                )}
              </div>
              <div className="process-area">
                {error && (
                  <div className="error-message" role="alert">
                    <Icon name="CircleAlert" size={18} />
                    <p>{error}</p>
                  </div>
                )}
                <button
                  className="primary process-button"
                  disabled={
                    status === "running" ||
                    (tool.id === "translate" &&
                      !capabilities?.translation_pairs?.length) ||
                    (tool.id === "validate-pdfa" && !capabilities?.verapdf)
                  }
                  onClick={start}
                >
                  {status === "running" ? (
                    <>
                      <Icon name="LoaderCircle" size={19} className="spin" />{" "}
                      Processando…
                    </>
                  ) : (
                    <>
                      {tool.name}
                      <Icon name="ArrowRight" size={18} />
                    </>
                  )}
                </button>
                {status === "running" ? (
                  <div className="processing-state" role="status">
                    <div className="indeterminate-bar" />
                    <p>{message}</p>
                    <small>Mantenha esta página aberta.</small>
                  </div>
                ) : (
                  <div className="processing-caption">
                    <Icon name={local ? "Laptop" : "Server"} size={14} />
                    <span>
                      {local
                        ? "Neste dispositivo · sem upload"
                        : "Servidor · arquivos temporários"}
                    </span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
        <div className="related-tools">
          <h3>Seu próximo passo pode ser…</h3>
          <div>
            {catalog
              .filter((t) => t.category === tool.category && t.id !== tool.id)
              .slice(0, 4)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => onNavigate(t.id)}
                  className={`color-${t.color}`}
                >
                  <span className="related-icon">
                    <Icon name={t.icon} size={20} />
                  </span>
                  {t.name}
                  <Icon name="ArrowRight" size={15} />
                </button>
              ))}
          </div>
        </div>
      </main>
    </FormContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
