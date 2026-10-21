"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "iconoir-react";
import { useT } from "@/lib/i18n/hook";

const TERMS_SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6"];
const PRIVACY_SECTIONS = ["p1", "p2", "p3", "p4", "p5"];

export default function LegalPage() {
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
        <h1 className="font-serif text-h2 text-heading sm:text-h1">{t("legal.title")}</h1>

        <section className="mt-12">
          <h2 className="border-b-2 border-strong pb-3 font-serif text-h2 text-heading">
            {t("legal.termsTitle")}
          </h2>
          <div className="mt-6 space-y-6">
            {TERMS_SECTIONS.map((s) => (
              <div key={s}>
                <h3 className="font-serif text-h3 text-heading">{t(`legal.terms.${s}t`)}</h3>
                <p className="mt-2 text-body text-fg">{t(`legal.terms.${s}b`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="border-b-2 border-strong pb-3 font-serif text-h2 text-heading">
            {t("legal.privacyTitle")}
          </h2>
          <div className="mt-6 space-y-6">
            {PRIVACY_SECTIONS.map((p) => (
              <div key={p}>
                <h3 className="font-serif text-h3 text-heading">{t(`legal.privacy.${p}t`)}</h3>
                <p className="mt-2 text-body text-fg">{t(`legal.privacy.${p}b`)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
