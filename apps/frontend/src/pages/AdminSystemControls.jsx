import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/apiClient";
import { toast } from "sonner";
import {
  ShoppingCart,
  Package,
  Radio,
  PlayCircle,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Info,
} from "lucide-react";

const CONTROLS = [
  {
    key: "purchasesEnabled",
    label: "Satış",
    description: "Adayların yeni test paketi satın almasını kontrol eder.",
    disabledMessage: "Satın alma servisleri bakımdadır, lütfen daha sonra tekrar deneyin.",
    icon: ShoppingCart,
    audience: "Adaylar",
    affectedAction: "Yeni satın alma işlemi",
    color: "indigo",
  },
  {
    key: "packageCreationEnabled",
    label: "Paket Oluşturma",
    description: "Eğiticilerin yeni test paketi (soru seti) oluşturmasını kontrol eder.",
    disabledMessage: "Test oluşturma geçici olarak durdurulmuştur.",
    icon: Package,
    audience: "Eğiticiler",
    affectedAction: "Yeni test/paket oluşturma",
    color: "violet",
  },
  {
    key: "testPublishingEnabled",
    label: "Canlı Test",
    description: "Eğiticilerin testlerini yayınlayarak canlıya almasını kontrol eder.",
    disabledMessage: "Test yayınlama geçici olarak durdurulmuştur.",
    icon: Radio,
    audience: "Eğiticiler",
    affectedAction: "Test yayınlama (canlıya alma)",
    color: "amber",
  },
  {
    key: "testAttemptsEnabled",
    label: "Test Başlatma",
    description: "Adayların satın aldıkları paketlerde yeni oturum başlatmasını kontrol eder. Devam eden oturumlar etkilenmez.",
    disabledMessage: "Test başlatma geçici olarak durdurulmuştur.",
    icon: PlayCircle,
    audience: "Adaylar",
    affectedAction: "Yeni test oturumu başlatma",
    color: "rose",
  },
  {
    key: "adPurchasesEnabled",
    label: "Reklam Satın Alma",
    description: "Eğiticilerin kendilerini veya test paketlerini öne çıkarmak için reklam satın almasını kontrol eder.",
    disabledMessage: "Reklam satın alma geçici olarak durdurulmuştur.",
    icon: Megaphone,
    audience: "Eğiticiler",
    affectedAction: "Yeni reklam/öne çıkarma satın alma",
    color: "orange",
  },
];

const COLOR_MAP = {
  indigo: {
    icon: "bg-indigo-50 text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700",
    ring: "ring-indigo-500",
    switch: "bg-indigo-600",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-100 text-violet-700",
    ring: "ring-violet-500",
    switch: "bg-violet-600",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    ring: "ring-amber-500",
    switch: "bg-amber-600",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600",
    badge: "bg-rose-100 text-rose-700",
    ring: "ring-rose-500",
    switch: "bg-rose-600",
  },
  // Reklam kill-switch rengi
  orange: {
    icon: "bg-orange-50 text-orange-600",
    badge: "bg-orange-100 text-orange-700",
    ring: "ring-orange-500",
    switch: "bg-orange-600",
  },
};

function KillSwitch({ control, value, onChange, saving }) {
  const colors = COLOR_MAP[control.color];
  const Icon = control.icon;
  const isEnabled = value;

  return (
    <div
      className={`bg-white rounded-2xl border-2 transition-all duration-200 p-6 ${
        isEnabled ? "border-slate-100" : "border-rose-200 bg-rose-50/30"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-lg">{control.label}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                {control.audience}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{control.description}</p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => onChange(!value)}
          disabled={saving}
          className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.ring} ${
            isEnabled ? colors.switch : "bg-slate-200"
          } disabled:opacity-60 disabled:cursor-wait`}
          aria-pressed={isEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
              isEnabled ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Status bar */}
      <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        isEnabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700 border border-rose-200"
      }`}>
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isEnabled ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <AlertTriangle className="w-4 h-4" />
        )}
        <span className="font-medium">
          {saving
            ? "Kaydediliyor..."
            : isEnabled
            ? "Aktif — " + control.affectedAction + " açık"
            : "DURDURULDU — " + control.affectedAction + " kapalı"}
        </span>
      </div>

      {/* Disabled notice */}
      {!isEnabled && (
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Kullanıcı mesajı:</strong> "{control.disabledMessage}"
          </span>
        </div>
      )}
    </div>
  );
}

export default function AdminSystemControls() {
  const queryClient = useQueryClient();
  const [savingKey, setSavingKey] = useState(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await api.get("/admin/settings");
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch) => {
      const { data } = await api.patch("/admin/settings", patch);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["admin-settings"], (old) => ({ ...old, ...data }));
      // Also invalidate the public service-status cache
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
      const key = Object.keys(variables)[0];
      const ctrl = CONTROLS.find((c) => c.key === key);
      const nowEnabled = variables[key];
      toast.success(
        nowEnabled
          ? `${ctrl?.label} hizmeti yeniden açıldı`
          : `${ctrl?.label} hizmeti durduruldu`,
        { description: nowEnabled ? undefined : "Kullanıcılara uyarı mesajı gösterilecek." }
      );
    },
    onError: () => {
      toast.error("Ayar güncellenemedi");
    },
    onSettled: () => {
      setSavingKey(null);
    },
  });

  const handleToggle = (key, newValue) => {
    setSavingKey(key);
    updateMutation.mutate({ [key]: newValue });
  };

  const allEnabled = CONTROLS.every((c) => settings?.[c.key] !== false);
  const disabledCount = CONTROLS.filter((c) => settings?.[c.key] === false).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Sistem Kontrolleri</h1>
          </div>
          <p className="text-slate-500 mt-2 ml-[52px]">
            Platformdaki hizmetleri geçici olarak durdurabilir ve yeniden etkinleştirebilirsiniz.
            Veri kaybı olmaz; yalnızca yeni işlem başlatma engellenir.
          </p>
        </div>

        {/* Global status badge */}
        {!isLoading && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
              allEnabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {allEnabled ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {allEnabled
              ? "Tüm hizmetler aktif"
              : `${disabledCount} hizmet durduruldu`}
          </div>
        )}
      </div>

      {/* Warning banner when anything is off */}
      {!isLoading && !allEnabled && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div>
            <strong>Aktif durdurma var.</strong> Aşağıdaki hizmetler{" "}
            {disabledCount > 1 ? "şu anda kullanıcılara kapalıdır" : "şu anda kullanıcılara kapalıdır"}.
            Hizmeti yeniden açmak için ilgili kartın anahtarını açık konuma getirin.
          </div>
        </div>
      )}

      {/* Controls */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-4">
          {CONTROLS.map((control) => (
            <KillSwitch
              key={control.key}
              control={control}
              value={settings?.[control.key] !== false}
              onChange={(newVal) => handleToggle(control.key, newVal)}
              saving={savingKey === control.key}
            />
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-3 p-5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-400" />
        <div className="space-y-1">
          <p><strong>Nasıl çalışır?</strong></p>
          <ul className="list-disc list-inside space-y-1 text-slate-500">
            <li>Bir hizmeti durdurmak anlık olarak devreye girer — bekleyen işlemleri kesmez.</li>
            <li>Devam eden test oturumları, aktif satın almalar etkilenmez.</li>
            <li>Kullanıcılar engellenen bir eylemi yapmaya çalışırken ilgili uyarı mesajını görür.</li>
            <li>Yeniden açmak için anahtarı kapatıp açmanız yeterlidir; veri değişmez.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
