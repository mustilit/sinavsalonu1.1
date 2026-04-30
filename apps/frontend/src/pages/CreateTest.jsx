import { useState, useCallback, useEffect } from "react";
import { createPageUrl } from "@/utils";
import { entities, topics as topicsApi } from "@/api/dalClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, WrenchIcon, History, Plus, GripVertical,
  BookOpen, Eye, CheckCircle2, Trash2, Package, HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { buildPageUrl, useAppNavigate } from "@/lib/navigation";
import { useServiceStatus } from "@/lib/useServiceStatus";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useShouldShowTour, useCompleteTour, TOUR_KEYS } from "@/lib/useOnboarding";
import { EDUCATOR_CREATE_STEPS } from "@/components/onboarding/tourSteps";
import { useAutoSave } from "@/lib/useAutoSave";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { QuestionForm } from "@/components/questions/QuestionForm";
import { TestPreviewModal } from "@/components/TestPreviewModal";

// ─── Adım göstergesi ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Paket",     icon: Package     },
  { id: 2, label: "Sorular",   icon: HelpCircle  },
  { id: 3, label: "Önizleme",  icon: Eye         },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done   = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                done   ? "bg-indigo-600 border-indigo-600 text-white"
                : active ? "bg-white border-indigo-600 text-indigo-600"
                         : "bg-white border-slate-200 text-slate-400"
              }`}>
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium ${
                active ? "text-indigo-600" : done ? "text-slate-600" : "text-slate-400"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-1 mb-5 transition-colors ${
                current > step.id ? "bg-indigo-600" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
/**
 * CreateTest — 3 adımlı sihirbaz
 *  1. Paket: başlık, açıklama, sınav türü, fiyat, süre, süreli mi
 *  2. Sorular: soru ekle / düzenle / sil (soru bazında konu seçimi)
 *  3. Önizleme: aday gözünden önizle → yayınla veya taslak kaydet
 */
export default function CreateTest() {
  const { user }     = useAuth();
  const navigate     = useAppNavigate();
  const qc           = useQueryClient();
  const { packageCreationEnabled } = useServiceStatus();
  const showCreateTour = useShouldShowTour(TOUR_KEYS.EDUCATOR_CREATE);
  const completeTour   = useCompleteTour();

  // ─── Sihirbaz durumu ─────────────────────────────────────────────────────
  const [step, setStep]     = useState(1);
  const [testId, setTestId] = useState(null);     // adım 1→2 geçişinde set edilir

  const [formData, setFormData] = useState({
    title: "", description: "", exam_type_id: "",
    price: 0, duration_minutes: 60, is_timed: false,
  });

  // Adım 2 soru formu
  const [showNewForm,      setShowNewForm]      = useState(false);
  const [editingQuestion,  setEditingQuestion]  = useState(null);

  // Önizleme modalı
  const [previewOpen, setPreviewOpen] = useState(false);

  // ─── Taslak kurtarma ────────────────────────────────────────────────────
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftInfo,       setDraftInfo]       = useState(null);
  const draftKey      = user?.id ? `createTest_${user.id}` : null;
  const getFormData   = useCallback(() => formData, [formData]);
  const { hasDraft, loadDraft, clearDraft } = useAutoSave(
    draftKey ?? "__noop__",
    getFormData,
    { enabled: !!draftKey && step === 1 },
  );

  useEffect(() => {
    if (!draftKey) return;
    if (hasDraft()) {
      const draft = loadDraft();
      if (draft?.data?.title) { setDraftInfo(draft); setShowDraftDialog(true); }
    }
  }, [draftKey]);

  // ─── Sorgular ───────────────────────────────────────────────────────────
  const { data: examTypes = [] } = useQuery({
    queryKey: ["examTypes"],
    queryFn:  () => entities.ExamType.filter({ is_active: true }),
    enabled:  !!user,
  });

  // Konu listesi: soru formunda kullanılacak (düz/flat liste)
  // Admin topics endpoint'i kullanır; eğiticiler için boş döner (403) — graceful fallback
  const { data: topicList = [] } = useQuery({
    queryKey: ["topicsFlat", formData.exam_type_id],
    queryFn:  async () => {
      try {
        return await topicsApi.flat(formData.exam_type_id || undefined);
      } catch {
        return [];
      }
    },
    enabled:  step >= 2,
    retry:    false,
    staleTime: 60_000,
  });

  // Oluşturulan testin soruları
  const { data: testDetail } = useQuery({
    queryKey: ["test", testId],
    queryFn:  async () => { const { data } = await api.get(`/tests/${testId}`); return data; },
    enabled:  !!testId,
  });

  const questions = testDetail?.questions || [];

  // ─── Mutasyonlar ────────────────────────────────────────────────────────
  // Adım 1 → 2: testi oluştur (ya da var olanı güncelle)
  const createTestMutation = useMutation({
    mutationFn: async () => {
      if (testId) {
        // Kullanıcı geri gelip tekrar ileri tıkladı — testi güncelle
        // UpdateTestDto: title, priceCents, duration, isTimed, hasSolutions
        await api.patch(`/tests/${testId}`, {
          title:      formData.title,
          priceCents: Math.round((formData.price || 0) * 100),
          isTimed:    formData.is_timed,
          duration:   formData.duration_minutes || 60,
        });
        return { id: testId };
      }
      // CreateTestDto: title, isTimed, duration, price (kuruş cinsinden), examTypeId, topicId
      const { data } = await api.post("/tests", {
        title:      formData.title,
        examTypeId: formData.exam_type_id || undefined,
        price:      Math.round((formData.price || 0) * 100),
        isTimed:    formData.is_timed,
        duration:   formData.duration_minutes || 60,
      });
      return data;
    },
    onSuccess: (newTest) => {
      clearDraft();
      setTestId(newTest.id);
      setStep(2);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Test oluşturulurken hata oluştu");
    },
  });

  // Soru ekle
  const createQuestionMutation = useMutation({
    mutationFn: async (data) => {
      const options = (data.options || []).filter(o => (o.content || "").trim() || o.mediaUrl);
      await api.post(`/tests/${testId}/questions`, {
        content:          data.question_text,
        mediaUrl:         data.question_mediaUrl || undefined,
        order:            questions.length,
        topicId:          data.topicId || undefined,
        solutionText:     data.solutionText || undefined,
        solutionMediaUrl: data.solutionMediaUrl || undefined,
        options,
      });
    },
    onSuccess: () => {
      toast.success("Soru eklendi");
      qc.invalidateQueries({ queryKey: ["test", testId] });
      setShowNewForm(false);
      setEditingQuestion(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Soru eklenemedi"),
  });

  // Soru güncelle
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ questionId, data }) => {
      await api.patch(`/tests/${testId}/questions/${questionId}`, {
        content:          data.question_text,
        mediaUrl:         data.question_mediaUrl ?? undefined,
        order:            data.order,
        topicId:          data.topicId ?? undefined,
        solutionText:     data.solutionText || undefined,
        solutionMediaUrl: data.solutionMediaUrl || undefined,
      });
      for (let i = 0; i < (data.options || []).length; i++) {
        const opt  = data.options[i];
        const orig = editingQuestion?.options?.[i];
        if (orig?.id) {
          await api.patch(
            `/tests/${testId}/questions/${questionId}/options/${orig.id}`,
            { content: opt.content, isCorrect: opt.isCorrect, mediaUrl: opt.mediaUrl ?? undefined },
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("Soru güncellendi");
      qc.invalidateQueries({ queryKey: ["test", testId] });
      setEditingQuestion(null);
      setShowNewForm(false);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Güncelleme başarısız"),
  });

  // Soru sil
  const deleteQuestionMutation = useMutation({
    mutationFn: (qId) => api.delete(`/tests/${testId}/questions/${qId}`),
    onSuccess:  () => { toast.success("Soru silindi"); qc.invalidateQueries({ queryKey: ["test", testId] }); },
    onError:    () => toast.error("Soru silinemedi"),
  });

  // Yayınla
  const publishMutation = useMutation({
    mutationFn: () => api.put(`/tests/${testId}/publish`),
    onSuccess:  () => {
      toast.success("Test yayınlandı!");
      qc.invalidateQueries({ queryKey: ["test", testId] });
      navigate(buildPageUrl("MyTestPackages"), { replace: true });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Yayınlama başarısız"),
  });

  // ─── Guard'lar ──────────────────────────────────────────────────────────
  if (!user) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <p className="text-slate-600 mb-4">Test oluşturmak için giriş yapın</p>
      <Link to={createPageUrl("Login")}>
        <Button className="bg-indigo-600 hover:bg-indigo-700">Giriş Yap</Button>
      </Link>
    </div>
  );

  if (!packageCreationEnabled) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
        <WrenchIcon className="w-10 h-10 text-amber-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Bakım Modu</h2>
      <p className="text-slate-600">Test oluşturma geçici olarak durdurulmuştur.</p>
    </div>
  );

  if (user.role === "EDUCATOR" && user?.status === "PENDING_EDUCATOR_APPROVAL") return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Hesap Onayı Bekleniyor</h2>
      <p className="text-slate-600 mb-6">
        Test oluşturabilmek için hesabınızın yönetici tarafından onaylanması gerekiyor.
      </p>
      <Link to={createPageUrl("EducatorSettings")}>
        <Button className="bg-indigo-600 hover:bg-indigo-700">Profil Ayarlarına Git</Button>
      </Link>
    </div>
  );

  // ─── Geçiş işleyicileri ─────────────────────────────────────────────────
  const goToQuestions = () => {
    if (!formData.title.trim()) { toast.error("Test başlığı zorunludur"); return; }
    if (formData.is_timed && (!formData.duration_minutes || formData.duration_minutes < 1)) {
      toast.error("Süreli test için süre giriniz"); return;
    }
    createTestMutation.mutate();
  };

  const goToPreview = () => {
    if (questions.length === 0) { toast.error("En az 1 soru eklemelisiniz"); return; }
    setStep(3);
  };

  const handleSaveQuestion = (data) => {
    if (editingQuestion?.id) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data });
    } else {
      createQuestionMutation.mutate(data);
    }
  };

  const draftSavedAt = draftInfo?.savedAt
    ? (() => { try { return format(new Date(draftInfo.savedAt), "d MMM yyyy HH:mm", { locale: tr }); } catch { return draftInfo.savedAt; } })()
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">

      {/* Taslak kurtarma diyaloğu */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Kaydedilmemiş Taslak
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>"{draftInfo?.data?.title}"</strong> başlıklı kaydedilmemiş bir taslak bulundu.
              {draftSavedAt && <span className="text-slate-400"> ({draftSavedAt})</span>}
            </p>
            <div className="flex gap-3">
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                if (draftInfo?.data) setFormData(draftInfo.data);
                toast.success("Taslak yüklendi");
                setShowDraftDialog(false);
              }}>Devam Et</Button>
              <Button variant="outline" className="flex-1" onClick={() => { clearDraft(); setShowDraftDialog(false); }}>
                Sil, Yeniden Başla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding */}
      {showCreateTour && (
        <OnboardingTour
          steps={EDUCATOR_CREATE_STEPS}
          onComplete={() => completeTour(TOUR_KEYS.EDUCATOR_CREATE)}
          onSkip={() => completeTour(TOUR_KEYS.EDUCATOR_CREATE)}
        />
      )}

      {/* Geri + başlık */}
      <Link to={createPageUrl("EducatorDashboard")}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Dashboard'a Dön
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Yeni Test Oluştur</h1>
      <p className="text-slate-500 mb-8">Adımları takip ederek testinizi oluşturun ve yayınlayın.</p>

      <StepIndicator current={step} />

      {/* ── ADIM 1: Paket bilgileri ─────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Paket Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Test Başlığı *</Label>
              <Input id="title" placeholder="Örn: KPSS Genel Yetenek Deneme Sınavı"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" placeholder="Test hakkında kısa bir açıklama..." rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Sınav Türü</Label>
              <Select value={formData.exam_type_id || "none"}
                onValueChange={v => setFormData({ ...formData, exam_type_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Seçin (opsiyonel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Seçilmedi —</SelectItem>
                  {examTypes.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Fiyat (₺)</Label>
                <Input id="price" type="number" min="0" step="0.01"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
              </div>
              {formData.is_timed && (
                <div className="space-y-2">
                  <Label htmlFor="duration">Süre (dakika) *</Label>
                  <Input id="duration" type="number" min="1"
                    value={formData.duration_minutes}
                    onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch id="is_timed" checked={formData.is_timed}
                onCheckedChange={v => setFormData({ ...formData, is_timed: v })} />
              <Label htmlFor="is_timed" className="cursor-pointer">Süreli Test</Label>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={goToQuestions} disabled={createTestMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700">
                {createTestMutation.isPending ? "Oluşturuluyor..." : "İleri →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ADIM 2: Sorular ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  Sorular
                  <Badge variant="outline" className="ml-1 font-normal">{questions.length} soru</Badge>
                </CardTitle>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => { setShowNewForm(true); setEditingQuestion(null); }}
                  disabled={showNewForm || !!editingQuestion}>
                  <Plus className="w-4 h-4 mr-1" />Soru Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Soru formu */}
              {(showNewForm || editingQuestion) && (
                <div className="mb-5">
                  <QuestionForm
                    question={editingQuestion?.id ? editingQuestion : null}
                    options={editingQuestion?.options || []}
                    topicList={topicList}
                    onSave={handleSaveQuestion}
                    onCancel={() => { setShowNewForm(false); setEditingQuestion(null); }}
                    isLoading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                    saveLabel={editingQuestion?.id ? "Güncelle" : "Soru Ekle"}
                  />
                </div>
              )}

              {/* Soru listesi */}
              <div className="space-y-2">
                {questions.map((q, idx) => {
                  const correctOpt    = q.options?.find(o => o.isCorrect);
                  const correctLetter = correctOpt ? ["A","B","C","D","E"][q.options.indexOf(correctOpt)] : "-";
                  return (
                    <div key={q.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 shrink-0 mt-0.5">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-sm font-semibold w-5 text-center">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 line-clamp-2">{q.content}</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs py-0 px-2">Doğru: {correctLetter}</Badge>
                          {q.topic?.name && (
                            <Badge variant="outline" className="text-xs py-0 px-2 border-indigo-200 text-indigo-700 bg-indigo-50">
                              {q.topic.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-indigo-600"
                          onClick={() => { setEditingQuestion(q); setShowNewForm(false); }}>
                          Düzenle
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-rose-600"
                          onClick={() => deleteQuestionMutation.mutate(q.id)}
                          disabled={deleteQuestionMutation.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {questions.length === 0 && !showNewForm && !editingQuestion && (
                  <div className="text-center py-10 text-slate-500">
                    <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="font-medium">Henüz soru eklenmedi</p>
                    <p className="text-sm mt-1 text-slate-400">"Soru Ekle" butonuna tıklayarak başlayın</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← Geri</Button>
            <div className="flex gap-2">
              {questions.length > 0 && (
                <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                  onClick={() => setPreviewOpen(true)}>
                  <Eye className="w-4 h-4" />Önizle
                </Button>
              )}
              <Button onClick={goToPreview} className="bg-indigo-600 hover:bg-indigo-700">
                Önizleme →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADIM 3: Önizleme & Yayınla ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                Önizleme & Yayınla
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Özet */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-slate-900">{formData.title}</h3>
                {formData.description && <p className="text-sm text-slate-600">{formData.description}</p>}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{questions.length} soru</Badge>
                  {formData.is_timed && <Badge variant="outline">{formData.duration_minutes} dk</Badge>}
                  <Badge variant="outline">{formData.price === 0 ? "Ücretsiz" : `₺${formData.price}`}</Badge>
                  {examTypes.find(e => e.id === formData.exam_type_id)?.name && (
                    <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50">
                      {examTypes.find(e => e.id === formData.exam_type_id)?.name}
                    </Badge>
                  )}
                </div>
              </div>

              <Button variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 gap-2"
                onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4" />Aday Gözünden Önizle
              </Button>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm text-slate-500">
                  Test yayınlandığında öğrenciler tarafından görülebilir ve satın alınabilir hale gelir.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1"
                    onClick={() => { toast.success("Test taslak olarak kaydedildi"); navigate(buildPageUrl("MyTestPackages"), { replace: true }); }}>
                    Taslak Kaydet
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
                    disabled={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                    <CheckCircle2 className="w-4 h-4" />
                    {publishMutation.isPending ? "Yayınlanıyor..." : "Yayınla"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => setStep(2)}>← Geri (Sorular)</Button>
        </div>
      )}

      {/* Önizleme modalı */}
      <TestPreviewModal
        isOpen={previewOpen}
        questions={questions}
        title={formData.title}
        onClose={() => setPreviewOpen(false)}
        onConfirm={step === 3 && !testDetail?.publishedAt
          ? () => { setPreviewOpen(false); publishMutation.mutate(); }
          : null}
      />
    </div>
  );
}
