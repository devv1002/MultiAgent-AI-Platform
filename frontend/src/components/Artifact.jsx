import { Check, Code2, Copy, Eye, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { AnimatePresence, easeInOut, motion } from "motion/react"
import Editor from '@monaco-editor/react';

function buildPreviewDoc(files = []) {
  if (!files || files.length === 0) return "";

  const htmlFile = files.find(f => f.name === "index.html") || files.find(f => f.name.endsWith(".html"));
  const cssFiles = files.filter(f => f.name.endsWith(".css"));
  const jsFiles = files.filter(f => f.name.endsWith(".js") || f.name.endsWith(".jsx"));

  const rawHtml = htmlFile?.content || (jsFiles.length > 0 ? '<div id="root"></div>' : '');
  const combinedCss = cssFiles.map(f => f.content).join("\n");

  const primaryJsFile = files.find(f => f.name === "script.js") || jsFiles[0];
  const combinedJs = primaryJsFile ? primaryJsFile.content : jsFiles.map(f => f.content).join("\n");

  // Strip relative CSS and JS links so the sandboxed iframe never makes network requests for them
  let cleanedHtml = rawHtml
    .replace(/<link\s+[^>]*href=["'](?!(?:https?:|\/\/|data:))[^"']+\.css["'][^>]*\/?>/gi, '')
    .replace(/<script\s+[^>]*src=["'](?!(?:https?:|\/\/|data:))[^"']+\.(?:js|jsx)["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\s+[^>]*src=["'](?!(?:https?:|\/\/|data:))[^"']+\.(?:js|jsx)["'][^>]*\/?>/gi, '');

  const hasJsx = /<[A-Za-z][\s\S]*>/.test(combinedJs);
  const mentionsReact = combinedJs.includes("React") || combinedJs.includes("ReactDOM") || combinedJs.includes("useState") || combinedJs.includes("useEffect");
  const htmlHasReact = /react(?:\.development|\.production|\.min)?\.js/i.test(cleanedHtml);
  const htmlHasBabel = /babel(?:\.min)?\.js/i.test(cleanedHtml);

  const needsReact = hasJsx || mentionsReact || htmlHasReact;
  const needsBabel = hasJsx || htmlHasBabel;

  let cdns = "";
  if (needsReact && !htmlHasReact) {
    cdns += '\n<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin="anonymous"></script>\n<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin="anonymous"></script>';
  }
  if (needsBabel && !htmlHasBabel) {
    cdns += '\n<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>';
  }

  const styleAndCdnBlock = `
${cdns}
<style id="__cortex_injected_styles__">
${combinedCss}
</style>
`;

  // Safely embed JS as JSON so it does not interfere with HTML parsing
  const safeScriptData = JSON.stringify({ code: combinedJs }).replace(/<\/script/gi, '<\\/script');

  const runnerScript = `
<script type="application/json" id="__cortex_script_data__">
${safeScriptData}
</script>
<script>
(function() {
  function displayError(title, err) {
    console.error("[CortexAI Preview Error]", err);
    var overlay = document.getElementById('__cortex_error_overlay__');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '__cortex_error_overlay__';
      overlay.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;max-height:85vh;overflow:auto;z-index:999999;background:#18181b;border:1px solid #ef4444;border-radius:8px;padding:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;';
      document.body.appendChild(overlay);
    }
    var msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    overlay.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<strong style="color:#ef4444;font-size:14px;">' + title + '</strong>' +
        '<button onclick="this.parentElement.parentElement.remove()" style="background:#27272a;border:none;color:#a1a1aa;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">Dismiss</button>' +
      '</div>' +
      '<pre style="color:#fca5a5;font-size:12px;white-space:pre-wrap;margin:0;line-height:1.4;">' +
        msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '</pre>';
  }

  window.addEventListener('error', function(event) {
    displayError('Runtime Error', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', function(event) {
    displayError('Unhandled Promise Rejection', event.reason);
  });

  function start() {
    try {
      var dataEl = document.getElementById('__cortex_script_data__');
      if (!dataEl) return;
      var raw = JSON.parse(dataEl.textContent).code || "";
      if (!raw.trim()) return;

      // Translate ES module imports for React into global variables
      raw = raw
        .replace(/import\\s+React\\s*,\\s*\\{\\s*([^}]+)\\s*\\}\\s*from\\s*['"]react['"];?/g, 'const { $1 } = React;')
        .replace(/import\\s+\\{\\s*([^}]+)\\s*\\}\\s*from\\s*['"]react['"];?/g, 'const { $1 } = React;')
        .replace(/import\\s+React\\s+from\\s*['"]react['"];?/g, 'const React = window.React;')
        .replace(/import\\s+ReactDOM\\s+from\\s*['"]react-dom(?:\\/client)?['"];?/g, 'const ReactDOM = window.ReactDOM;');

      var hasJSX = /<[A-Za-z][\\s\\S]*>/.test(raw);
      var isReact = hasJSX || raw.includes('React.') || raw.includes('ReactDOM') || raw.includes('useState');

      // Ensure root container exists for React if not already present
      if (isReact && !document.getElementById('root') && !document.getElementById('app')) {
        var rootDiv = document.createElement('div');
        rootDiv.id = 'root';
        document.body.appendChild(rootDiv);
      }

      var finalCode = raw;

      if (hasJSX || (window.Babel && isReact)) {
        if (!window.Babel) {
          throw new Error("Babel standalone is required to compile JSX, but was not found.");
        }
        var transformed = window.Babel.transform(raw, {
          presets: [['react', { runtime: 'classic' }]]
        });
        finalCode = transformed.code;
      }

      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.text = finalCode;
      document.body.appendChild(script);
    } catch (err) {
      displayError('Compilation / Execution Error', err);
    }
  }

  var isReactNeeded = ${needsReact};
  var isBabelNeeded = ${needsBabel};

  if (!isReactNeeded && !isBabelNeeded) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  } else {
    var maxWait = 10000;
    var startTime = Date.now();
    function checkDependencies() {
      var reactReady = !isReactNeeded || (window.React && window.ReactDOM);
      var babelReady = !isBabelNeeded || window.Babel;

      if (reactReady && babelReady) {
        start();
      } else if (Date.now() - startTime > maxWait) {
        displayError('Dependency Load Timeout', new Error('Timeout: React or Babel failed to load from CDN. Please check network connectivity.'));
      } else {
        setTimeout(checkDependencies, 30);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkDependencies);
    } else {
      checkDependencies();
    }
  }
})();
</script>
`;

  const isFullDoc = /<!DOCTYPE/i.test(cleanedHtml) || /<html/i.test(cleanedHtml);
  let finalDoc = cleanedHtml;

  if (isFullDoc) {
    if (/<\/head>/i.test(finalDoc)) {
      finalDoc = finalDoc.replace(/<\/head>/i, `${styleAndCdnBlock}\n</head>`);
    } else if (/<body/i.test(finalDoc)) {
      finalDoc = finalDoc.replace(/<body/i, `${styleAndCdnBlock}\n<body`);
    } else {
      finalDoc = `${styleAndCdnBlock}\n${finalDoc}`;
    }

    if (/<\/body>/i.test(finalDoc)) {
      finalDoc = finalDoc.replace(/<\/body>/i, `${runnerScript}\n</body>`);
    } else {
      finalDoc = `${finalDoc}\n${runnerScript}`;
    }
  } else {
    finalDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${styleAndCdnBlock}
</head>
<body>
  ${cleanedHtml}
  ${runnerScript}
</body>
</html>`;
  }

  return finalDoc;
}

function Artifact() {
  const [collapsed, setCollapsed] = useState(false)
  const { artifacts = [] } = useSelector(state => state.message || {})
  const [tab, setTab] = useState("code")
  const [activeFile, setActiveFile] = useState(0)
  const [copied, setCopied] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const currentArtifact = artifacts && artifacts.length > 0 ? artifacts[0] : null
  const files = currentArtifact?.files

  const previewDoc = useMemo(() => {
    if (!files || files.length === 0) return ""
    return buildPreviewDoc(files)
  }, [files])

  if (!currentArtifact || !files || files.length === 0) {
    return null
  }

  const file = files[activeFile] || files[0] || null
  const htmlFile = files.find(f => f?.name === "index.html" || f?.name?.endsWith(".html"))
  const jsFile = files.find(f => f?.name === "script.js" || f?.name?.endsWith(".js") || f?.name?.endsWith(".jsx"))

  const canPreview = Boolean(htmlFile || jsFile)

  const handleCopy = async () => {
    if (!file?.content) return
    await navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const detectLanguage = (fileName = "") => {
    const name = fileName.toLowerCase()

    if (name.endsWith(".html"))
      return "html";

    if (name.endsWith(".css"))
      return "css";

    if (name.endsWith(".js"))
      return "javascript";

    if (name.endsWith(".jsx"))
      return "javascript";

    if (name.endsWith(".ts"))
      return "typescript";

    if (name.endsWith(".tsx"))
      return "typescript";

    if (name.endsWith(".json"))
      return "json";

    if (name.endsWith(".py"))
      return "python";

    if (name.endsWith(".java"))
      return "java";

    if (name.endsWith(".cpp"))
      return "cpp";

    if (name.endsWith(".c"))
      return "c";

    return "plaintext";

  }

  const renderPanelContent = (onClose) => {
    return (
      <>
        {!collapsed ? <div className='flex flex-col h-full bg-[#0d0f14]'>
          <div className='h-14 px-4 border-b border-white/6 flex items-center gap-3 shrink-0'>
            <button className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0' onClick={onClose ?? (() => setCollapsed(true))}>
              {onClose?<X size={15}/>:<PanelRightClose size={16} />}
            </button>
            <div className='flex items-center gap-2 flex-1 min-w-0'>
              <div className='flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 shrink-0'>
                <Code2 className="text-indigo-400" size={12} />
              </div>
              <div className='text-[13px] font-medium text-slate-200 truncate'>{currentArtifact?.title || "Artifact"}</div>
            </div>

            <div className='flex items-center gap-1 shrink-0'>
              <button
                onClick={handleCopy}
                className='flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-lg transition-colors duration-150 bg-transparent border-none cursor-pointer'
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>

            {canPreview && <div className='flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] p-1 rounded-lg'>
              <button
                onClick={() => setTab("code")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150
            ${tab === "code" ? "bg-indigo-500 text-white" : "text-slate-500 hover:text-slate-200"}`}
              >
                <Code2 size={11} /> Code
              </button>
              <button
                onClick={() => setTab("preview")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150
                  ${tab === "preview" ? "bg-indigo-500 text-white" : "text-slate-500 hover:text-slate-200"}`}
              >
                <Eye size={11} /> Preview
              </button>
            </div>}

          </div>

          {tab === "code" && <div className='flex h-auto border-b border-white/[0.06] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0'>
            {
              files.map((f, index) => (
                <button
                  key={f?.name ? `file-${f.name}-${index}` : `file-idx-${index}`}
                  onClick={() => setActiveFile(index)}
                  className={`px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 border-r border-white/[0.05] relative cursor-pointer bg-transparent   ${activeFile === index ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {f?.name || `File ${index + 1}`}
                  {activeFile === index && <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full' />}

                </button>
              ))
            }
          </div>}


          <div className='flex-1 overflow-hidden'>
            {(tab == "preview" && canPreview) ? <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className='w-full h-full'
            >
              <iframe title='preview' srcDoc={previewDoc} sandbox='allow-scripts allow-forms allow-modals' className='w-full h-full bg-white' />
            </motion.div>
              :
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className='w-full h-full'
              >
                <Editor
                  theme='vs-dark'
                  language={detectLanguage(file?.name || "")}
                  value={file?.content || ""}
                  options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 16 }, lineNumbers: "on", renderLineHighlight: "none" }}

                />

              </motion.div>
            }

          </div>


        </div> :
          <div className='hidden lg:flex h-full border-l border-white/[0.06] bg-[#0d0f14] flex-col items-center py-4 gap-3 shrink-0'>
            <button className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0' onClick={() => setCollapsed(false)}>
              <PanelRightOpen size={16} />
            </button>
            <div className='flex items-center gap-2 flex-1 min-w-0'>
              <div
                className='text-[10px] font-medium text-slate-600 tracking-widest uppercase whitespace-nowrap'
                style={{
                  writingMode: "vertical-lr",
                  transform: "rotate(180deg)"
                }}
              >{currentArtifact?.title || "Artifact"}</div>
            </div>
          </div>}
      </>
    )
  }

  return (
    <>

      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium shadow-lg shadow-indigo-500/20 border-none cursor-pointer transition-colors duration-150"

      >
        <Code2 size={13} />
        View Code
      </button>
      <AnimatePresence>
        {mobileOpen && <>
          <motion.div key="mobile-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

          <motion.div key="mobile-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.25, ease: "easeInOut" }} className="lg:hidden fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[420px] border-l border-white/[0.06] overflow-hidden">
            {renderPanelContent(() => setMobileOpen(false))}
          </motion.div>

        </>
        }

      </AnimatePresence>

      <motion.div
        initial={{ width: 400 }}
        animate={{ width: collapsed ? 48 : 400 }}
        transition={{
          duration: 0.25,
          ease: easeInOut
        }}
        className='hidden lg:flex h-full border border-white/6 flex-col overflow-hidden shrink-0'>

        {renderPanelContent()}

      </motion.div>
    </>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { buildPreviewDoc }
export default Artifact
