/* Isolated, one-operation Emscripten runtime. No documents leave this worker. */
self.onmessage = async ({ data }) => {
  const { engine, files, args } = data
  try {
    importScripts(`/engines/${engine}/${engine}.js`)
    const messages = []
    const runtime = await Module({
      noInitialRun: true,
      locateFile: (name) => `/engines/${engine}/${name}`,
      print: (text) => messages.push(String(text)),
      printErr: (text) => messages.push(String(text)),
    })
    for (const file of files) runtime.FS.writeFile(`/${file.name}`, new Uint8Array(file.data))
    let code = 0
    try { code = runtime.callMain(args) || 0 } catch (error) { if (error.status !== 0) throw error }
    if (code !== 0 && !(engine === 'qpdf' && code === 3)) throw new Error(messages.slice(-6).join('\n') || 'Falha de processamento.')
    const bytes = runtime.FS.readFile('/output.pdf')
    self.postMessage({ data: bytes }, [bytes.buffer])
  } catch (error) { self.postMessage({ error: error.message || String(error) }) }
}
