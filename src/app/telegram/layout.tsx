export default function TelegramLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* 
              In a real Telegram App, we might load the script here or use a hook.
              For now, we just ensure a clean layout.
             */}
            <script src="https://telegram.org/js/telegram-web-app.js" async />
            {children}
        </div>
    )
}
