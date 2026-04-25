import { useState } from "react";
import { api } from "@/api/dalClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GraduationCap, Mail, Star, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

const LIMIT = 50;

const statusConfig = {
  ACTIVE: { label: "Aktif", color: "bg-emerald-100 text-emerald-700" },
  SUSPENDED: { label: "Askıya Alındı", color: "bg-rose-100 text-rose-700" },
  PENDING_EDUCATOR_APPROVAL: { label: "Onay Bekliyor", color: "bg-amber-100 text-amber-700" },
};

const fmtDate = (d) =>
  d ? format(new Date(d), "dd MMM yyyy", { locale: tr }) : null;

const StarVal = ({ val }) =>
  val != null ? (
    <span className="flex items-center gap-1 text-amber-600 font-medium">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      {Number(val).toFixed(1)}
    </span>
  ) : (
    <span className="text-slate-400">-</span>
  );

export default function AdminEducatorReport() {
  const { user } = useAuth();

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    lastLoginFrom: "",
    lastLoginTo: "",
    approvedFrom: "",
    approvedTo: "",
    minTests: "",
    maxTests: "",
    minSales: "",
    maxSales: "",
    minRating: "",
    maxRating: "",
    hasOpenObjections: false,
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("registeredAt");
  const [order, setOrder] = useState("desc");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const buildParams = (f) => {
    const p = new URLSearchParams();
    if (f.q) p.append("q", f.q);
    if (f.status && f.status !== "all") p.append("status", f.status);
    if (f.lastLoginFrom) p.append("lastLoginFrom", f.lastLoginFrom);
    if (f.lastLoginTo) p.append("lastLoginTo", f.lastLoginTo);
    if (f.approvedFrom) p.append("approvedFrom", f.approvedFrom);
    if (f.approvedTo) p.append("approvedTo", f.approvedTo);
    if (f.minTests) p.append("minTests", f.minTests);
    if (f.maxTests) p.append("maxTests", f.maxTests);
    if (f.minSales) p.append("minSales", f.minSales);
    if (f.maxSales) p.append("maxSales", f.maxSales);
    if (f.minRating) p.append("minRating", f.minRating);
    if (f.maxRating) p.append("maxRating", f.maxRating);
    if (f.hasOpenObjections) p.append("hasOpenObjections", "true");
    p.append("page", page);
    p.append("limit", LIMIT);
    p.append("sortBy", sortBy);
    p.append("order", order);
    return p.toString();
  };

  const { data = { items: [], total: 0 }, isLoading, error } = useQuery({
    queryKey: ["educatorReport", appliedFilters, page, sortBy, order],
    queryFn: async () => {
      const { data } = await api.get(`/admin/educator-report?${buildParams(appliedFilters)}`);
      return data || { items: [], total: 0 };
    },
    enabled: (user?.role || "").toUpperCase() === "ADMIN",
  });

  const educators = data.items || [];
  const totalCount = data.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!emailSubject.trim()) throw new Error("Konu gerekli");
      if (emailBody.trim().length < 20) throw new Error("Mesaj en az 20 karakter olmalıdır");
      if (selectedIds.size === 0) throw new Error("En az bir eğitici seçilmeli");
      const { data } = await api.post("/admin/educator-report/bulk-email", {
        educatorIds: Array.from(selectedIds),
        subject: emailSubject,
        body: emailBody,
      });
      return data;
    },
    onSuccess: (result) => {
      toast.success(`${result.sent ?? selectedIds.size} eğiticiye mail gönderildi`);
      setShowEmailDialog(false);
      setEmailSubject("");
      setEmailBody("");
      setSelectedIds(new Set());
    },
    onError: (err) => toast.error(err.message || "Mail gönderilemedi"),
  });

  const applyFilters = () => { setAppliedFilters({ ...filters }); setPage(1); setSelectedIds(new Set()); };
  const clearFilters = () => {
    const empty = { q: "", status: "all", lastLoginFrom: "", lastLoginTo: "", approvedFrom: "", approvedTo: "", minTests: "", maxTests: "", minSales: "", maxSales: "", minRating: "", maxRating: "", hasOpenObjections: false };
    setFilters(empty);
    setAppliedFilters({});
    setPage(1);
    setSelectedIds(new Set());
  };

  const toggleId = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const allPageSelected = educators.length > 0 && educators.every((e) => selectedIds.has(e.id));
  const toggleAll = () => {
    if (allPageSelected) {
      const s = new Set(selectedIds);
      educators.forEach((e) => s.delete(e.id));
      setSelectedIds(s);
    } else {
      const s = new Set(selectedIds);
      educators.forEach((e) => s.add(e.id));
      setSelectedIds(s);
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) setOrder(order === "asc" ? "desc" : "asc");
    else { setSortBy(col); setOrder("desc"); }
    setPage(1);
  };

  const SortIcon = ({ col }) =>
    sortBy !== col ? <span className="text-slate-300 ml-1">↕</span> :
      order === "asc" ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />;

  const f = (key) => ({ value: filters[key], onChange: (e) => setFilters({ ...filters, [key]: e.target.value }) });

  if ((user?.role || "").toUpperCase() !== "ADMIN") {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-slate-900">Erişim Engellendi</h2>
        <p className="text-slate-500 mt-2">Bu sayfaya erişim yetkiniz yok</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Eğitici Profil Raporu</h1>
        <p className="text-slate-500 mt-2">Tüm eğiticilerin performans ve satış analitikleri</p>
      </div>

      {/* Filter Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Arama (E-posta / Kullanıcı Adı)</Label>
              <Input placeholder="Ara..." {...f("q")} />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Durum</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="ACTIVE">Aktif</SelectItem>
                  <SelectItem value="SUSPENDED">Askıya Alınmış</SelectItem>
                  <SelectItem value="PENDING_EDUCATOR_APPROVAL">Onay Bekliyor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Son Giriş: Başlangıç</Label>
              <Input type="date" {...f("lastLoginFrom")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Son Giriş: Bitiş</Label>
              <Input type="date" {...f("lastLoginTo")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Onay Tarihi: Başlangıç</Label>
              <Input type="date" {...f("approvedFrom")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Onay Tarihi: Bitiş</Label>
              <Input type="date" {...f("approvedTo")} />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Min. Test Sayısı</Label>
              <Input type="number" min="0" placeholder="0" {...f("minTests")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Maks. Test Sayısı</Label>
              <Input type="number" min="0" placeholder="∞" {...f("maxTests")} />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Min. Satış Adeti</Label>
              <Input type="number" min="0" placeholder="0" {...f("minSales")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Maks. Satış Adeti</Label>
              <Input type="number" min="0" placeholder="∞" {...f("maxSales")} />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Min. Ortalama Puan (1-5)</Label>
              <Input type="number" min="1" max="5" step="0.1" placeholder="1" {...f("minRating")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Maks. Ortalama Puan (1-5)</Label>
              <Input type="number" min="1" max="5" step="0.1" placeholder="5" {...f("maxRating")} />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasOpenObjections}
                  onChange={(e) => setFilters({ ...filters, hasOpenObjections: e.target.checked })}
                  className="w-4 h-4 accent-rose-600"
                />
                <span className="text-sm text-slate-700">Açık hata bildirimi olanlar</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={applyFilters} className="bg-indigo-600 hover:bg-indigo-700">Filtrele</Button>
            <Button variant="outline" onClick={clearFilters}>Temizle</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span><span className="font-semibold text-slate-900">{totalCount}</span> eğitici bulundu</span>
          {selectedIds.size > 0 && (
            <span className="text-indigo-600 font-medium">{selectedIds.size} seçili</span>
          )}
        </div>
        <Button
          onClick={() => setShowEmailDialog(true)}
          disabled={selectedIds.size === 0}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          <Mail className="w-4 h-4" />
          Toplu Mail Gönder ({selectedIds.size})
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="flex items-center gap-3 p-8 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              <span>Veriler yüklenirken hata oluştu. Lütfen tekrar deneyin.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-indigo-600"
                        disabled={educators.length === 0}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("registeredAt")}>
                      Kullanıcı <SortIcon col="registeredAt" />
                    </TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("lastLoginAt")}>
                      Son Giriş <SortIcon col="lastLoginAt" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("lastPublishedAt")}>
                      Son Paket <SortIcon col="lastPublishedAt" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("totalTests")}>
                      Testler <SortIcon col="totalTests" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("totalSales")}>
                      Satış <SortIcon col="totalSales" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("totalRevenue")}>
                      Gelir <SortIcon col="totalRevenue" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("uniqueCandidates")}>
                      Aday <SortIcon col="uniqueCandidates" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("avgTestRating")}>
                      Test Puanı <SortIcon col="avgTestRating" />
                    </TableHead>
                    <TableHead>Eğitici Puanı</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("totalObjections")}>
                      Hata Bildirimi <SortIcon col="totalObjections" />
                    </TableHead>
                    <TableHead>İçerik Alanı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 13 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : educators.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-12 text-slate-500">
                        <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        Filtreye uygun eğitici bulunamadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    educators.map((edu) => {
                      const sc = statusConfig[edu.status] || { label: edu.status, color: "bg-slate-100 text-slate-600" };
                      return (
                        <TableRow key={edu.id} className={selectedIds.has(edu.id) ? "bg-indigo-50" : "hover:bg-slate-50"}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(edu.id)}
                              onChange={() => toggleId(edu.id)}
                              className="w-4 h-4 accent-indigo-600"
                            />
                          </TableCell>

                          <TableCell>
                            <p className="font-medium text-slate-900 text-sm">{edu.username}</p>
                            <p className="text-xs text-slate-500">{edu.email}</p>
                            <p className="text-xs text-slate-400">{fmtDate(edu.registeredAt)}</p>
                          </TableCell>

                          <TableCell>
                            <Badge className={`text-xs border-0 ${sc.color}`}>{sc.label}</Badge>
                            {edu.educatorApprovedAt && (
                              <p className="text-xs text-slate-400 mt-1">Onay: {fmtDate(edu.educatorApprovedAt)}</p>
                            )}
                          </TableCell>

                          <TableCell className="text-sm text-slate-600">
                            {edu.lastLoginAt
                              ? fmtDate(edu.lastLoginAt)
                              : <span className="text-slate-400 italic text-xs">Hiç giriş yok</span>}
                          </TableCell>

                          <TableCell className="text-sm text-slate-600">
                            {edu.lastPublishedAt ? fmtDate(edu.lastPublishedAt) : <span className="text-slate-400">-</span>}
                          </TableCell>

                          <TableCell>
                            <span className="text-sm font-semibold text-slate-900">{edu.publishedTests}</span>
                            <span className="text-xs text-slate-400">/{edu.totalTests}</span>
                            <p className="text-xs text-slate-400">yayında/toplam</p>
                          </TableCell>

                          <TableCell className="text-sm font-semibold text-slate-900">
                            {edu.totalSales}
                          </TableCell>

                          <TableCell className="text-sm font-semibold text-emerald-700">
                            {edu.totalRevenueCents > 0
                              ? `₺${(edu.totalRevenueCents / 100).toLocaleString("tr-TR")}`
                              : <span className="text-slate-400 font-normal">-</span>}
                          </TableCell>

                          <TableCell className="text-sm text-slate-700">
                            {edu.uniqueCandidates}
                          </TableCell>

                          <TableCell><StarVal val={edu.avgTestRating} /></TableCell>
                          <TableCell><StarVal val={edu.avgEducatorRating} /></TableCell>

                          <TableCell>
                            {edu.totalObjections > 0 ? (
                              <div>
                                <span className={edu.openObjections > 0 ? "text-rose-600 font-semibold text-sm" : "text-slate-700 text-sm"}>
                                  {edu.openObjections > 0 && <AlertCircle className="w-3.5 h-3.5 inline mr-1" />}
                                  {edu.openObjections}/{edu.totalObjections}
                                </span>
                                <p className="text-xs text-slate-400">açık/toplam</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </TableCell>

                          <TableCell className="max-w-[160px]">
                            {edu.examTypeNames ? (
                              <span
                                className="text-xs text-slate-600 block truncate"
                                title={edu.examTypeNames}
                              >
                                {edu.examTypeNames}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Önceki
          </Button>
          <span className="text-sm text-slate-600">
            Sayfa {page} / {totalPages} · {totalCount} eğitici
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Sonraki →
          </Button>
        </div>
      )}

      {/* Bulk Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              Toplu Mail Gönder
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600 mb-4">
              Seçilen <span className="font-semibold text-indigo-600">{selectedIds.size} eğiticiye</span> mail gönderilecek.
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Konu *</Label>
                <Input
                  id="subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Mail konusu..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="body">Mesaj * <span className="text-slate-400 font-normal">(min. 20 karakter)</span></Label>
                <Textarea
                  id="body"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Mesajınızı buraya yazın..."
                  rows={6}
                  className="mt-1.5"
                />
                <p className="text-xs text-slate-400 mt-1">{emailBody.trim().length} / min. 20 karakter</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>İptal</Button>
            <Button
              onClick={() => emailMutation.mutate()}
              disabled={emailMutation.isPending || !emailSubject.trim() || emailBody.trim().length < 20}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {emailMutation.isPending ? "Gönderiliyor..." : `Gönder (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
