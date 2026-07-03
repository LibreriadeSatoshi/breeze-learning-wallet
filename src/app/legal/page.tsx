"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useT } from "@/lib/i18n/hook";

const TERMS_SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6"];
const PRIVACY_SECTIONS = ["p1", "p2", "p3", "p4", "p5"];

export default function LegalPage() {
  const t = useT();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t("common.back")}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{t("legal.title")}</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("legal.termsTitle")}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {TERMS_SECTIONS.map((s) => (
              <div key={s}>
                <h3 className="font-medium mb-1">{t(`legal.terms.${s}t`)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(`legal.terms.${s}b`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("legal.privacyTitle")}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {PRIVACY_SECTIONS.map((p) => (
              <div key={p}>
                <h3 className="font-medium mb-1">{t(`legal.privacy.${p}t`)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(`legal.privacy.${p}b`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
