import Link from "next/link";
import { getPublicSettings } from "@/lib/publicData";

function socialInfo(value: string | null | undefined, fallbackUsername: string, baseUrl: string) {
  const raw = (value || "").trim();

  if (raw.startsWith("https://")) {
    const username = raw.split("/").pop()?.replace(/^@/, "") || fallbackUsername;
    return { href: raw, label: `@${username}` };
  }

  const username = raw.replace(/^@/, "");
  const joiner = baseUrl.endsWith("/") || baseUrl.endsWith("@") ? "" : "/";

  if (/^[a-zA-Z0-9_.-]{2,40}$/.test(username)) {
    return { href: `${baseUrl}${joiner}${username}`, label: `@${username}` };
  }

  return { href: `${baseUrl}${joiner}${fallbackUsername}`, label: `@${fallbackUsername}` };
}

function telegramInfo(value: string | null | undefined) {
  return { href: "https://t.me/Theziess", label: "@Theziess" };
}

function tiktokInfo(value: string | null | undefined) {
  return { href: "https://www.tiktok.com/@theziess", label: "@theziess" };
}

export default async function Footer() {
  const settings = await getPublicSettings();
  const telegram = telegramInfo(settings.supportTelegram);
  const tiktok = tiktokInfo(settings.supportTikTok);
  const supportEmail = settings.supportEmail && !settings.supportEmail.toLowerCase().includes("dytopup")
    ? settings.supportEmail
    : "support@theziessstore.com";

  return (
    <footer className="relative border-t-2 border-pink-200 bg-white">
      <div className="h-2 w-full" style={{ background: "linear-gradient(90deg,#9333EA,#C084FC,#9333EA)" }} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.logoUrl || "/theziessstore-logo.png"}
                alt="TheziessStore Logo"
                width={56}
                height={40}
                className="h-9 w-auto object-contain drop-shadow-sm"
              />
              <span className="font-display text-lg font-extrabold text-pink-800">
                Theziess<span className="text-pink-500">Store</span>
              </span>
            </div>
            <p className="text-xs text-pink-600 leading-relaxed font-medium">
              ការបញ្ចូលទឹកប្រាក់ហ្គេមលឿនបំផុតនៅកម្ពុជា។ ការដឹកជញ្ជូនភ្លាមៗ ការទូទាត់មានសុវត្ថិភាព។
            </p>
            <div className="flex gap-2 mt-3">
              <a
                href={telegram.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-pink-200 bg-pink-50 text-pink-500 transition-all hover:border-pink-400 hover:bg-pink-100 hover:text-pink-700"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.349.88 2.252 2.252 0 0 0 .28 4.402l1.504.308c.256.053.515.068.78.044l.85-.082 1.65 4.78c.114.332.415.554.764.554h.43c.35 0 .65-.222.764-.556l.908-2.636 4.354 3.226a2.24 2.24 0 0 0 3.345-1.09l3.12-9.545a2.253 2.253 0 0 0-.8-2.44z" />
                </svg>
              </a>
              <a
                href={tiktok.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-pink-200 bg-pink-50 text-pink-500 transition-all hover:border-pink-400 hover:bg-pink-100 hover:text-pink-700 text-xs font-bold"
              >
                ♪
              </a>
            </div>
          </div>

          {/* Quick Links Column (Left) */}
          <div className="col-span-1">
            <h4 className="font-extrabold mb-2.5 text-xs uppercase tracking-wider text-pink-600">Quick Links</h4>
            <ul className="space-y-1.5 text-xs">
              {[
                { label: "ទំព័រដើម", href: "/" },
                { label: "ហ្គេមទាំងអស់", href: "/#games" },
                { label: "តាមដានការបញ្ជាទិញ", href: "/order" },
                { label: "FAQ", href: "/faq" },
                { label: "Blog", href: "/blog" },
              ].map((it) => (
                <li key={it.label}>
                  <Link href={it.href} className="text-pink-800/85 transition-colors hover:text-pink-600 font-semibold inline-block py-0.5">
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Payment & Support */}
          <div className="col-span-1 lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Payment */}
            <div>
              <h4 className="font-extrabold mb-2.5 text-xs uppercase tracking-wider text-pink-600">ការទូទាត់</h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <span className="text-pink-800/85 font-semibold inline-block py-0.5">
                    KHQR
                  </span>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-extrabold mb-2.5 text-xs uppercase tracking-wider text-pink-600">ជំនួយ</h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a href={telegram.href} target="_blank" rel="noopener noreferrer" className="text-pink-800/85 transition-colors hover:text-pink-600 font-semibold inline-block py-0.5">
                    Telegram: {telegram.label}
                  </a>
                </li>
                <li>
                  <a
                    href={tiktok.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-800/85 transition-colors hover:text-pink-600 font-semibold inline-block py-0.5"
                  >
                    TikTok: {tiktok.label}
                  </a>
                </li>
                {supportEmail && (
                  <li>
                    <a href={`mailto:${supportEmail}`} className="text-pink-800/85 transition-colors hover:text-pink-600 font-semibold inline-block py-0.5 break-all">
                      {supportEmail}
                    </a>
                  </li>
                )}
                <li>
                  <a href={telegram.href} target="_blank" rel="noopener noreferrer" className="text-pink-800/85 transition-colors hover:text-pink-600 font-semibold inline-block py-0.5">
                    សេវាកម្ម ២៤/៧
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section matching user reference screenshot */}
        <div className="mt-8 pt-5 border-t-2 border-pink-100 flex flex-col items-center gap-2 text-center">
          <p className="text-xs font-bold text-pink-600 tracking-wider">ទូទាត់តាមរយៈ</p>
          <span className="flex h-8 w-14 items-center justify-center rounded-lg bg-red-600 text-xs font-black tracking-wider text-white shadow-sm shadow-red-200">
            KHQR
          </span>
          <a
            href="https://t.me/thephal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-pink-600 transition-all hover:-translate-y-0.5 hover:text-pink-800 hover:underline mt-0.5"
          >
            Developed by Sokphal
          </a>
          <Link href="/privacy-policy" className="text-xs text-pink-600 font-semibold hover:text-pink-800 hover:underline transition-colors">
            Terms &amp; Policy
          </Link>
          <p className="text-xs text-pink-400 font-semibold">
            &copy; {new Date().getFullYear()} TheziessStore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
