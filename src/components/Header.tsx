export function Header() {
  return (
    <header className="sticky top-0 z-50 glass border-b border-indigo-500/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold">
            НП
          </div>
          <div>
            <h1 className="font-display font-bold text-white text-base leading-tight">НейроПортрет</h1>
            <p className="text-xs text-slate-500">Тест постов · Удмуртия</p>
          </div>
        </div>
        <span className="text-xs text-slate-500 hidden sm:block">Вожкы озон — проверьте текст до публикации</span>
      </div>
    </header>
  )
}