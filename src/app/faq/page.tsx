"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/hook";

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function FaqPage() {
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
          <h1 className="text-2xl font-bold">{t("faq.title")}</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-6">
            {QUESTIONS.map((n) => (
              <div key={n}>
                <h2 className="font-semibold mb-1">{t(`faq.q${n}`)}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {t(`faq.a${n}`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
