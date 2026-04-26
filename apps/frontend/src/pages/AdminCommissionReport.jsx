/**
 * AdminCommissionReport — Aylık eğitici komisyon raporu.
 *
 * Satışlar iki kategoride gösterilir:
 *   - Normal Paket (isTimed=false): komisyon uygulanır
 *   - Canlı Test   (isTimed=true) : komisyon uygulanmaz, tamamı eğiticiye ödenir
 *
 * CSV export da bu ayrıma göre yapılandırılmıştır.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertCircle,
  Users,
  CreditCard,
  Radio,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  { value: 1, label: "Ocak" },   { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },   { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" }, { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" }, { value: 12, label: "Aralık" },
];

/** Bir önceki ay hesabı — Ocak için bir önceki yılın Aralık ayına döner */
function prevMonth() {
  const now = new Date();
  if (now.getMonth() === 0) return { year: now.getFullYear() - 1, month: 12 };
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** Kuruş cinsinden değeri Türk lirası formatında gösterir */
function formatTL(cents) {
  return (cents / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ₺";
}

export default function AdminCommissionReport() {
  const { year: defaultYear, month: defaultMonth } = prevMonth();
  const [year, setYear]   = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [appliedYear, setAppliedYear]   = useState(defaultYear);
  const [appliedMonth, setAppliedMonth] = useState(defaultMonth);
  const [exportLoading, setExportLoading] = useState(false);

  // Son 5 yıl seçenekleri
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-commission", appliedYear, appliedMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/commission/report?year=${appliedYear}&month=${appliedMonth}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );
      if (!res.ok) throw new Error("Rapor alınamadı");
      return res.json();
    },
  });

  const handleApply = () => {
    setAppliedYear(year);
    setAppliedMonth(month);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(
        `/api/admin/commission/export?year=${appliedYear}&month=${appliedMonth}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );
      if (!res.ok) throw new Error("Export başarısız");
      const blob = await res.blob();
      const monthStr = String(appliedMonth).padStart(2, "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `komisyon-raporu-${appliedYear}-${monthStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Rapor indirildi");
    } catch {
      toast.error("Export başarısız oldu");
    } finally {
      setExportLoading(false);
    }
  };

  const items = data?.items ?? [];
  const monthLabel = MONTHS.find((m) => m.value === appliedMonth)?.label ?? "";
  const periodLabel = `${monthLabel} ${appliedYear}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Başlık ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Komisyon Raporu</h1>
          <p className="text-slate-500 mt-1">
            Eğiticilerin aylık satış komisyonlarını görüntüleyin ve muhasebe çıktısı alın
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exportLoading || isLoading || items.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Download className="w-4 h-4" />
          {exportLoading ? "İndiriliyor..." : "Excel İndir"}
        </Button>
      </div>

      {/* ── Dönem seçici ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Yıl</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ay</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApply} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <RefreshCw className="w-4 h-4" />
            Raporu Getir
          </Button>
        </div>
      </div>

      {/* ── Özet kartlar ────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Eğitici sayısı */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Eğitici Sayısı</p>
                <p className="text-2xl font-bold text-slate-900">{items.length}</p>
              </div>
            </div>
          </div>

          {/* Normal paket satış toplamı */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Normal Paket Satışı</p>
                <p className="text-2xl font-bold text-slate-900">{formatTL(data.totalNormalSalesCents)}</p>
              </div>
            </div>
          </div>

          {/* Canlı test satış toplamı — komisyon yok */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                <Radio className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Canlı Test Satışı</p>
                <p className="text-2xl font-bold text-slate-900">{formatTL(data.totalLiveSalesCents)}</p>
                <p className="text-xs text-slate-400">Komisyonsuz</p>
              </div>
            </div>
          </div>

          {/* Toplam ödenecek */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Toplam Ödenecek</p>
                <p className="text-2xl font-bold text-slate-900">{formatTL(data.totalPayoutCents)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Komisyon özet bandı */}
      {data && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-semibold text-rose-800">
              Toplam Komisyon (%{data.commissionPercent}):
            </span>
            <span className="text-sm font-bold text-rose-700">{formatTL(data.totalCommissionCents)}</span>
          </div>
          {/* Komisyon yalnızca normal paket satışlarından kesilir */}
          <span className="text-xs text-rose-500">
            Yalnızca normal paket satışlarına uygulanır — canlı testler komisyon dışıdır.
          </span>
        </div>
      )}

      {/* ── Tablo ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            {periodLabel} Dönemi — Eğitici Komisyon Listesi
          </h2>
          {data && <span className="text-sm text-slate-500">{items.length} eğitici</span>}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center gap-3 py-20 text-rose-600">
            <AlertCircle className="w-5 h-5" />
            <span>Rapor yüklenemedi</span>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Wallet className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Bu döneme ait satış bulunamadı</p>
            <p className="text-sm mt-1">{periodLabel} döneminde gerçekleşen satış yok</p>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {/* Eğitici ve banka bilgileri */}
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Eğitici</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">IBAN</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Hesap Sahibi</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Banka</th>
                  {/* Normal paket sütunları */}
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 bg-emerald-50/40">
                    <div className="text-xs font-semibold text-emerald-700">Normal Paket</div>
                    Satış
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 bg-emerald-50/40">
                    <div className="text-xs font-semibold text-emerald-700">Normal Paket</div>
                    Tutar
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 bg-rose-50/40">
                    <div className="text-xs font-semibold text-rose-600">Komisyon ({data?.commissionPercent}%)</div>
                    Tutar
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 bg-emerald-50/40">
                    <div className="text-xs font-semibold text-emerald-700">Normal</div>
                    Ödenecek
                  </th>
                  {/* Canlı test sütunları */}
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 bg-violet-50/40">
                    <div className="text-xs font-semibold text-violet-700">Canlı Test</div>
                    Satış
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 bg-violet-50/40">
                    <div className="text-xs font-semibold text-violet-700">Canlı Test</div>
                    Tutar
                  </th>
                  {/* Toplam */}
                  <th className="text-right px-4 py-3 font-semibold text-slate-900 bg-amber-50/60">
                    Toplam Ödenecek
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr key={item.educatorId} className="hover:bg-slate-50/50 transition-colors">
                    {/* Eğitici */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900">{item.username}</p>
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </td>
                    {/* IBAN */}
                    <td className="px-4 py-3.5">
                      {item.iban ? (
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {item.iban}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 gap-1">
                          <CreditCard className="w-3 h-3" /> Girilmemiş
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {item.accountHolder || <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {item.bankName || <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    {/* Normal paket sütunları */}
                    <td className="px-4 py-3.5 text-right text-slate-700 bg-emerald-50/20">
                      {item.normalSaleCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-900 bg-emerald-50/20">
                      {formatTL(item.normalSalesCents)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-rose-600 bg-rose-50/20">
                      {formatTL(item.commissionCents)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-emerald-700 bg-emerald-50/20">
                      {formatTL(item.normalPayoutCents)}
                    </td>
                    {/* Canlı test sütunları */}
                    <td className="px-4 py-3.5 text-right text-slate-700 bg-violet-50/20">
                      {item.liveSaleCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-violet-700 bg-violet-50/20">
                      {formatTL(item.liveSalesCents)}
                    </td>
                    {/* Toplam */}
                    <td className="px-4 py-3.5 text-right font-bold text-amber-700 bg-amber-50/30">
                      {formatTL(item.totalPayoutCents)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Tablo alt toplam satırı */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={4} className="px-4 py-3.5 font-bold text-slate-900">
                    Toplam ({items.length} eğitici)
                  </td>
                  {/* Normal paket toplamları */}
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 bg-emerald-50/30">
                    {items.reduce((s, i) => s + i.normalSaleCount, 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 bg-emerald-50/30">
                    {data && formatTL(data.totalNormalSalesCents)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-rose-600 bg-rose-50/20">
                    {data && formatTL(data.totalCommissionCents)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-emerald-700 bg-emerald-50/30">
                    {data && formatTL(data.totalNormalPayoutCents)}
                  </td>
                  {/* Canlı test toplamları */}
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 bg-violet-50/20">
                    {items.reduce((s, i) => s + i.liveSaleCount, 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-violet-700 bg-violet-50/20">
                    {data && formatTL(data.totalLiveSalesCents)}
                  </td>
                  {/* Genel toplam */}
                  <td className="px-4 py-3.5 text-right font-bold text-amber-700 bg-amber-50/40">
                    {data && formatTL(data.totalPayoutCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* IBAN eksik uyarısı */}
      {!isLoading && items.some((i) => !i.iban) && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong>IBAN eksik:</strong>{" "}
            {items.filter((i) => !i.iban).length} eğiticinin IBAN bilgisi girilmemiş. Ödeme
            yapabilmek için lütfen ilgili eğiticilerden IBAN bilgilerini güncellemelerini isteyin.
          </div>
        </div>
      )}
    </div>
  );
}
