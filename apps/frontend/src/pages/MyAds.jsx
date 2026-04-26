/**
 * MyAds (Reklamlarım) sayfası — eğiticinin reklam satın alımlarını,
 * gösterim istatistiklerini ve yeni reklam satın alma formunu sunar.
 *
 * Sekmeler:
 *   - İstatistikler: toplam gösterim, aktif reklam sayısı, son 30 günlük grafik
 *   - Reklamlarım: satın alınan paketlerin durumu (aktif/süresi dolmuş)
 *   - Yeni Reklam Satın Al: TEST veya EDUCATOR türü seçimi
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  TrendingUp,
  Eye,
  Zap,
  ShoppingCart,
  BarChart2,
  CheckCircle,
  Clock,
  User,
  Package,
  Info,
} from "lucide-react";

export default function MyAds() {
  const { user } = useAuth();
  // Aktif sekme: 'stats' | 'purchases' | 'buy'
  const [activeTab, setActiveTab] = useState("stats");
  // Yeni reklam formu alanları
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedTestId, setSelectedTestId]       = useState("");
  const [targetType, setTargetType]               = useState("TEST");
  const queryClient = useQueryClient();

  // Reklam istatistiklerini yükle
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["adStats", user?.id],
    queryFn:  async () => {
      const res = await api.get("/educators/me/ads/stats");
      return res.data;
    },
    enabled: !!user,
    staleTime: 30_000, // 30 saniye — istatistikler fazla sık değişmez
  });

  // Eğiticinin mevcut satın alımlarını yükle
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["adPurchases", user?.id],
    queryFn:  async () => {
      const res = await api.get("/educators/me/ads");
      return res.data?.purchases ?? res.data ?? [];
    },
    enabled: !!user,
  });

  // Satın alınabilir reklam paketlerini yükle (herkese açık endpoint)
  const { data: packages = [] } = useQuery({
    queryKey: ["adPackages"],
    queryFn:  async () => {
      const res = await api.get("/ad-packages");
      return res.data?.packages ?? res.data ?? [];
    },
    staleTime: 5 * 60_000, // 5 dakika — paketler sık değişmez
  });

  // Eğiticinin testlerini yükle (TEST türü seçiminde kullanılır)
  const { data: myTests = [] } = useQuery({
    queryKey: ["myTests", user?.id],
    queryFn:  async () => {
      const res = await api.get("/educators/me/tests");
      return res.data?.tests ?? res.data ?? [];
    },
    enabled: !!user,
  });

  // Yeni reklam satın alma mutation'ı
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const body = { adPackageId: selectedPackageId, targetType };
      if (targetType === "TEST") body.testId = selectedTestId;
      const res = await api.post("/educators/me/ads", body);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Reklam satın alındı! Gösterimlere hemen başlanacak.");
      // Hem stats hem purchases listesini yenile
      queryClient.invalidateQueries({ queryKey: ["adStats"] });
      queryClient.invalidateQueries({ queryKey: ["adPurchases"] });
      setSelectedPackageId("");
      setSelectedTestId("");
      setActiveTab("stats");
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "Satın alma başarısız";
      toast.error(msg);
    },
  });

  // Satın alma formu doğrulaması
  const handlePurchase = () => {
    if (!selectedPackageId) { toast.error("Lütfen bir paket seçin"); return; }
    if (targetType === "TEST" && !selectedTestId) { toast.error("Lütfen öne çıkarmak istediğiniz testi seçin"); return; }
    purchaseMutation.mutate();
  };

  // Yayında olan testleri filtrele (sadece bunlara reklam alınabilir)
  const publishedTests = myTests.filter((t) => t.status === "PUBLISHED" || t.is_published);

  // İstatistik özet kartları için hesaplamalar
  const totalDelivered  = stats?.totals?.totalDelivered  ?? 0;
  const totalRemaining  = stats?.totals?.totalRemaining  ?? 0;
  const activePurchases = stats?.totals?.activePurchases ?? 0;
  const dailyData       = stats?.dailyBreakdown ?? [];

  // Son 7 günlük gösterim toplamı (mini trend göstergesi)
  const last7Days = dailyData.slice(-7).reduce((s, d) => s + d.impressions, 0);

  const tabs = [
    { key: "stats",     label: "İstatistikler", icon: BarChart2 },
    { key: "purchases", label: "Reklamlarım",   icon: Package   },
    { key: "buy",       label: "Yeni Reklam",   icon: ShoppingCart },
  ];

  return (
    <div>
      {/* Sayfa başlığı */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Reklamlarım</h1>
        <p className="text-slate-500 mt-2">
          Testlerinizi ve profilinizi ana sayfada öne çıkartın. Her ana sayfanın %10'u reklam bazlı içerikten oluşur.
        </p>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 mb-8 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── İstatistikler ─── */}
      {activeTab === "stats" && (
        <div className="space-y-8">
          {/* Özet kartlar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-xl">
                    <Eye className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Toplam Gösterim</p>
                    {/* Tüm zamanların toplam teslim edilen gösterimleri */}
                    <p className="text-2xl font-bold text-slate-900">{totalDelivered.toLocaleString("tr-TR")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <Zap className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Aktif Reklam</p>
                    <p className="text-2xl font-bold text-slate-900">{activePurchases}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Son 7 Gün</p>
                    <p className="text-2xl font-bold text-slate-900">{last7Days.toLocaleString("tr-TR")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Son 30 günlük gösterim grafiği (CSS bar chart) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Son 30 Günlük Gösterimler</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <div className="h-32 animate-pulse bg-slate-100 rounded" />
              ) : dailyData.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Henüz gösterim verisi yok</p>
              ) : (
                <div className="flex items-end gap-0.5 h-32">
                  {dailyData.map((d, i) => {
                    // Maksimum değere göre çubuk yüksekliğini normalize et
                    const maxVal = Math.max(...dailyData.map((x) => x.impressions), 1);
                    const pct    = Math.round((d.impressions / maxVal) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="w-full bg-indigo-400 rounded-t hover:bg-indigo-600 transition-colors"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                        {/* Tooltip: gün ve değer */}
                        <span className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          {d.date}: {d.impressions}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Satın alım bazlı detay */}
          {stats?.purchases?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Reklam Başarım Detayı</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {stats.purchases.map((p) => (
                  <div key={p.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Hedef türü ikonu */}
                      <div className={`p-2 rounded-lg ${p.targetType === "EDUCATOR" ? "bg-purple-50" : "bg-indigo-50"}`}>
                        {p.targetType === "EDUCATOR"
                          ? <User className="w-4 h-4 text-purple-600" />
                          : <Package className="w-4 h-4 text-indigo-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">
                          {p.test ? p.test.title : "Profil Öne Çıkarma"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.packageName} · {format(new Date(p.validUntil), "d MMM yyyy", { locale: tr })} tarihine kadar
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* Gösterim ilerleme çubuğu */}
                      <p className="text-sm font-medium text-slate-900">
                        {p.impressionsDelivered} / {p.totalImpressions}
                      </p>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min((p.impressionsDelivered / p.totalImpressions) * 100, 100)}%` }}
                        />
                      </div>
                      {/* Aktif/pasif badge */}
                      <Badge className={`mt-1 text-xs ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.isActive ? "Aktif" : "Tamamlandı"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Henüz reklam yoksa bilgilendirme */}
          {!loadingStats && (!stats?.purchases || stats.purchases.length === 0) && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Henüz gösterim verisi yok</h3>
              <p className="text-slate-500 text-sm mb-6">
                İlk reklamınızı satın alarak testlerinizi öne çıkarmaya başlayın.
              </p>
              <Button onClick={() => setActiveTab("buy")} className="bg-indigo-600 hover:bg-indigo-700">
                Reklam Satın Al
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Reklamlarım listesi ─── */}
      {activeTab === "purchases" && (
        <Card>
          <CardContent className="p-0">
            {loadingPurchases ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Henüz reklam satın almadınız</p>
                <Button onClick={() => setActiveTab("buy")} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                  İlk Reklamı Al
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {purchases.map((p) => {
                  // Aktif: süresi dolmamış ve gösterim hakkı kalmış
                  const isActive = new Date(p.validUntil) > new Date() && p.impressionsRemaining > 0;
                  const pct = p.adPackage
                    ? Math.round(((p.adPackage.impressions - p.impressionsRemaining) / p.adPackage.impressions) * 100)
                    : 0;
                  return (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${p.targetType === "EDUCATOR" ? "bg-purple-50" : "bg-indigo-50"}`}>
                          {p.targetType === "EDUCATOR"
                            ? <User className="w-4 h-4 text-purple-600" />
                            : <Package className="w-4 h-4 text-indigo-600" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">
                            {p.test ? p.test.title : "Profil Öne Çıkarma"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(p.validUntil), "d MMM yyyy", { locale: tr })} tarihine kadar
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {/* Kalan gösterim sayısı */}
                          <p className="text-sm font-medium text-slate-700">
                            {p.impressionsRemaining?.toLocaleString("tr-TR")} gösterim kaldı
                          </p>
                          {/* Tüketim ilerleme çubuğu */}
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <Badge className={`${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {isActive ? <><CheckCircle className="w-3 h-3 mr-1 inline" />Aktif</> : "Tamamlandı"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Yeni Reklam Satın Al ─── */}
      {activeTab === "buy" && (
        <div className="max-w-xl space-y-6">
          {/* Bilgilendirme kutusu */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-800">
              <p className="font-medium mb-1">Nasıl çalışır?</p>
              <ul className="space-y-1 text-indigo-700">
                <li>• Ana sayfadaki test önerilerinin <strong>%10'u</strong> reklam bazlıdır.</li>
                <li>• Kişiselleştirilmiş öneriler etkilenmez — reklamlar ek görünürlük sağlar.</li>
                <li>• Satın aldığınız paket içindeki gösterimler tükenince reklam otomatik biter.</li>
              </ul>
            </div>
          </div>

          {/* Hedef türü seçimi */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Öne Çıkarma Türü</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: "TEST",     label: "Test Paketi",   desc: "Belirli bir testinizi öne çıkarın", Icon: Package },
                { val: "EDUCATOR", label: "Profilim",      desc: "Eğitici profilinizi öne çıkarın",   Icon: User    },
              ].map(({ val, label, desc, Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => { setTargetType(val); setSelectedTestId(""); }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    targetType === val
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${targetType === val ? "text-indigo-600" : "text-slate-400"}`} />
                  <p className="font-medium text-sm text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* TEST türünde test seçimi */}
          {targetType === "TEST" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Hangi Test?</label>
              {publishedTests.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Yayında testiniz bulunmuyor. Önce bir test yayınlayın.
                </p>
              ) : (
                <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Test seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedTests.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Paket seçimi */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Reklam Paketi</label>
            {packages.length === 0 ? (
              <p className="text-sm text-slate-500">Şu an satışta paket bulunmuyor.</p>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedPackageId === pkg.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{pkg.name}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {pkg.impressions?.toLocaleString("tr-TR")} gösterim · {pkg.durationDays} gün geçerli
                        </p>
                      </div>
                      <p className="text-lg font-bold text-indigo-600">
                        {((pkg.priceCents ?? 0) / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0 })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Satın alma butonu */}
          <Button
            onClick={handlePurchase}
            disabled={
              purchaseMutation.isPending ||
              !selectedPackageId ||
              (targetType === "TEST" && !selectedTestId)
            }
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {purchaseMutation.isPending ? "İşleniyor..." : "Reklamı Satın Al"}
          </Button>
        </div>
      )}
    </div>
  );
}
