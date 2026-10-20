"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "iconoir-react";
import { useT } from "@/lib/i18n/hook";

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function FaqPage() {
  const t = useT();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-reading px-4 py-6 sm:px-6 sm:py-12">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="-ml-3 mb-6 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg transition-colors duration-fast hover:bg-raised"
        >
          <ArrowLeft aria-hidden="true" className="h-6 w-6" />
        </button>
        <h1 className="border-b-2 border-strong pb-4 font-serif text-h2 text-heading sm:text-h1">
          {t("faq.title")}
        </h1>

        <div className="divide-y divide-hairline">
          {QUESTIONS.map((n) => (
            <section key={n} className="py-6">
              <h2 className="font-serif text-h3 text-heading">{t(`faq.q${n}`)}</h2>
              <p className="mt-2 whitespace-pre-line text-body text-fg">
                {t(`faq.a${n}`)}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
